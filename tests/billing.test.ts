import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertSandboxStripeSecret,
  paidUntilFromUnix,
  sandboxCheckoutHosts,
  tierFromConfiguredPrice,
  verifyStripeSignature,
} from "../src/lib/billing";

describe("sandbox billing policy", () => {
  it("rejects live Stripe secrets", () => {
    expect(() => assertSandboxStripeSecret("sk_live_example")).toThrow(
      /test secret/,
    );
  });
  it("maps only configured sandbox prices to tiers", () => {
    expect(
      tierFromConfiguredPrice("price_gold", "price_gold", "price_diamond"),
    ).toBe("gold");
    expect(() =>
      tierFromConfiguredPrice("price_other", "price_gold", "price_diamond"),
    ).toThrow(/Unrecognised/);
  });
  it("allows only provider sandbox checkout hosts", () => {
    expect(sandboxCheckoutHosts).toContain("checkout.stripe.com");
    expect(sandboxCheckoutHosts).toContain("www.sandbox.paypal.com");
    expect(sandboxCheckoutHosts).not.toContain("paypal.com");
  });
  it("accepts a genuine Stripe test signature and rejects a forged one", async () => {
    const secret = "whsec_testsecret";
    const payload = '{"id":"evt_1","livemode":false}';
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    await expect(
      verifyStripeSignature(payload, `t=${timestamp},v1=${digest}`, secret),
    ).resolves.toBeUndefined();
    await expect(
      verifyStripeSignature(payload, `t=${timestamp},v1=${"a".repeat(64)}`, secret),
    ).rejects.toThrow(/mismatch/);
  });
  it("does not treat a success-page timestamp as settlement", () => {
    expect(paidUntilFromUnix("paid")).toBeNull();
    expect(paidUntilFromUnix(1_700_000_000)?.startsWith("20")).toBe(true);
  });
});

