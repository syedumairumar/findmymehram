import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {localConfig} from './local-config.mjs';
const c=localConfig(),admin=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}}),accounts=[];
let count=0;
function check(ok,label){assert.ok(ok,label);console.log(`PASS ${label}`);count++;}
async function must(result){const r=await result;if(r.error)throw r.error;return r.data;}
const eventId=()=>`fixture-${randomUUID()}`;
async function claim(row,event=eventId(),token=randomUUID()){return {event,token,data:await must(admin.rpc('claim_billing_reconcile',{subscription_ref:row.id,event_provider:row.provider,event_ref:event,lease_token:token}))};}
const until=new Date(Date.now()+30*86400000).toISOString();
function finalize(row,lease,changes={}){return admin.rpc('finish_billing_reconcile',{subscription_ref:row.id,event_ref:lease.event,lease_token:lease.token,provider_ref:row.provider==='stripe'?`sub_${row.id.replaceAll('-','')}`:`I-${row.id.replaceAll('-','').toUpperCase()}`,verified_status:'active',verified_until:until,cancel_scheduled:false,payment_rows:[{id:`invoice-${row.id}`,amount:9.99,status:'paid',currency:'GBP'}],...changes});}
try{
 for(let i=0;i<2;i++){
  const email=`billing-${randomUUID()}@mehram.test`,password=`Fixture!${randomBytes(20).toString('hex')}`;
  const u=await must(admin.auth.admin.createUser({email,password,email_confirm:true}));accounts.push({id:u.user.id});
  const client=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false}});await must(client.auth.signInWithPassword({email,password}));accounts[i].client=client;
  await must(client.rpc('save_profile',{details:{name:'Disposable billing test',city:'Test city',birth_date:'1995-01-01',interests:[],languages:[],photo:'',gender:'not specified',terms_accepted:true}}));
 }
 const [a,b]=accounts;
 const racing=await Promise.all([a.client.rpc('reserve_checkout',{chosen_provider:'stripe',chosen_tier:'gold'}),a.client.rpc('reserve_checkout',{chosen_provider:'paypal',chosen_tier:'gold'})]);
 check(racing.filter(r=>!r.error).length===1,'concurrent cross-provider requests reserve only one checkout');
 const row=racing.find(r=>!r.error).data;
 const again=await must(a.client.rpc('reserve_checkout',{chosen_provider:row.provider,chosen_tier:row.tier}));
 check(again.id===row.id,'same-plan retry returns the original checkout identity');
 check((await must(a.client.rpc('my_membership'))).tier==='free','pending checkout never grants premium');
 check((await must(b.client.rpc('my_billing')))===null,'another member cannot read this subscription');
 check(Boolean((await a.client.rpc('claim_billing_reconcile',{subscription_ref:row.id,event_provider:row.provider,event_ref:eventId(),lease_token:randomUUID()})).error),'member cannot claim privileged reconciliation');
 const lease=await claim(row);
 check(Boolean((await admin.rpc('claim_billing_reconcile',{subscription_ref:row.id,event_provider:row.provider,event_ref:eventId(),lease_token:randomUUID()})).error),'concurrent reconcilers cannot read and apply conflicting snapshots');
 const invalid=await finalize(row,lease,{provider_ref:'invalid'});
 check(Boolean(invalid.error),'mismatched provider reference cannot commit entitlement');
 check((await must(a.client.rpc('my_membership'))).tier==='free','failed transaction leaves membership unchanged');
 const receipt=await must(admin.from('payment_events').select('processed_at').eq('event_id',lease.event).single());
 check(receipt.processed_at===null,'failed transaction remains retryable');
 await must(finalize(row,lease));
 check((await must(a.client.rpc('my_membership'))).tier==='gold','verified reconciliation commits the paid tier');
 const duplicate=await claim(row,lease.event);
 check(duplicate.data.duplicate===true,'processed delivery is deduplicated');
 check(Boolean((await finalize(row,lease)).error),'an already-consumed reconciliation lease cannot apply twice');
 check(Boolean((await a.client.rpc('reserve_checkout',{chosen_provider:row.provider==='stripe'?'paypal':'stripe',chosen_tier:'diamond'})).error),'an active paid subscription blocks a second provider');
 const cancellation=await claim(row);await must(finalize(row,cancellation,{verified_status:'cancelled',cancel_scheduled:true}));
 check((await must(a.client.rpc('my_membership'))).tier==='gold','period-end cancellation preserves only paid access');
 check(Boolean((await a.client.rpc('reserve_checkout',{chosen_provider:'stripe',chosen_tier:'diamond'})).error),'cancelled-but-paid access prevents overlapping subscriptions');
 // Simulate a paid period ending without resetting or deleting shared data.
 await must(admin.from('subscriptions').update({paid_until:new Date(Date.now()-1000).toISOString()}).eq('id',row.id));
 const newer=await must(a.client.rpc('reserve_checkout',{chosen_provider:'stripe',chosen_tier:'diamond'}));
 const newerLease=await claim(newer);await must(finalize(newer,newerLease,{payment_rows:[],verified_until:until}));
 check((await must(a.client.rpc('my_membership'))).tier==='diamond','a new checkout can begin after the previous paid period ends');
 const historical=await claim(row);await must(finalize(row,historical,{verified_status:'cancelled',verified_until:null,cancel_scheduled:false,payment_rows:[]}));
 check((await must(a.client.rpc('my_membership'))).tier==='diamond','old cancellation cannot overwrite a newer subscription entitlement');
 const wrongLease=await claim(newer);
 await must(admin.from('subscriptions').update({reconcile_until:new Date(Date.now()-1000).toISOString()}).eq('id',newer.id));
 check(Boolean((await finalize(newer,wrongLease)).error),'an expired reconciliation worker cannot overwrite fresh state');
 const fresh=await claim(newer);await must(finalize(newer,fresh,{verified_until:null,verified_status:'past_due',payment_rows:[]}));
 check((await must(a.client.rpc('my_membership'))).tier==='free','no confirmed paid period removes premium access');
 console.log(`All ${count} billing database checks passed.`);
}finally{for(const a of accounts)await admin.auth.admin.deleteUser(a.id);}
