import {authenticate,limitedBody,originAllowed,response,service} from '../_shared/http.ts';
import {appUrl,createCheckout,paypalRequest,reconcile,requireSandboxPayments,stripeRequest,validatePlan} from '../_shared/payments.ts';
import type {Checkout,PaidTier} from '../_shared/payments.ts';
Deno.serve(async(req)=>{
 if(!originAllowed(req))return response(req,{error:'Origin not permitted.'},403);
 if(req.method==='OPTIONS')return response(req,{});
 if(req.method!=='POST')return response(req,{error:'Method not allowed.'},405);
 try {
  requireSandboxPayments();appUrl();
  const {db,user}=await authenticate(req),admin=service();
  const input=JSON.parse(new TextDecoder().decode(await limitedBody(req,2048)));
  if(!['checkout','cancel','sync','status'].includes(input.action))throw new Error('Unsupported billing action.');
  // Also checks suspension/paused status server-side; no service-role bypass.
  const own=await db.rpc('my_billing');if(own.error)throw own.error;
  if(input.action==='checkout'){
   const provider=input.provider,tier=input.tier as PaidTier;
   if(!['stripe','paypal'].includes(provider)||!['gold','diamond'].includes(tier))throw new Error('Choose a sandbox payment method and plan.');
   await validatePlan(provider,tier);
   const reservation=await db.rpc('reserve_checkout',{chosen_provider:provider,chosen_tier:tier});if(reservation.error)throw reservation.error;
   const row=reservation.data as Checkout;
   const url=await createCheckout(admin,row,user.email??'');return response(req,{url});
  }
  if(!own.data)return response(req,{subscription:null});
  const result=await admin.from('subscriptions').select('*').eq('id',own.data.id).eq('user_id',user.id).single();if(result.error)throw result.error;
  let row=result.data as Checkout;
  if(input.action==='status')return response(req,{subscription:own.data});
  // Rate-limit provider reads for browser refreshes without preventing cancellation.
  if(input.action==='sync'&&row.reconciled_at&&Date.parse(row.reconciled_at)>Date.now()-10000)return response(req,{subscription:own.data});
  await reconcile(admin,row,`sync:${crypto.randomUUID()}`);
  const refreshed=await admin.from('subscriptions').select('*').eq('id',row.id).eq('user_id',user.id).single();if(refreshed.error)throw refreshed.error;row=refreshed.data as Checkout;
  if(input.action==='cancel'){
   if(['cancelled','expired'].includes(row.status))return response(req,{cancelled:true});
   if(row.provider==='stripe'){
    if(row.provider_id)await stripeRequest(`/v1/subscriptions/${encodeURIComponent(row.provider_id)}`,{cancel_at_period_end:'true'},'POST',`cancel-${row.id}`);
    else if(row.checkout_id)await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(row.checkout_id)}/expire`,{},'POST',`expire-${row.id}`);
    else throw new Error('Checkout creation is unresolved. Retry the same plan or contact the test owner before cancelling.');
   }else{
    if(!row.provider_id)throw new Error('Checkout creation is unresolved. Contact the test owner.');
    await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(row.provider_id)}/cancel`,{reason:'Customer cancelled the sandbox membership.'},'POST',`cancel-${row.id}`);
   }
   await reconcile(admin,row,`cancel:${crypto.randomUUID()}`);
  }
  const status=await db.rpc('my_billing');if(status.error)throw status.error;
  return response(req,{subscription:status.data,cancelled:input.action==='cancel'});
 }catch{return response(req,{error:'Billing could not complete. No access was granted from this request. Please refresh billing status or contact the test owner.'},400);}
});
