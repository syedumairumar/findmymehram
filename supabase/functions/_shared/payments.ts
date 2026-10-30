import {service} from './http.ts';
import {assertSandboxStripeSecret,assertSandboxPriceId,assertCheckoutUrl,verifyStripeSignature as verifySignature,stripeSettlement,paypalSettlement,validatePayPalPlan,validateStripePrice} from './billing-policy.ts';
import type {PaidTier,VerifiedBilling,StripeSubscription,StripeInvoice,StripePrice,PayPalSubscription,PayPalPlan,PayPalSale} from './billing-policy.ts';
export type {PaidTier} from './billing-policy.ts';
type Admin=ReturnType<typeof service>;
export interface Checkout {id:string;user_id:string;provider:'stripe'|'paypal';tier:PaidTier;status:string;provider_id:string|null;checkout_id:string|null;checkout_url:string|null;created_at:string;paid_until:string|null;cancel_at_period_end:boolean;reconciled_at:string|null}
export function requireSandboxPayments(){if(Deno.env.get('PAYMENTS_ENABLED')!=='true'||Deno.env.get('PAYMENTS_ENVIRONMENT')!=='sandbox')throw new Error('Sandbox payments are not enabled.');}
export function stripePriceId(tier:PaidTier){const id=Deno.env.get(tier==='gold'?'STRIPE_GOLD_PRICE_ID':'STRIPE_DIAMOND_PRICE_ID')??'';assertSandboxPriceId(id);return id;}
export function paypalPlanId(tier:PaidTier){const id=Deno.env.get(tier==='gold'?'PAYPAL_GOLD_PLAN_ID':'PAYPAL_DIAMOND_PLAN_ID')??'';if(!/^P-[A-Z0-9]+$/.test(id))throw new Error('PayPal sandbox plan is not configured.');return id;}
export function appUrl(){const u=new URL(Deno.env.get('APP_URL')??'http://127.0.0.1:5173');if(u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw new Error('HTTPS app origin required.');return u.origin;}
export async function verifyStripeSignature(payload:string,header:string){await verifySignature(payload,header,Deno.env.get('STRIPE_WEBHOOK_SECRET')??'');}
export async function stripeRequest<T=Record<string,unknown>>(path:string,params?:Record<string,string>,method='POST',idempotency?:string):Promise<T>{
 const secret=Deno.env.get('STRIPE_SECRET_KEY')??'';assertSandboxStripeSecret(secret);
 const res=await fetch(`https://api.stripe.com${path}`,{method,headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded','Stripe-Version':'2024-06-20',...(idempotency?{'Idempotency-Key':idempotency}:{})},body:method==='GET'||!params?undefined:new URLSearchParams(params),signal:AbortSignal.timeout(15000)});
 if(!res.ok){await res.body?.cancel();throw new Error(`Stripe request failed (${res.status}); reconcile before retrying.`);}return await res.json() as T;
}
let paypalToken:{token:string;until:number}|undefined;
async function paypalAccessToken(){
 if(paypalToken&&paypalToken.until>Date.now())return paypalToken.token;
 const id=Deno.env.get('PAYPAL_CLIENT_ID'),secret=Deno.env.get('PAYPAL_CLIENT_SECRET');if(!id||!secret)throw new Error('PayPal sandbox credentials are not configured.');
 const res=await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${btoa(`${id}:${secret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw new Error('PayPal sandbox authentication failed.');
 const data=await res.json();if(typeof data.access_token!=='string')throw new Error('PayPal sandbox authentication failed.');
 paypalToken={token:data.access_token,until:Date.now()+Math.min(300,Number(data.expires_in)||60)*1000};return paypalToken.token;
}
export async function paypalRequest<T=Record<string,unknown>>(path:string,body?:unknown,method='POST',idempotency?:string):Promise<T>{
 const token=await paypalAccessToken();const res=await fetch(`https://api-m.sandbox.paypal.com${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(idempotency?{'PayPal-Request-Id':idempotency}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!res.ok){await res.body?.cancel();throw new Error(`PayPal request failed (${res.status}); reconcile before retrying.`);}const text=await res.text();return (text?JSON.parse(text):{}) as T;
}
export async function verifyPayPalWebhook(headers:Headers,event:unknown){
 const webhookId=Deno.env.get('PAYPAL_WEBHOOK_ID');if(!webhookId)throw new Error('PayPal webhook is not configured.');
 const names=['paypal-transmission-id','paypal-transmission-time','paypal-cert-url','paypal-auth-algo','paypal-transmission-sig'];const values=names.map(n=>headers.get(n));if(values.some(v=>!v))throw new Error('Missing PayPal signature.');
 const cert=new URL(values[2]!);if(cert.protocol!=='https:'||!['api.sandbox.paypal.com','api-m.sandbox.paypal.com'].includes(cert.hostname)||cert.username||cert.password)throw new Error('Invalid sandbox certificate.');
 const result=await paypalRequest<{verification_status:string}>('/v1/notifications/verify-webhook-signature',{transmission_id:values[0],transmission_time:values[1],cert_url:values[2],auth_algo:values[3],transmission_sig:values[4],webhook_id:webhookId,webhook_event:event});if(result.verification_status!=='SUCCESS')throw new Error('PayPal signature mismatch.');
}
export async function validatePlan(provider:'stripe'|'paypal',tier:PaidTier){
 if(provider==='stripe'){const id=stripePriceId(tier);validateStripePrice(await stripeRequest<StripePrice>(`/v1/prices/${id}`,undefined,'GET'),id,tier);}
 else {const id=paypalPlanId(tier);validatePayPalPlan(await paypalRequest<PayPalPlan>(`/v1/billing/plans/${id}`,undefined,'GET'),id,tier);}
}
export async function storeCheckout(admin:Admin,row:Checkout,id:string,url:string){
 assertCheckoutUrl(url);
 const result=await admin.from('subscriptions').update(row.provider==='stripe'?{checkout_id:id,checkout_url:url}:{provider_id:id,checkout_url:url}).eq('id',row.id);
 if(result.error)throw result.error;
}
export async function createCheckout(admin:Admin,row:Checkout,email:string){
 if(row.checkout_url)return assertCheckoutUrl(row.checkout_url);
 // Provider idempotency prevents concurrent/retried requests creating two charges.
 // Never reuse an aged key after its provider deduplication window.
 if(Date.parse(row.created_at)<Date.now()-5*3600_000)throw new Error('This unfinished checkout needs owner reconciliation before it can be retried.');
 if(row.provider==='stripe'){
 const result=await stripeRequest<{id:string;url:string}>('/v1/checkout/sessions',{mode:'subscription',success_url:`${appUrl()}/membership?checkout=pending`,cancel_url:`${appUrl()}/membership?checkout=cancelled`,client_reference_id:row.id,customer_email:email,'payment_method_types[0]':'card','line_items[0][price]':stripePriceId(row.tier),'line_items[0][quantity]':'1','metadata[internal_subscription_id]':row.id,'subscription_data[metadata][internal_subscription_id]':row.id,'subscription_data[metadata][user_id]':row.user_id,'subscription_data[metadata][tier]':row.tier},'POST',row.id);
 await storeCheckout(admin,row,result.id,result.url);return assertCheckoutUrl(result.url);
 }
 const result=await paypalRequest<{id:string;links:{rel:string;href:string}[]}>('/v1/billing/subscriptions',{plan_id:paypalPlanId(row.tier),custom_id:row.id,application_context:{brand_name:'Find My Mehram Test',user_action:'SUBSCRIBE_NOW',shipping_preference:'NO_SHIPPING',return_url:`${appUrl()}/membership?checkout=pending`,cancel_url:`${appUrl()}/membership?checkout=cancelled`}},'POST',row.id);
 const url=result.links?.find(l=>l.rel==='approve')?.href;if(!url)throw new Error('PayPal did not return an approval URL.');await storeCheckout(admin,row,result.id,url);return assertCheckoutUrl(url);
}
async function stripeSnapshot(row:Checkout,providerId:string):Promise<VerifiedBilling>{
 const sub=await stripeRequest<StripeSubscription>(`/v1/subscriptions/${providerId}?expand[]=items.data.price`,undefined,'GET');
 const invoices=await stripeRequest<{data:StripeInvoice[]}>(`/v1/invoices?subscription=${providerId}&limit=12&expand[]=data.charge`,undefined,'GET');
 return stripeSettlement(sub,invoices.data,stripePriceId(row.tier),row.tier,row.id,row.user_id);
}
async function paypalSnapshot(row:Checkout,providerId:string):Promise<VerifiedBilling>{
 const sub=await paypalRequest<PayPalSubscription>(`/v1/billing/subscriptions/${providerId}`,undefined,'GET');
 const planId=paypalPlanId(row.tier);validatePayPalPlan(await paypalRequest<PayPalPlan>(`/v1/billing/plans/${planId}`,undefined,'GET'),planId,row.tier);
 const start=new Date(Date.now()-40*86400_000).toISOString(),end=new Date().toISOString();
 const tx=await paypalRequest<{transactions:{id:string}[];total_pages:number}>(`/v1/billing/subscriptions/${providerId}/transactions?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`,undefined,'GET');
 if(tx.total_pages>1||tx.transactions.length>10)throw new Error('Payment history requires operator reconciliation.');
 const sales:PayPalSale[]=[];for(const t of tx.transactions)sales.push(await paypalRequest<PayPalSale>(`/v1/payments/sale/${encodeURIComponent(t.id)}`,undefined,'GET'));
 return paypalSettlement(sub,sales,planId,row.tier,row.id);
}
export async function reconcile(admin:Admin,row:Checkout,eventId:string,providerId?:string){
 const token=crypto.randomUUID();
 const claim=await admin.rpc('claim_billing_reconcile',{subscription_ref:row.id,event_provider:row.provider,event_ref:eventId,lease_token:token});if(claim.error)throw claim.error;if(claim.data.duplicate)return;
 try {
  const current=claim.data as Checkout;
  let id=current.provider_id??providerId;
  if(current.provider==='stripe'&&!id&&current.checkout_id){
   const session=await stripeRequest<{status:string;subscription:string|null;client_reference_id:string}>(`/v1/checkout/sessions/${current.checkout_id}`,undefined,'GET');
   if(session.client_reference_id!==row.id)throw new Error('Checkout binding mismatch.');
   if(session.status==='expired'){
    const done=await admin.from('subscriptions').update({status:'expired',reconcile_token:null,reconcile_until:null,reconciled_at:new Date().toISOString()}).eq('id',row.id).eq('reconcile_token',token);if(done.error)throw done.error;return;
   }
   id=session.subscription??undefined;
  }
  if(!id){await admin.rpc('release_billing_reconcile',{subscription_ref:row.id,lease_token:token});return;}
  if(row.provider==='stripe'&&!/^sub_[A-Za-z0-9]+$/.test(id)||row.provider==='paypal'&&!/^I-[A-Z0-9]+$/.test(id))throw new Error('Invalid subscription reference.');
  const snapshot=row.provider==='stripe'?await stripeSnapshot(current,id):await paypalSnapshot(current,id);
  const done=await admin.rpc('finish_billing_reconcile',{subscription_ref:row.id,event_ref:eventId,lease_token:token,provider_ref:snapshot.providerId,verified_status:snapshot.status,verified_until:snapshot.paidUntil,cancel_scheduled:snapshot.cancelAtPeriodEnd,payment_rows:snapshot.payments});if(done.error)throw done.error;
 }catch(error){await admin.rpc('release_billing_reconcile',{subscription_ref:row.id,lease_token:token});throw error;}
}
export async function subscriptionForProvider(admin:Admin,provider:'stripe'|'paypal',id:string){
 const sub=provider==='stripe'?await stripeRequest<StripeSubscription>(`/v1/subscriptions/${encodeURIComponent(id)}`,undefined,'GET'):await paypalRequest<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`,undefined,'GET');
 const internalId='metadata' in sub?sub.metadata.internal_subscription_id:sub.custom_id;
 if(typeof internalId!=='string'||!/^[a-f0-9-]{36}$/i.test(internalId))return null;
 const result=await admin.from('subscriptions').select('*').eq('id',internalId).eq('provider',provider).eq('environment','sandbox').maybeSingle();if(result.error)throw result.error;return result.data as Checkout|null;
}
