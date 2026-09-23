import { getConfiguration, publishConfiguration } from './configurationApi.js';
import { configurationToDraft, validateConfigurationDraft } from '../models/configuration.js';
const configuration={id:'config-1',environment:'staging',version:1,is_active:true,flag_auto_hide_threshold:5,duplicate_radius_meters:150,duplicate_time_window_minutes:120,trust_high_threshold:0.8,trust_medium_threshold:0.5,gps_accuracy_max_meters:50,report_rate_limit_per_hour:10,flag_rate_limit_per_hour:30};
function assert(value,message='Assertion failed'){if(!value)throw new Error(message);}
Deno.test('FAB-4 API: GET and complete POST use the existing prefix and Bearer session',async()=>{
  const calls=[];
  const request=async(path,options)=>{calls.push({path,options});return Response.json({data:{configuration,zone_set:null}});};
  await getConfiguration({accessToken:'test-only'},request);
  const {payload}=validateConfigurationDraft({...configurationToDraft(configuration),change_note:'review'});
  await publishConfiguration({accessToken:'test-only',input:payload},request);
  assert(calls.every((call)=>call.path==='/admin/configuration' && call.options.headers.Authorization==='Bearer test-only'));
  assert(calls[0].options.body===undefined && calls[1].options.method==='POST');
  assert(JSON.stringify(JSON.parse(calls[1].options.body))===JSON.stringify(payload));
});
Deno.test('FAB-4 API: exact field errors, status and request ID survive transport',async()=>{
  try {await getConfiguration({accessToken:'test-only'},async()=>Response.json({error:{code:'invalid_request',message:'Invalid',request_id:'request-1',details:{fields:{gps_accuracy_max_meters:'Must be a number between 5 and 500.'}}}},{status:400}));throw new Error('Expected failure');}
  catch(error){assert(error.status===400 && error.details.fields.gps_accuracy_max_meters==='Must be a number between 5 and 500.' && error.requestId==='request-1');}
});
Deno.test('FAB-4 API: no credential means no request; malformed success fails closed',async()=>{
  let calls=0;
  try {await getConfiguration({accessToken:null},()=>{calls++;});}catch(error){assert(error.status===401);}
  assert(calls===0);
  try {await getConfiguration({accessToken:'test-only'},async()=>Response.json({data:{}}));throw new Error('Expected failure');}catch(error){assert(error.code==='invalid_response');}
});
