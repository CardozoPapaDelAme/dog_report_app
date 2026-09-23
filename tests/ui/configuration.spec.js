import { test, expect } from '@playwright/test';
const configuration = { id:'config-1',environment:'staging',version:1,is_active:true,flag_auto_hide_threshold:5,duplicate_radius_meters:150,duplicate_time_window_minutes:120,trust_high_threshold:0.8,trust_medium_threshold:0.5,gps_accuracy_max_meters:50,report_rate_limit_per_hour:10,flag_rate_limit_per_hour:30,change_note:'Configuración inicial' };
const response = (config=configuration) => ({data:{configuration:config,zone_set:null}});
const field = (page,key) => page.getByTestId(`configuration-${key}`);
const pageErrors = new WeakMap();
test.beforeEach(({page})=>{const errors=[];pageErrors.set(page,errors);page.on('pageerror',(error)=>errors.push(error.message));});
test.afterEach(({page})=>expect(pageErrors.get(page)).toEqual([]));
async function mock(page, handler) {
  await page.route('**/admin/configuration',async(route)=>{
    expect(route.request().headers().authorization).toMatch(/^Bearer test-session-/);
    await handler(route);
  });
}
async function ready(page) {await page.goto('/');await expect(page.getByText('Versión 1 activa')).toBeVisible();}

test('loads eight values, identifies GPS range and publishes the complete typed payload',async({page},info)=>{
  let posts=0;
  await mock(page,async(route)=>{
    if(route.request().method()==='GET') return route.fulfill({json:response()});
    posts++;
    const input=route.request().postDataJSON();
    expect(Object.keys(input)).toHaveLength(9);
    expect(input.gps_accuracy_max_meters).toBe(12.25);
    expect(input.change_note).toBe('Ajuste revisado');
    await route.fulfill({status:201,json:response({...configuration,...input,id:'config-2',version:2})});
  });
  await ready(page);
  await expect(page.locator('input')).toHaveCount(8);
  await expect(field(page,'change_note')).toHaveValue('');
  await field(page,'gps_accuracy_max_meters').fill('501');
  await field(page,'change_note').fill('Ajuste revisado');
  await page.getByTestId('configuration-save').click();
  await expect(page.getByText('Debe estar entre 5 y 500.')).toBeVisible();
  await expect(field(page,'gps_accuracy_max_meters')).toBeFocused();
  expect(posts).toBe(0);
  await page.screenshot({path:info.outputPath('mobile-field-error.png'),fullPage:true});
  await field(page,'gps_accuracy_max_meters').fill('12,25');
  await page.getByTestId('configuration-save').click();
  await expect(page.getByText('Versión 2 guardada y activa.')).toBeAttached();
  await expect(field(page,'gps_accuracy_max_meters')).toHaveValue('12.25');
  await expect(field(page,'change_note')).toHaveValue('');
  expect(posts).toBe(1);
  await page.getByText('Versión 2 activa',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('mobile-saved.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('preserves exact server field errors and user edits after a 400',async({page})=>{
  await mock(page,(route)=>route.fulfill(route.request().method()==='GET' ? {json:response()} : {status:400,json:{error:{code:'invalid_request',message:'Invalid values',details:{fields:{gps_accuracy_max_meters:'Must be a number between 5 and 500.'}}}}}));
  await ready(page);
  await field(page,'change_note').fill('Conservar motivo');
  await field(page,'gps_accuracy_max_meters').fill('60');
  await page.getByTestId('configuration-save').click();
  await expect(page.getByText('Must be a number between 5 and 500.')).toBeVisible();
  await expect(field(page,'gps_accuracy_max_meters')).toHaveValue('60');
  await expect(field(page,'change_note')).toHaveValue('Conservar motivo');
});

test('prevents duplicate submits and ignores a save completing after logout',async({page})=>{
  let posts=0,release;
  const gate=new Promise((resolve)=>{release=resolve;});
  await mock(page,async(route)=>{
    if(route.request().method()==='GET')return route.fulfill({json:response()});
    posts++;await gate;await route.fulfill({status:201,json:response({...configuration,version:2})});
  });
  await ready(page);await field(page,'change_note').fill('Review');
  await page.getByTestId('configuration-save').evaluate((button)=>{button.click();button.click();});
  await expect.poll(()=>posts).toBe(1);
  await page.getByRole('button',{name:'Cerrar sesión de prueba',exact:true}).click();
  await expect(page.getByText('Inicia sesión como Administrador')).toBeVisible();
  release();
  await expect(page.locator('input')).toHaveCount(0);
  await page.getByRole('button',{name:'Otra sesión de prueba',exact:true}).click();
  await expect(page.getByText('Versión 1 activa')).toBeVisible();
  expect(posts).toBe(1);
});

for(const [status,title] of [[401,'Inicia sesión como Administrador'],[403,'Acceso no permitido']]){
  test(`denies ${status} without exposing an editable form`,async({page})=>{
    await mock(page,(route)=>route.fulfill({status,json:{error:{code:status===401?'invalid_token':'forbidden'}}}));
    await page.goto('/');await expect(page.getByText(title)).toBeVisible();await expect(page.locator('input')).toHaveCount(0);
  });
}

test('uncertain POST requires a fresh read and never retries automatically',async({page})=>{
  let posts=0;
  await mock(page,(route)=>{
    if(route.request().method()==='GET')return route.fulfill({json:response({...configuration,version:posts?2:1})});
    posts++;return route.abort('failed');
  });
  await ready(page);await field(page,'change_note').fill('Review');await page.getByTestId('configuration-save').click();
  await expect(page.getByTestId('configuration-save')).toBeDisabled();
  await expect(page.getByText(/No se pudo confirmar la publicación/)).toBeAttached();
  await page.getByRole('button',{name:'Consultar versión activa',exact:true}).click();
  await page.getByRole('button',{name:'Descartar y continuar',exact:true}).click();
  await expect(page.getByText('Versión 2 activa')).toBeVisible();
  await expect(page.getByTestId('configuration-save')).toBeEnabled();expect(posts).toBe(1);
});

test('load failures are retryable, unsaved edits require confirmation, desktop fits',async({page},info)=>{
  let fail=true;
  await mock(page,(route)=>route.fulfill(fail?{status:503,json:{error:{code:'dependency_unavailable'}}}:{json:response()}));
  await page.goto('/');await expect(page.getByText('No pudimos cargar los umbrales')).toBeVisible();
  fail=false;await page.getByRole('button',{name:'Reintentar carga'}).click();await expect(page.getByText('Versión 1 activa')).toBeVisible();
  await field(page,'flag_auto_hide_threshold').fill('6');
  await page.getByRole('button',{name:/Volver a moderación/}).click();
  await page.getByRole('button',{name:'Seguir editando',exact:true}).click();await expect(field(page,'flag_auto_hide_threshold')).toHaveValue('6');
  await expect(page.getByText('¿Descartar los cambios sin guardar?')).not.toBeVisible();
  await page.setViewportSize({width:1200,height:900});
  await page.screenshot({path:info.outputPath('desktop.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/Volver a moderación/}).click();await page.getByRole('button',{name:'Descartar y continuar',exact:true}).click();await expect(page.getByText('Formulario cerrado')).toBeVisible();
});

test('no session performs no API requests',async({page})=>{
  let calls=0;await page.route('**/admin/configuration',async(route)=>{calls++;await route.abort();});
  await page.goto('/?no-session');await expect(page.getByText('Inicia sesión como Administrador')).toBeVisible();expect(calls).toBe(0);
});
