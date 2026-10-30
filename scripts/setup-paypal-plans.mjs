import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

// Sandbox-only provisioning. Checkpoints survive interruption and never contain secrets.
const env = Object.fromEntries(readFileSync('supabase/.env.local', 'utf8').split('\n')
  .filter(line => line.includes('=') && !line.trim().startsWith('#'))
  .map(line => { const i = line.indexOf('='); return [line.slice(0,i).trim(),line.slice(i+1).trim()]; }));
if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error('Configure PayPal sandbox credentials in ignored supabase/.env.local first.');
const path = '.paypal-sandbox-plans.json';
const fingerprint = createHash('sha256').update(env.PAYPAL_CLIENT_ID).digest('hex');
const state = existsSync(path) ? JSON.parse(readFileSync(path,'utf8')) : { fingerprint, steps:{} };
if (state.fingerprint !== fingerprint) throw new Error('Saved plans belong to another app. Review the manifest before changing accounts.');
const save = () => writeFileSync(path, JSON.stringify(state,null,2)+'\n', {mode:0o600});
const auth = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
  method:'POST', headers:{Authorization:`Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
  'Content-Type':'application/x-www-form-urlencoded'}, body:'grant_type=client_credentials', signal:AbortSignal.timeout(15000)
});
const token = await auth.json();
if (!auth.ok || !token.access_token) throw new Error('PayPal sandbox authentication failed.');
async function create(key, endpoint, body) {
  const previous = state.steps[key];
  if (previous?.id) return previous.id;
  if (previous && Date.now()-previous.started > 5*3600000) throw new Error(`Unresolved ${key}: inspect PayPal before retrying beyond its deduplication window.`);
  const step = previous ?? {requestId:randomUUID(), started:Date.now()};
  state.steps[key] = step; save();
  const response = await fetch(`https://api-m.sandbox.paypal.com${endpoint}`, {
    method:'POST', headers:{Authorization:`Bearer ${token.access_token}`, 'Content-Type':'application/json', 'PayPal-Request-Id':step.requestId},
    body:JSON.stringify(body), signal:AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.id) throw new Error(`PayPal sandbox ${key} failed (${response.status}); retry the same manifest after investigating.`);
  step.id = result.id; save(); return step.id;
}
for (const [tier,value] of [['Gold','9.99'],['Diamond','19.99']]) {
  const productId = await create(`${tier}-product`, '/v1/catalogs/products', {
    name:`[TEST] Find My Mehram ${tier}`, type:'SERVICE', category:'ONLINE_DATING'
  });
  const id = await create(`${tier}-plan`, '/v1/billing/plans', {
    product_id:productId, name:`[TEST] Find My Mehram ${tier} monthly`,
    billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,
      pricing_scheme:{fixed_price:{value,currency_code:'GBP'}}}],
    payment_preferences:{auto_bill_outstanding:true,payment_failure_threshold:1}
  });
  console.log(`PAYPAL_${tier.toUpperCase()}_PLAN_ID=${id}`);
}
