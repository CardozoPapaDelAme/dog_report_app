import { CONFIGURATION_FIELDS, configurationFieldErrors, configurationIsDirty, configurationToDraft, readConfigurationState, validateConfigurationDraft } from './configuration.js';
import { CONFIGURATION_RULES, validateConfiguration } from '../supabase/functions/api/domain/configuration.js';
export const configuration = {
  id:'config-1', environment:'staging', version:1, is_active:true,
  flag_auto_hide_threshold:5, duplicate_radius_meters:150, duplicate_time_window_minutes:120,
  trust_high_threshold:0.8, trust_medium_threshold:0.5, gps_accuracy_max_meters:50,
  report_rate_limit_per_hour:10, flag_rate_limit_per_hour:30, change_note:'Previous reason',
};
function assert(value, message='Assertion failed') { if (!value) throw new Error(message); }
const validDraft=()=>({...configurationToDraft(configuration),change_note:'Reviewed thresholds'});
Deno.test('FAB-4 MODEL: all eight numeric rules match FAB-1, every limit and precision is enforced',()=>{
  assert(CONFIGURATION_FIELDS.length===8);
  for(const {key,group:_group,...rule} of CONFIGURATION_FIELDS) {
    assert(JSON.stringify(rule)===JSON.stringify(CONFIGURATION_RULES[key]),key);
    for(const bad of ['', 'abc','0x10','1e2','Infinity',String(rule.min-1),String(rule.max+1)]) {
      assert(validateConfigurationDraft({...validDraft(),[key]:bad}).errors[key],`${key}: ${bad}`);
    }
    const value=rule.decimals===0 ? rule.min+0.5 : rule.min+10**(-rule.decimals-1);
    assert(validateConfigurationDraft({...validDraft(),[key]:String(value)}).errors[key],key);
    for(const bound of [rule.min,rule.max]) {
      const draft={...validDraft(),[key]:String(bound)};
      // Band ordering is checked separately below.
      if(key==='trust_medium_threshold') draft.trust_high_threshold='1';
      if(key==='trust_high_threshold') draft.trust_medium_threshold='0';
      const error=validateConfigurationDraft(draft).errors[key];
      assert(!error || error.key==='trustOrder',key);
    }
  }
});
Deno.test('FAB-4 MODEL: payload uses numbers, accepts decimal comma and matches server validation',()=>{
  const result=validateConfigurationDraft({...validDraft(),trust_high_threshold:'0,825',gps_accuracy_max_meters:'12,25'});
  assert(result.payload.trust_high_threshold===0.825 && result.payload.gps_accuracy_max_meters===12.25);
  assert(Object.keys(result.payload).length===9);
  validateConfiguration(result.payload);
  assert(validateConfigurationDraft({...validDraft(),trust_medium_threshold:'0.8'}).errors.trust_medium_threshold.key==='trustOrder');
});
Deno.test('FAB-4 MODEL: reason is new, required, unicode bounded and server errors remain exact',()=>{
  const draft=configurationToDraft(configuration);
  assert(draft.change_note==='' && !configurationIsDirty(draft,configuration));
  for(const note of ['', ' ', 'a'.repeat(1001)]) assert(validateConfigurationDraft({...draft,change_note:note}).errors.change_note);
  assert(validateConfigurationDraft({...draft,change_note:'🐕'.repeat(1000)}).payload);
  assert(configurationIsDirty({...draft,change_note:'Review'},configuration));
  const errors=configurationFieldErrors({details:{fields:{gps_accuracy_max_meters:'Must be a number between 5 and 500.',secret:'hidden',change_note:42}}});
  assert(errors.gps_accuracy_max_meters==='Must be a number between 5 and 500.' && Object.keys(errors).length===1);
});
Deno.test('FAB-4 MODEL: incomplete responses never create a form filled with fabricated defaults',()=>{
  assert(readConfigurationState({configuration,zone_set:null}).configuration===configuration);
  for(const broken of [null,{}, {configuration:{...configuration,gps_accuracy_max_meters:'50'}},{configuration:{...configuration,version:0}}]) {
    let failed=false; try{readConfigurationState(broken);}catch(error){failed=error.code==='invalid_response';} assert(failed);
  }
});
