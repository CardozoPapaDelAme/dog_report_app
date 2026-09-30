import { createZoneSet, activateZoneSet } from './zoneSetApi.js';
import { prepareZoneText, validateZoneDraft } from '../models/zoneSet.js';
import { sha256Hex } from '../supabase/functions/api/domain/zoneSet.js';
import { Hono } from 'hono';
import { createZoneRoutes } from '../supabase/functions/api/routes/zoneSets.js';
import { createZoneService } from '../supabase/functions/api/services/zoneService.js';
const id = '00000000-0000-4000-8000-000000000001';
const geometry = {type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]};
const assert = (value) => { if (!value) throw new Error('Assertion failed'); };
Deno.test('FAB-5 INTEGRATION: mobile draft and independent approval reach real FAB-2 Controller/Service', async () => {
  const profile = {id,role:'administrator',active:true};
  let row;
  const audits = [], calls = [];
  const service = createZoneService({getConfig:()=>({expectedEnvironment:'staging'}),getSql:()=>({begin:(operation)=>operation(()=>{})}),repository:{
    readZoneActor:()=>profile,readZoneEnvironment:()=> 'staging',lockZoneEnvironment:()=>{},
    insertZoneSet:(_tx,{values})=>{row={...values,id,environment:'staging',version:1,status:'draft',source_geojson:values.geometry,created_at:'2026-09-29T00:00:00Z'};return id;},
    readZoneSet:()=>row,readActiveZoneSets:()=>[],
    activateZoneSet:(_tx,{associationApprovalReference})=>{row={...row,status:'active',association_approval_reference:associationApprovalReference};},
    insertZoneAudit:(_tx,audit)=>audits.push(audit),
  }});
  const app = new Hono().basePath('/api');
  app.route('/',createZoneRoutes({service,authorize:async(c,next)=>{c.set('auth',{type:'authenticated',userId:id,role:'administrator',profile});await next();}}));
  const request=(path,options)=>{calls.push(path);assert(options.headers.Authorization==='Bearer test-only');return app.request(`/api${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}});};
  const preview = await prepareZoneText(JSON.stringify(geometry),sha256Hex);
  const {input} = validateZoneDraft({name:'Test fixture',source_uri:'https://example.test/zone',source_version:'v1'},preview);
  const created = await createZoneSet({accessToken:'test-only',input,environment:'staging'},request);
  assert(created.status==='draft' && row.status==='draft' && audits.length===1 && calls.length===1);
  try { await activateZoneSet({accessToken:'test-only',id,input:{association_approval_reference:' '}},request);throw new Error('Expected rejection'); }
  catch(error){assert(error.status===400 && error.details.fields.association_approval_reference);}
  assert(row.status==='draft' && audits.length===1);
  const activated = await activateZoneSet({accessToken:'test-only',id,checksum:preview.checksum,environment:'staging',input:{association_approval_reference:'AHC-TEST-1'}},request);
  assert(activated.status==='active' && audits.length===2 && audits[1].note===null);
  assert(calls[0]==='/admin/zone-sets' && calls[2]===`/admin/zone-sets/${id}/activate`);
});
Deno.test('FAB-5 API: no request without session; preserves status, fields and request ID',async()=>{
  let count=0;
  try {await createZoneSet({accessToken:null,input:{}},()=>{count++;});throw new Error('Expected rejection');}
  catch(error){assert(error.status===401 && count===0);}
  const request=()=>new Response(JSON.stringify({error:{code:'invalid_request',message:'Bad geometry',details:{fields:{geometry:'Self-intersection'}}}}),{status:400,headers:{'X-Request-Id':'test-request'}});
  try {await createZoneSet({accessToken:'test-only',input:{}},request);throw new Error('Expected rejection');}
  catch(error){assert(error.status===400 && error.details.fields.geometry==='Self-intersection' && error.requestId==='test-request');}
});
