import { Hono } from 'hono';
import { getDuplicateCandidates, getDuplicateGroups, resolveDuplicateGroup, reverseDuplicateGroup } from './duplicateApi.js';
import { createDuplicateRoutes } from '../supabase/functions/api/routes/duplicateGroups.js';
import { actor, assert, duplicateFixture, input, uuid } from '../supabase/functions/api/tests/helpers/duplicateFixture.js';
Deno.test('FAB-6 INTEGRATION: mobile adapter reads graph, resolves and reverses through real FAB-3',async()=>{
  const fixture=duplicateFixture();
  const app=new Hono().basePath('/api');
  app.route('/',createDuplicateRoutes({service:fixture.service,authorize:async(c,next)=>{c.set('auth',actor);await next();}}));
  const calls=[];
  const request=(path,options)=>{calls.push(path);assert(options.headers.Authorization==='Bearer test-only');return app.request(`/api${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}});};
  const session={accessToken:'test-only'};
  assert((await getDuplicateCandidates(session,request)).candidates.length===2);
  const group=await resolveDuplicateGroup({...session,input},request);
  assert(group.status==='active' && (await getDuplicateGroups(session,request)).length===1);
  assert((await getDuplicateCandidates(session,request)).candidates.length===0);
  const reversed=await reverseDuplicateGroup({...session,groupId:group.id,input:{note:'Review again'}},request);
  assert(reversed.status==='reversed' && (await getDuplicateCandidates(session,request)).candidates.length===2);
  assert(fixture.state().reports.every((r)=>r.status==='visible'));
  assert(calls.includes('/admin/duplicate-groups') && calls.includes(`/admin/duplicate-groups/${group.id}/reverse`));
});
Deno.test('FAB-6 API: preserves field errors and request IDs; fails closed without session or with wrong success',async()=>{
  let calls=0;
  try{await getDuplicateGroups({accessToken:null},()=>{calls++;});throw new Error('Expected failure');}
  catch(error){assert(error.status===401 && calls===0);}
  try{
    await resolveDuplicateGroup({accessToken:'test',input},()=>new Response(JSON.stringify({error:{code:'invalid_request',details:{fields:{note:'Exact reason error'}}}}),{status:400,headers:{'X-Request-Id':'request-test'}}));
    throw new Error('Expected failure');
  }catch(error){assert(error.details.fields.note==='Exact reason error' && error.requestId==='request-test');}
  const group={id:uuid(200),status:'active',canonical_report_id:uuid(2),report_ids:input.report_ids,resolution_version:1};
  try{await resolveDuplicateGroup({accessToken:'test',input},()=>new Response(JSON.stringify({data:{duplicate_group:group}})));throw new Error('Expected failure');}
  catch(error){assert(error.code==='invalid_response');}
});