import {stripeSettlement,paypalSettlement,nextMonth,assertCheckoutUrl,validatePayPalPlan,validateStripePrice} from '../src/lib/billing';
import type {StripeSubscription,StripeInvoice,PayPalSubscription,PayPalSale} from '../src/lib/billing';
const sub:StripeSubscription={id:'sub_fixture',livemode:false,status:'active',cancel_at_period_end:false,metadata:{internal_subscription_id:'checkout-fixture',user_id:'member-fixture',tier:'gold'},items:{data:[{quantity:1,price:{id:'price_gold',livemode:false,currency:'gbp',unit_amount:999,recurring:{interval:'month',interval_count:1}}}]}};
const invoice:StripeInvoice={id:'in_fixture',livemode:false,subscription:sub.id,status:'paid',paid:true,amount_paid:999,currency:'gbp',charge:{id:'ch_fixture',paid:true,livemode:false,refunded:false,disputed:false,amount:999,amount_refunded:0},lines:{data:[{price:{id:'price_gold'},period:{start:1700000000,end:1702600000}}]}};
const stripe=(s=sub,i=[invoice])=>stripeSettlement(s,i,'price_gold','gold','checkout-fixture','member-fixture');
const pp:PayPalSubscription={id:'I-FIXTURE',custom_id:'checkout-fixture',plan_id:'P-GOLD',status:'ACTIVE'};
const sale:PayPalSale={id:'sale-fixture',state:'completed',amount:{total:'9.99',currency:'GBP'},create_time:'2026-01-31T12:00:00Z',billing_agreement_id:pp.id};
const paypal=(s=pp,rows=[sale])=>paypalSettlement(s,rows,'P-GOLD','gold','checkout-fixture');
describe('actual server settlement policy',()=>{
 it('an active subscription with no settled invoice grants no paid period',()=>expect(stripe(sub,[]).paidUntil).toBeNull());
 it('a failed first invoice grants no paid period even when the subscription is past_due',()=>expect(stripe({...sub,status:'past_due'},[{...invoice,paid:false,status:'open',amount_paid:0,charge:null}]).paidUntil).toBeNull());
 it('a settled invoice produces exactly its line paid-through date',()=>expect(stripe().paidUntil).toBe(new Date(1702600000*1000).toISOString()));
 it('failed renewal does not extend the previously paid period',()=>expect(stripe({...sub,status:'past_due'},[invoice,{...invoice,id:'in_failed',paid:false,status:'open',amount_paid:0,charge:null,lines:{data:[{price:{id:'price_gold'},period:{start:1702600000,end:1705200000}}]}}]).paidUntil).toBe(stripe().paidUntil));
 it.each(['refunded','disputed'] as const)('%s current charge revokes paid coverage',flag=>expect(stripe(sub,[{...invoice,charge:{...invoice.charge!,[flag]:true}}]).paidUntil).toBeNull());
 it('does not count trialing as a paid tier',()=>expect(stripe({...sub,status:'trialing'}).paidUntil).toBeNull());
 it('keeps only the verified paid period after cancellation',()=>expect(stripe({...sub,status:'canceled'})).toMatchObject({status:'cancelled',paidUntil:stripe().paidUntil}));
 it('rejects a subscription bound to another app account',()=>expect(()=>stripe({...sub,metadata:{...sub.metadata,user_id:'outsider'}})).toThrow(/binding/));
 it('rejects another price, currency or live object',()=>{
  expect(()=>stripe(sub,[{...invoice,currency:'usd'}])).toThrow(/currency/);
  expect(()=>stripe({...sub,livemode:true})).toThrow();
  expect(()=>validateStripePrice({...sub.items.data[0].price,unit_amount:1},'price_gold','gold')).toThrow();
 });
 it('PayPal activation without settlement grants no paid period',()=>expect(paypal(pp,[]).paidUntil).toBeNull());
 it('PayPal denied or refunded sale grants no paid period',()=>{
  expect(paypal(pp,[{...sale,state:'denied'}]).paidUntil).toBeNull();
  expect(paypal(pp,[{...sale,state:'refunded'}]).paidUntil).toBeNull();
 });
 it('derives a monthly PayPal paid period from a confirmed sale, clamping month-end',()=>expect(paypal().paidUntil).toBe('2026-02-28T12:00:00.000Z'));
 it('rejects another PayPal checkout or subscription sale',()=>{
  expect(()=>paypal({...pp,custom_id:'other'})).toThrow(/binding/);
  expect(()=>paypal(pp,[{...sale,billing_agreement_id:'I-OTHER'}])).toThrow(/another/);
 });
 it('rejects overridden PayPal plans and foreign currency',()=>{
  expect(()=>paypal({...pp,plan_overridden:true})).toThrow();
  expect(()=>paypal(pp,[{...sale,amount:{total:'9.99',currency:'USD'}}])).toThrow();
 });
 it('validates the actual PayPal plan has no trial cycle',()=>expect(()=>validatePayPalPlan({id:'P-GOLD',status:'ACTIVE',billing_cycles:[]},'P-GOLD','gold')).toThrow());
 it('rejects non-provider URLs and URL credentials',()=>{
  expect(()=>assertCheckoutUrl('https://paypal.com/approve')).toThrow();
  expect(()=>assertCheckoutUrl('https://evil.test/checkout.stripe.com')).toThrow();
  expect(()=>assertCheckoutUrl('https://user:pass@checkout.stripe.com/x')).toThrow();
 });
 it('rejects expired signatures and altered payloads',async()=>{
  const now=Date.now(),ts=Math.floor(now/1000)-301;
  const sig=createHmac('sha256','whsec_fixture').update(`${ts}.original`).digest('hex');
  await expect(verifyStripeSignature('original',`t=${ts},v1=${sig}`,'whsec_fixture',now)).rejects.toThrow(/expired/);
  const fresh=Math.floor(now/1000),current=createHmac('sha256','whsec_fixture').update(`${fresh}.original`).digest('hex');
  await expect(verifyStripeSignature('altered',`t=${fresh},v1=${current}`,'whsec_fixture',now)).rejects.toThrow(/mismatch/);
 });
 it('handles leap-year month boundaries',()=>expect(nextMonth('2028-01-31T01:00:00Z')).toBe('2028-02-29T01:00:00.000Z'));
});
