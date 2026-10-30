export const sandboxCheckoutHosts = [
  "checkout.stripe.com",
  "www.sandbox.paypal.com",
  "sandbox.paypal.com",
] as const;

export function assertSandboxStripeSecret(secret: string) {
  if (!secret.startsWith("sk_test_")) {
    throw new Error("Only a Stripe test secret can be used in this release.");
  }
}

export function assertSandboxStripeWebhookSecret(secret: string) {
  if (!secret.startsWith("whsec_")) {
    throw new Error("Stripe webhook signing secret is not configured.");
  }
}

export function assertSandboxPriceId(id: string) {
  if (!/^price_[A-Za-z0-9]+$/.test(id)) {
    throw new Error("Stripe price is not configured.");
  }
}

export function tierFromConfiguredPrice(
  priceId: string,
  goldPriceId: string,
  diamondPriceId: string,
): "gold" | "diamond" {
  if (priceId === goldPriceId) return "gold";
  if (priceId === diamondPriceId) return "diamond";
  throw new Error("Unrecognised sandbox price.");
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function equalHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  nowMs = Date.now(),
) {
  assertSandboxStripeWebhookSecret(secret);
  const timestamp = header.match(/(?:^|,)t=(\d+)/)?.[1];
  const signatures = [...header.matchAll(/(?:^|,)v1=([a-f0-9]+)/g)].map(
    (match) => match[1],
  );
  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe signature.");
  }
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > 300) {
    throw new Error("Stripe signature expired.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`),
    ),
  );
  if (!signatures.some((signature) => equalHex(signature, expected))) {
    throw new Error("Stripe signature mismatch.");
  }
}

export function paidUntilFromUnix(seconds: unknown) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

