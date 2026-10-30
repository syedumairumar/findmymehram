import {limitedBody,response,service} from '../_shared/http.ts';
import {paypalRequest,reconcile,requireSandboxPayments,stripeRequest,subscriptionForProvider,verifyPayPalWebhook,verifyStripeSignature} from '../_shared/payments.ts';
type StripeEvent={id:string;type:string;livemode:boolean;data:{object:{id?:string;mode?:string;subscription?:string;invoice?:string;charge?:string;parent?:{subscription_details?:{subscription?:string}}}}};
Deno.serve(async(req)=>{
 if(req.method!=='POST')return response(req,{error:'Method not allowed.'},405);
 let verified=false;
 try {
  requireSandboxPayments();const raw=new TextDecoder().decode(await limitedBody(req,262144));const admin=service();
  const stripeHeader=req.headers.get('stripe-signature');
  if(stripeHeader){
   await verifyStripeSignature(raw,stripeHeader);verified=true;
   const event=JSON.parse(raw) as StripeEvent;
   if(event.livemode!==false||!/^evt_[A-Za-z0-9]+$/.test(event.id))throw new Error('Invalid sandbox event.');
   const type=event.type,obj=event.data?.object; if(!obj)return response(req,{ignored:true});
   const allowed=['checkout.session.completed','checkout.session.expired','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','charge.refunded','charge.dispute.created','charge.dispute.closed'];
   if(!allowed.includes(type))return response(req,{ignored:true});
   let id=obj.subscription??obj.parent?.subscription_details?.subscription;
   if(type.startsWith('customer.subscription.'))id=obj.id;
   if(type==='checkout.session.expired'){
    // The next owner/member sync verifies expiration directly with Stripe.
    return response(req,{ok:true});
   }
   if(type.startsWith('charge.')){
    const chargeId=type.startsWith('charge.dispute.')?obj.charge:obj.id;
    if(!chargeId||!/^ch_[A-Za-z0-9]+$/.test(chargeId))return response(req,{ignored:true});
    const charge=await stripeRequest<{invoice:string|null}>(`/v1/charges/${chargeId}`,undefined,'GET');
    if(!charge.invoice)return response(req,{ignored:true});
    const invoice=await stripeRequest<{subscription:string|null}>(`/v1/invoices/${encodeURIComponent(charge.invoice)}`,undefined,'GET');id=invoice.subscription??undefined;
   }
   if(!id||!/^sub_[A-Za-z0-9]+$/.test(id))return response(req,{ignored:true});
   const row=await subscriptionForProvider(admin,'stripe',id);if(!row)return response(req,{ignored:true});
   await reconcile(admin,row,event.id,id);return response(req,{ok:true});
  }
  if(req.headers.get('paypal-transmission-id')){
   const event=JSON.parse(raw);await verifyPayPalWebhook(req.headers,event);verified=true;
   if(typeof event.id!=='string'||event.id.length>160)throw new Error('Invalid event.');
   const type=String(event.event_type??''),resource=event.resource??{};
   if(!['BILLING.SUBSCRIPTION.CREATED','BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.UPDATED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.PAYMENT.FAILED','PAYMENT.SALE.COMPLETED','PAYMENT.SALE.DENIED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(type))return response(req,{ignored:true});
   let id=type.startsWith('BILLING.SUBSCRIPTION.')?resource.id:resource.billing_agreement_id;
   // Refund events may carry only the sale reference, not the agreement ID.
   if(!id&&type==='PAYMENT.SALE.REFUNDED'&&typeof resource.sale_id==='string'){
    const sale=await paypalRequest<{billing_agreement_id?:string}>(`/v1/payments/sale/${encodeURIComponent(resource.sale_id)}`,undefined,'GET');id=sale.billing_agreement_id;
   }
   if(typeof id!=='string'||!/^I-[A-Z0-9]+$/.test(id))return response(req,{ignored:true});
   const row=await subscriptionForProvider(admin,'paypal',id);if(!row)return response(req,{ignored:true});
   await reconcile(admin,row,event.id,id);return response(req,{ok:true});
  }
  return response(req,{error:'Provider signature required.'},400);
 }catch{
  // Valid delivery that cannot yet reconcile must be retried by the provider.
  return response(req,{error:verified?'Reconciliation unavailable; retry delivery.':'Invalid provider signature.'},verified?503:400);
 }
});
