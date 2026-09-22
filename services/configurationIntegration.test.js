import { Hono } from 'hono';
import { getConfiguration, publishConfiguration } from './configurationApi.js';
import { configurationFieldErrors, configurationToDraft, validateConfigurationDraft } from '../models/configuration.js';
import { createConfigurationRoutes } from '../supabase/functions/api/routes/configuration.js';
import { createConfigurationService } from '../supabase/functions/api/services/configuration-service.js';
const initial = {id:'00000000-0000-4000-8000-000000000002',environment:'staging',version:1,is_active:true,flag_auto_hide_threshold:5,duplicate_radius_meters:150,duplicate_time_window_minutes:120,trust_high_threshold:0.8,trust_medium_threshold:0.5,gps_accuracy_max_meters:50,report_rate_limit_per_hour:10,flag_rate_limit_per_hour:30,change_note:'Initial'};
const userId='00000000-0000-4000-8000-000000000001';
function assert(value,message='Assertion failed'){if(!value)throw new Error(message);}
Deno.test('FAB-4 INTEGRATION: mobile adapter publishes through real FAB-1 Controller and Service',async()=>{
  const rows=[{...initial}],audits=[];
  const profile={id:userId,role:'administrator',active:true};
  const service=createConfigurationService({
    getConfig:()=>({expectedEnvironment:'staging'}), getSql:()=>({begin:(operation)=>operation(()=>{})}),
    repository:{
      readConfigurationActor:()=>profile, readConfigurationEnvironment:()=> 'staging', lockConfigurationEnvironment:()=>{},
      readActiveConfiguration:()=>({configuration:{...rows.find((row)=>row.is_active)},zone_set:null}),
      insertConfigurationVersion:(_tx,{values})=>{const id=crypto.randomUUID();rows.push({...values,id,environment:'staging',version:rows.length+1,is_active:false});return id;},
      activateConfigurationVersion:(_tx,{id})=>rows.forEach((row)=>{row.is_active=row.id===id;}),
      insertConfigurationAudit:(_tx,audit)=>audits.push(audit),
    },
  });
  const app=new Hono().basePath('/api');
  app.route('/',createConfigurationRoutes({service,authorize:async(c,next)=>{c.set('auth',{type:'authenticated',userId,role:'administrator',profile});await next();}}));
  // Reproduce apiClient's default JSON headers while routing entirely in memory.
  const request=(path,options)=>app.request(`/api${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const before=await getConfiguration({accessToken:'test-only'},request);
  const draft={...configurationToDraft(before.configuration),gps_accuracy_max_meters:'12,25',change_note:'Review'};
  const {payload}=validateConfigurationDraft(draft);
  const after=await publishConfiguration({accessToken:'test-only',input:payload},request);
  assert(after.configuration.version===2 && after.configuration.gps_accuracy_max_meters===12.25);
  assert(rows[0].gps_accuracy_max_meters===50 && !rows[0].is_active && audits.length===1);
  try {
    await publishConfiguration({accessToken:'test-only',input:{...payload,gps_accuracy_max_meters:501}},request);
    throw new Error('Expected server validation failure');
  } catch(error) {
    assert(error.status===400 && configurationFieldErrors(error).gps_accuracy_max_meters==='Must be a number between 5 and 500.');
  }
  assert(rows.length===2 && audits.length===1);
});
