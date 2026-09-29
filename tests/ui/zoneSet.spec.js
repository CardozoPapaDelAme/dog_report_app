import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
const id='00000000-0000-4000-8000-000000000005';
const geometry={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]};
const canonical={type:'MultiPolygon',coordinates:[geometry.coordinates]};
const checksum=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
const zone={id,environment:'staging',version:2,name:'Zona de prueba',source_uri:'https://example.test/zona.geojson',source_version:'v2',source_sha256:checksum,geometry:canonical,status:'draft'};
const configuration={id:'config-1',environment:'staging',version:1,is_active:true,flag_auto_hide_threshold:5,duplicate_radius_meters:150,duplicate_time_window_minutes:120,trust_high_threshold:0.8,trust_medium_threshold:0.5,gps_accuracy_max_meters:50,report_rate_limit_per_hour:10,flag_rate_limit_per_hour:30};
const field=(page,key)=>page.getByTestId(`zone-${key}`);
const pageErrors=new WeakMap();
test.beforeEach(({page})=>{const errors=[];pageErrors.set(page,errors);page.on('pageerror',(error)=>errors.push(error.message));});
test.afterEach(({page})=>expect(pageErrors.get(page)).toEqual([]));
async function setup(page, command, active=()=>null) {
  await page.route('**/admin/configuration',route=>route.fulfill({json:{data:{configuration,zone_set:active()}}}));
  await page.route('**/admin/zone-sets**',async route=>{expect(route.request().headers().authorization).toMatch(/^Bearer test-session-/);await command(route);});
  await page.goto('/?zones');
  await expect(page.getByText('01 · Crear borrador',{exact:true})).toBeVisible();
}
async function prepare(page, file=false) {
  if(file){
    const chooser=page.waitForEvent('filechooser');
    await page.getByTestId('zone-pick').click();
    await (await chooser).setFiles({name:'zona.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify(geometry,null,2))});
  }else{
    await field(page,'content').fill(JSON.stringify(geometry));
    await page.getByRole('button',{name:'Calcular checksum',exact:true}).click();
  }
  await expect(page.getByTestId('zone-checksum-preview')).toHaveText(checksum);
  for(const [key,value] of Object.entries({name:zone.name,source_uri:zone.source_uri,source_version:zone.source_version}))await field(page,key).fill(value);
}
async function create(page){await prepare(page);await page.getByTestId('zone-create').click();await expect(page.getByTestId('zone-draft-status')).toBeVisible();}

test('file upload displays canonical checksum; creation never activates; separate approval activates exact draft',async({page},info)=>{
  const calls=[];
  await setup(page,async route=>{
    const input=route.request().postDataJSON();calls.push({url:route.request().url(),input});
    const activating=route.request().url().endsWith('/activate');
    if(!activating){expect(input).toEqual({name:zone.name,source_uri:zone.source_uri,source_version:zone.source_version,source_sha256:checksum,geometry:canonical});}
    else{expect(input).toEqual({association_approval_reference:'AHC-TEST-5'});expect(route.request().url()).toContain(id);}
    await route.fulfill({status:activating?200:201,json:{data:{zone_set:activating?{...zone,status:'active',association_approval_reference:input.association_approval_reference}:zone}}});
  });
  await prepare(page,true);
  await page.screenshot({path:info.outputPath('zone-mobile-prepared.png'),fullPage:true});
  expect(calls).toHaveLength(0);
  await page.getByTestId('zone-create').click();
  await expect(page.getByTestId('zone-draft-status')).toHaveText('Borrador · todavía no activo');
  expect(calls).toHaveLength(1);
  await expect(page.getByTestId('zone-activated')).toHaveCount(0);
  await expect(page.getByTestId('zone-activate')).toBeDisabled();
  await field(page,'association_approval_reference').fill('   ');
  await expect(page.getByTestId('zone-activate')).toBeDisabled();
  await field(page,'association_approval_reference').fill('AHC-TEST-5');
  await page.screenshot({path:info.outputPath('zone-mobile-draft.png'),fullPage:true});
  await page.getByTestId('zone-activate').click();
  await expect(page.getByTestId('zone-activated')).toBeVisible();
  expect(calls).toHaveLength(2);
  await expect(page.getByRole('button',{name:'Activar esta versión',exact:true})).toHaveCount(0);
  await page.setViewportSize({width:1200,height:900});
  await page.screenshot({path:info.outputPath('zone-desktop-active.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('invalid geometry and edited content invalidate checksum without sending requests',async({page})=>{
  let calls=0;
  await setup(page,route=>{calls++;return route.fulfill({status:500});});
  await prepare(page);
  await field(page,'content').fill('{');
  await expect(page.getByTestId('zone-checksum-preview')).toHaveCount(0);
  await page.getByTestId('zone-create').click();
  await expect(page.getByText('Calcula el checksum del contenido actual antes de guardar.')).toBeVisible();
  await page.getByRole('button',{name:'Calcular checksum',exact:true}).click();
  await expect(page.getByText('El contenido no es JSON válido.')).toBeVisible();
  expect(calls).toBe(0);
});
test('server field errors remain exact, preserve input and do not unlock activation',async({page})=>{
  await setup(page,route=>route.fulfill({status:400,json:{error:{code:'invalid_request',message:'Invalid geometry',details:{fields:{geometry:'Self-intersection at 0.5 0.5'}}}}}));
  await prepare(page);await page.getByTestId('zone-create').click();
  await expect(page.getByText('Self-intersection at 0.5 0.5')).toBeVisible();
  await expect(field(page,'name')).toHaveValue(zone.name);
  await expect(page.getByTestId('zone-activate')).toHaveCount(0);
});
test('double create sends once; changing session discards the late result',async({page})=>{
  let count=0,release;const gate=new Promise(resolve=>{release=resolve;});
  await setup(page,async route=>{count++;await gate;await route.fulfill({status:201,json:{data:{zone_set:zone}}});});
  await prepare(page);
  await page.getByTestId('zone-create').evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>count).toBe(1);
  await page.getByRole('button',{name:'Otra sesión de prueba',exact:true}).click();
  release();
  await expect(field(page,'name')).toHaveValue('');
  await expect(page.getByTestId('zone-created')).toHaveCount(0);
});
test('ambiguous create is blocked and never retried automatically',async({page})=>{
  let count=0;
  await setup(page,route=>{count++;return route.abort();});
  await prepare(page);await page.getByTestId('zone-create').click();
  await expect(page.getByText('Resultado pendiente de confirmar',{exact:true})).toBeVisible();
  await expect(page.getByTestId('zone-create')).toBeDisabled();
  await expect(page.getByTestId('zone-activate')).toHaveCount(0);
  expect(count).toBe(1);
});
test('ambiguous activation reconciles with GET only, never repeats POST',async({page})=>{
  let count=0,active=null;
  await setup(page,route=>{
    count++;
    if(route.request().url().endsWith('/activate')){active={...zone,status:'active',association_approval_reference:'AHC-TEST-5'};return route.abort();}
    return route.fulfill({status:201,json:{data:{zone_set:zone}}});
  },()=>active);
  await create(page);await field(page,'association_approval_reference').fill('AHC-TEST-5');
  await page.getByTestId('zone-activate').evaluate(button=>{button.click();button.click();});
  await expect(page.getByText('Resultado pendiente de confirmar',{exact:true})).toBeVisible();
  await expect(page.getByTestId('zone-activate')).toBeDisabled();
  await page.getByRole('button',{name:'Consultar zona activa',exact:true}).click();
  await expect(page.getByTestId('zone-activated')).toBeVisible();expect(count).toBe(2);
});
test('a conflicting activation stays blocked when a different zone is active',async({page})=>{
  await setup(page,route=>route.fulfill(route.request().url().endsWith('/activate')?{status:409,json:{error:{code:'zone_set_conflict'}}}:{status:201,json:{data:{zone_set:zone}}}));
  await create(page);await field(page,'association_approval_reference').fill('AHC-TEST-5');await page.getByTestId('zone-activate').click();
  await page.getByRole('button',{name:'Consultar zona activa',exact:true}).click();
  await expect(page.getByText(/La zona activa consultada no coincide/)).toBeVisible();
  await expect(page.getByTestId('zone-activate')).toBeDisabled();
  await expect(page.getByTestId('zone-activated')).toHaveCount(0);
});
test('leaving a saved draft requires acknowledgement and resetting clears approval',async({page})=>{
  await setup(page,route=>route.fulfill({status:201,json:{data:{zone_set:zone}}}));
  await create(page);await field(page,'association_approval_reference').fill('AHC-TEST-5');
  await page.getByRole('button',{name:'Preparar otro borrador',exact:true}).click();
  await expect(page.getByText('¿Salir de este borrador?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Permanecer aquí',exact:true}).click();
  await expect(field(page,'association_approval_reference')).toHaveValue('AHC-TEST-5');
  await page.getByRole('button',{name:'Preparar otro borrador',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(field(page,'name')).toHaveValue('');await expect(page.getByTestId('zone-activate')).toHaveCount(0);
});
for(const status of [401,403])test(`server ${status} hides zone controls`,async({page})=>{
  await page.route('**/admin/configuration',route=>route.fulfill({status,json:{error:{code:status===401?'authentication_required':'forbidden'}}}));
  await page.goto('/?zones');
  await expect(page.getByText(status===401?'Inicia sesión como Administrador':'Acceso no permitido',{exact:true})).toBeVisible();
  await expect(page.getByTestId('zone-create')).toHaveCount(0);
});
test('no session makes no API request',async({page})=>{
  let count=0;await page.route('**/admin/**',route=>{count++;return route.abort();});
  await page.goto('/?zones&no-session');await expect(page.getByText('Inicia sesión como Administrador',{exact:true})).toBeVisible();expect(count).toBe(0);
});
test('existing active version survives creation and a rejected approval retains the draft',async({page})=>{
  const previous={...zone,id:'00000000-0000-4000-8000-000000000004',version:1,name:'Zona anterior',status:'active',association_approval_reference:'AHC-PREVIOUS'};
  await setup(page,route=>route.fulfill(route.request().url().endsWith('/activate')?{status:400,json:{error:{code:'invalid_request',details:{fields:{association_approval_reference:'Approval reference rejected by server'}}}}}:{status:201,json:{data:{zone_set:zone}}}),()=>previous);
  await create(page);
  await expect(page.getByText('Zona anterior · Versión 1',{exact:true})).toBeAttached();
  await expect(page.getByTestId('zone-checksum-active')).toHaveText(checksum);
  await field(page,'association_approval_reference').fill('AHC-TEST-5');await page.getByTestId('zone-activate').click();
  await expect(page.getByText('Approval reference rejected by server',{exact:true})).toBeVisible();
  await expect(field(page,'association_approval_reference')).toHaveValue('AHC-TEST-5');
  await expect(page.getByTestId('zone-draft-status')).toHaveText('Borrador · todavía no activo');
});
test('invalid replacement file removes the previous checksum and cannot reuse its geometry',async({page})=>{
  let count=0;
  await setup(page,route=>{count++;return route.abort();});await prepare(page,true);
  const chooser=page.waitForEvent('filechooser');await page.getByTestId('zone-pick').click();
  await (await chooser).setFiles({name:'invalid.geojson',mimeType:'application/geo+json',buffer:Buffer.from('{')});
  await expect(page.getByText('El contenido no es JSON válido.')).toBeVisible();
  await expect(page.getByTestId('zone-checksum-preview')).toHaveCount(0);
  await page.getByTestId('zone-create').click();expect(count).toBe(0);
});
test('revoked permission during activation clears the draft and approval',async({page})=>{
  await setup(page,route=>route.fulfill(route.request().url().endsWith('/activate')?{status:403,json:{error:{code:'forbidden'}}}:{status:201,json:{data:{zone_set:zone}}}));
  await create(page);await field(page,'association_approval_reference').fill('AHC-TEST-5');await page.getByTestId('zone-activate').click();
  await expect(page.getByText('Acceso no permitido',{exact:true})).toBeVisible();
  await expect(field(page,'association_approval_reference')).toHaveCount(0);await expect(page.getByTestId('zone-created')).toHaveCount(0);
});
test('an activation response after logout cannot show a successful operation',async({page})=>{
  let release,started=false;const gate=new Promise(resolve=>{release=resolve;});
  await setup(page,async route=>{
    if(route.request().url().endsWith('/activate')){started=true;await gate;return route.fulfill({json:{data:{zone_set:{...zone,status:'active',association_approval_reference:'AHC-TEST-5'}}}});}
    return route.fulfill({status:201,json:{data:{zone_set:zone}}});
  });
  await create(page);await field(page,'association_approval_reference').fill('AHC-TEST-5');await page.getByTestId('zone-activate').click();
  await expect.poll(()=>started).toBe(true);
  await page.getByRole('button',{name:'Cerrar sesión de prueba',exact:true}).click();release();
  await expect(page.getByText('Inicia sesión como Administrador',{exact:true})).toBeVisible();
  await expect(page.getByTestId('zone-activated')).toHaveCount(0);
});
