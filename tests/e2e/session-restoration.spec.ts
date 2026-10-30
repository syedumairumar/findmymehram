import {test,expect} from '@playwright/test';

test('a restored member keeps the billing return URL while their profile loads', async ({page}) => {
  const id='22222222-2222-4222-8222-222222222222';
  const now=Math.floor(Date.now()/1000);
  const payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600})).toString('base64url');
  // Fabricated credentials belong only to the intercepted test origin.
  const session={access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,refresh_token:'fixture-only',token_type:'bearer',expires_at:now+3600,expires_in:3600,
    user:{id,aud:'authenticated',role:'authenticated',email:'fixture@mehram.test',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()}};
  await page.addInitScript(value=>localStorage.setItem('sb-restoration-test-auth-token',JSON.stringify(value)),session);
  await page.route('https://restoration-test.supabase.co/**', async route=>{
    const name=new URL(route.request().url()).pathname.split('/').at(-1);
    const values:Record<string,unknown>={
      my_profile:{id,name:'Fictional member',age:30,city:'Test city',profession:'Test profession',gender:'not specified',intent:'Marriage-minded',bio:'Test fixture',interests:[],languages:[],photo:''},
      my_membership:{tier:'free',source:'free',expires_at:null},my_matches:[],can_admin:false,
    };
    if(name==='my_profile')await new Promise(resolve=>setTimeout(resolve,700));
    if(!(name! in values))throw new Error(`Unexpected test backend request: ${name}`);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(values[name!])});
  });
  const profileRequest=page.waitForRequest('https://restoration-test.supabase.co/rest/v1/rpc/my_profile');
  await page.goto('/membership?checkout=pending');
  await profileRequest;
  await expect(page).toHaveURL(/\/membership\?checkout=pending$/);
  await expect(page.getByRole('heading',{name:'A little more connection.'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'A little more connection.'})).toBeVisible();
  await expect(page).toHaveURL(/\/membership\?checkout=pending$/);
});