export type PaidTier = 'gold' | 'diamond';
export type BillingStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired';
export interface PaymentRow { id:string; amount:number; currency:'GBP'; status:'paid'|'failed'|'refunded'|'disputed' }
export interface VerifiedBilling { providerId:string; status:BillingStatus; paidUntil:string|null; cancelAtPeriodEnd:boolean; payments:PaymentRow[] }
export const monthlyMinor = {gold:999,diamond:1999} as const;
export function assertCheckoutUrl(url:string) {
 const parsed=new URL(url);
 if(parsed.protocol!=='https:' || !sandboxCheckoutHosts.some(host=>host===parsed.hostname) || parsed.username || parsed.password) throw new Error('Unexpected checkout destination.');
 return parsed.href;
}
export function nextMonth(time:string):string {
 const d=new Date(time);
 if(!Number.isFinite(d.getTime())) throw new Error('Invalid settlement date.');
 const day=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+1);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,last)); return d.toISOString();
}
export interface StripePrice {id:string;currency:string;unit_amount:number;recurring?:{interval:string;interval_count:number};livemode:boolean}
export function validateStripePrice(p:StripePrice,id:string,tier:PaidTier) {
 if(p.id!==id||p.livemode!==false||p.currency!=='gbp'||p.unit_amount!==monthlyMinor[tier]||p.recurring?.interval!=='month'||p.recurring.interval_count!==1) throw new Error('Unexpected sandbox monthly price.');
}
export interface StripeSubscription {id:string;livemode:boolean;status:string;cancel_at_period_end:boolean;metadata:Record<string,string>;items:{data:{price:StripePrice;quantity:number}[]}}
export interface StripeInvoice {id:string;livemode:boolean;subscription:string;status:string;paid:boolean;amount_paid:number;currency:string;charge?:{id:string;paid:boolean;refunded:boolean;disputed:boolean;amount_refunded:number;amount:number;livemode:boolean}|null;lines:{data:{price?:{id:string};period:{start:number;end:number}}[]}}
export function stripeSettlement(sub:StripeSubscription,invoices:StripeInvoice[],priceId:string,tier:PaidTier,internalId:string,userId:string):VerifiedBilling {
 if(sub.livemode!==false||sub.metadata.internal_subscription_id!==internalId||sub.metadata.user_id!==userId||sub.metadata.tier!==tier||sub.items.data.length!==1||sub.items.data[0].quantity!==1) throw new Error('Subscription account or plan binding mismatch.');
 validateStripePrice(sub.items.data[0].price,priceId,tier);
 let paidUntil:string|null=null;
 const payments:PaymentRow[]=[];
 for(const inv of invoices) {
  if(inv.livemode!==false||inv.subscription!==sub.id||inv.currency!=='gbp') throw new Error('Invoice environment, currency or subscription mismatch.');
  const charge=inv.charge;
  const settled=inv.paid&&inv.status==='paid'&&inv.amount_paid>=monthlyMinor[tier]&&charge?.paid&&charge.livemode===false;
  const disputed=Boolean(charge?.disputed),refunded=Boolean(charge?.refunded);
  if(inv.amount_paid>0) payments.push({id:inv.id,amount:inv.amount_paid/100,currency:'GBP',status:disputed?'disputed':refunded?'refunded':settled?'paid':'failed'});
  if(!settled||disputed||refunded) continue;
  for(const line of inv.lines.data) if(line.price?.id===priceId) {
   const end=paidUntilFromUnix(line.period.end);
   if(end&&(!paidUntil||end>paidUntil))paidUntil=end;
  }
 }
 const status:BillingStatus=sub.status==='active'?'active':['past_due','unpaid'].includes(sub.status)?'past_due':sub.status==='canceled'?'cancelled':sub.status==='incomplete'?'pending':'expired';
 // Trialing, voided or uncharged invoices never grant paid access.
 return {providerId:sub.id,status,paidUntil:status==='expired'?null:paidUntil,cancelAtPeriodEnd:sub.cancel_at_period_end||status==='cancelled',payments};
}
export interface PayPalPlan {id:string;status:string;billing_cycles:{tenure_type:string;total_cycles:number;frequency:{interval_unit:string;interval_count:number};pricing_scheme?:{fixed_price?:{value:string;currency_code:string}}}[];payment_preferences?:{setup_fee?:{value:string}}}
export function validatePayPalPlan(p:PayPalPlan,id:string,tier:PaidTier) {
 const cycles=p.billing_cycles,cycle=cycles[0],fixed=cycle?.pricing_scheme?.fixed_price;
 if(p.id!==id||!['ACTIVE','CREATED'].includes(p.status)||cycles.length!==1||cycle.tenure_type!=='REGULAR'||cycle.total_cycles!==0||cycle.frequency.interval_unit!=='MONTH'||cycle.frequency.interval_count!==1||fixed?.currency_code!=='GBP'||Math.round(Number(fixed.value)*100)!==monthlyMinor[tier]||Number(p.payment_preferences?.setup_fee?.value??0)!==0) throw new Error('Unexpected sandbox PayPal monthly plan.');
}
export interface PayPalSubscription {id:string;custom_id:string;plan_id:string;status:string;quantity?:string;plan_overridden?:boolean}
export interface PayPalSale {id:string;state:string;amount:{total:string;currency:string};create_time:string;billing_agreement_id?:string}
export function paypalSettlement(sub:PayPalSubscription,sales:PayPalSale[],planId:string,tier:PaidTier,internalId:string):VerifiedBilling {
 if(sub.custom_id!==internalId||sub.plan_id!==planId||sub.plan_overridden||Number(sub.quantity??1)!==1) throw new Error('PayPal checkout binding mismatch.');
 let paidUntil:string|null=null;
 const payments:PaymentRow[]=[];
 for(const sale of sales) {
  if(sale.billing_agreement_id&&sale.billing_agreement_id!==sub.id)throw new Error('PayPal sale belongs to another subscription.');
  const amount=Number(sale.amount.total);
  if(sale.amount.currency!=='GBP'||!Number.isFinite(amount)||amount<0)throw new Error('Unexpected PayPal settlement currency.');
  const refunded=sale.state==='refunded',settled=sale.state==='completed'||sale.state==='partially_refunded';
  payments.push({id:sale.id,amount,currency:'GBP',status:refunded?'refunded':settled?'paid':'failed'});
  if(settled&&Math.round(amount*100)>=monthlyMinor[tier]) {
   const end=nextMonth(sale.create_time); if(!paidUntil||end>paidUntil)paidUntil=end;
  }
 }
 const status:BillingStatus=sub.status==='ACTIVE'?'active':sub.status==='SUSPENDED'?'past_due':sub.status==='CANCELLED'?'cancelled':['APPROVAL_PENDING','APPROVED'].includes(sub.status)?'pending':'expired';
 return {providerId:sub.id,status,paidUntil:status==='expired'?null:paidUntil,cancelAtPeriodEnd:status==='cancelled',payments};
}
