import { test, expect } from '@playwright/test';
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const reports=[1,2,3,4,5].map((n)=>({id:id(n),status:n===2?'hidden':'visible',incident_type:'avistamiento_simple',sighting_type:'solitario',details:{descripcion:`Evidencia original ${n}`},dog:{predominant_color:'café',size:'mediano',has_collar:false},location:{latitude:27.73,longitude:-107.63},client_created_at:'2026-09-30T12:00:00Z'}));
const edges=[[1,2],[2,3],[4,5]].map(([a,b],i)=>({id:id(10+i),report_a:id(a),report_b:id(b),status:'pending',distance_meters:100,minutes_apart:2,matched_signals:{}}));
const group={id:id(200),canonical_report_id:id(2),report_ids:[id(1),id(2),id(3)],status:'active',resolution_version:1,resolved_at:'2026-09-30T12:00:00Z',reversed_at:null};
const errors=new WeakMap();
test.beforeEach(({page})=>{const list=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function setup(page,{mutate,initialGroups=[],candidateStatus=200}={}) {
  const state={groups:[...initialGroups],posts:[],reads:0};
  await page.route('**/admin/duplicate-candidates',async route=>{
    state.reads++;
    expect(route.request().headers().authorization).toMatch(/^Bearer test-session-/);
    const occupied=new Set(state.groups.flatMap(g=>g.report_ids));
    await route.fulfill(candidateStatus===200?{json:{data:{reports:reports.filter(r=>!occupied.has(r.id)),candidates:edges.filter(e=>!occupied.has(e.report_a)&&!occupied.has(e.report_b))}}}:{status:candidateStatus,json:{error:{code:candidateStatus===401?'authentication_required':'forbidden'}}});
  });
  await page.route('**/admin/duplicate-groups**',async route=>{
    expect(route.request().headers().authorization).toMatch(/^Bearer test-session-/);
    if(route.request().method()==='GET')return route.fulfill({json:{data:{duplicate_groups:state.groups}}});
    const body=route.request().postDataJSON();state.posts.push({url:route.request().url(),body});
    if(mutate)return mutate(route,state);
    if(route.request().url().endsWith('/reverse')){
      state.groups=[];
      return route.fulfill({json:{data:{duplicate_group:{...group,status:'reversed',resolution_version:2,reversed_at:'2026-09-30T12:05:00Z'}}}});
    }
    state.groups=[{...group,canonical_report_id:body.canonical_report_id,report_ids:body.report_ids}];
    return route.fulfill({status:201,json:{data:{duplicate_group:state.groups[0]}}});
  });
  await page.goto('/?duplicates');
  if(candidateStatus===200)await expect(page.getByText('Candidatos pendientes',{exact:true})).toBeVisible();
  return state;
}
async function select(page,ids=[1,2,3],canonical=2) {
  for(const n of ids)await page.getByTestId(`duplicate-select-${id(n)}`).click();
  await page.getByTestId(`duplicate-canonical-${id(canonical)}`).click();
}
async function resolve(page){await page.getByTestId('duplicate-resolve').click();}

test('groups genuine candidates; disconnected induced selection warns before POST; valid chain resolves then reverses',async({page},info)=>{
  const state=await setup(page);
  await expect(page.getByText('Sugerencia 1 · 3 reportes conectados',{exact:true})).toBeVisible();
  await expect(page.getByText('Sugerencia 2 · 2 reportes conectados',{exact:true})).toBeAttached();
  await select(page,[1,3],1);
  await page.getByRole('button',{name:'Revisar selección (2)',exact:true}).click();
  await expect(page.getByTestId('duplicate-graph-error')).toContainText('no están conectados');
  await resolve(page);expect(state.posts).toHaveLength(0);
  await page.screenshot({path:info.outputPath('duplicates-mobile-disconnected.png'),fullPage:true,animations:'disabled'});
  await page.getByTestId(`duplicate-select-${id(2)}`).click();
  await page.getByTestId(`duplicate-canonical-${id(2)}`).click();
  await expect(page.getByTestId('duplicate-graph-error')).toHaveCount(0);
  await page.getByTestId('duplicate-resolution-note').fill('Mismo caso, revisado');
  await resolve(page);
  await expect(page.getByTestId(`duplicate-group-${group.id}`)).toBeAttached();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].body).toEqual({canonical_report_id:id(2),report_ids:[id(1),id(2),id(3)],note:'Mismo caso, revisado'});
  await expect(page.getByTestId(`duplicate-select-${id(1)}`)).toHaveCount(0);
  await page.getByTestId(`duplicate-reverse-${group.id}`).click();
  await page.getByTestId('duplicate-confirm-reverse').click();
  await expect(page.getByTestId('duplicate-reverse-note')).toBeFocused();expect(state.posts).toHaveLength(1);
  await page.getByTestId('duplicate-reverse-note').fill('Revisar nuevamente');
  await page.screenshot({path:info.outputPath('duplicates-mobile-reverse.png'),fullPage:true,animations:'disabled'});
  await page.getByTestId('duplicate-confirm-reverse').click();
  await expect(page.getByTestId(`duplicate-select-${id(2)}`)).toBeAttached();
  await expect(page.getByText('Reversión confirmada. Los candidatos vuelven a revisión; la moderación se conserva.',{exact:true})).toBeVisible();
  expect(state.posts[1].body).toEqual({note:'Revisar nuevamente'});
  await expect(page.getByTestId(`duplicate-group-${group.id}`)).toHaveCount(0);
  await expect(page.getByText('Oculto',{exact:true})).toBeAttached();
  await expect(page.getByTestId('duplicate-reverse-note')).not.toBeVisible();
  await page.setViewportSize({width:1200,height:900});
  await page.getByText('Gestión de duplicados',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('duplicates-desktop-reopened.png'),fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('reports from different suggested groups cannot be resolved together',async({page})=>{
  const state=await setup(page);await select(page,[1,2,4,5],1);await resolve(page);
  await expect(page.getByTestId('duplicate-graph-error')).toContainText('no están conectados');expect(state.posts).toHaveLength(0);
});
test('deselecting the canonical report requires choosing another before sending',async({page})=>{
  const state=await setup(page);await select(page);await page.getByTestId(`duplicate-select-${id(2)}`).click();
  await page.getByTestId(`duplicate-select-${id(2)}`).click();await resolve(page);
  await expect(page.getByText('Elige como canónico uno de los reportes seleccionados.',{exact:true})).toBeVisible();expect(state.posts).toHaveLength(0);
});
test('exact server validation preserves selection and reason',async({page})=>{
  await setup(page,{mutate:route=>route.fulfill({status:400,json:{error:{code:'invalid_request',details:{fields:{note:'Exact server reason'}}}}})});
  await select(page);await page.getByTestId('duplicate-resolution-note').fill('Conservar motivo');await resolve(page);
  await expect(page.getByText('Exact server reason',{exact:true})).toBeVisible();
  await expect(page.getByTestId('duplicate-resolution-note')).toHaveValue('Conservar motivo');
  await expect(page.getByTestId(`duplicate-canonical-${id(2)}`)).toHaveAttribute('aria-checked','true');
});
test('double submission sends once and late response after session change is ignored',async({page})=>{
  let release;const gate=new Promise(r=>{release=r;});
  const state=await setup(page,{mutate:async route=>{await gate;await route.fulfill({status:201,json:{data:{duplicate_group:group}}});}});
  await select(page);await page.getByTestId('duplicate-resolve').evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>state.posts.length).toBe(1);
  await page.getByRole('button',{name:'Otra sesión de prueba',exact:true}).click();release();
  await expect(page.getByTestId(`duplicate-select-${id(1)}`)).toHaveAttribute('aria-checked','false');
  await expect(page.getByText('Resolución confirmada. El grupo está activo.',{exact:true})).toHaveCount(0);
});
test('ambiguous resolution blocks all mutations until explicit GET reload',async({page})=>{
  const state=await setup(page,{mutate:(route,state)=>{state.groups=[group];return route.abort();}});
  await select(page);await resolve(page);
  await expect(page.getByText(/No se confirmó el resultado/)).toBeVisible();
  await expect(page.getByTestId('duplicate-resolve')).toBeDisabled();
  await page.getByRole('button',{name:'Consultar estado antes de continuar',exact:true}).click();
  await expect(page.getByTestId(`duplicate-group-${group.id}`)).toBeAttached();
  await expect(page.getByTestId(`duplicate-select-${id(1)}`)).toHaveCount(0);expect(state.posts).toHaveLength(1);
});
test('server graph conflict requires reload and never retries a resolution',async({page})=>{
  const state=await setup(page,{mutate:route=>route.fulfill({status:409,json:{error:{code:'duplicate_graph_disconnected'}}})});
  await select(page);await resolve(page);
  await expect(page.getByText('Los candidatos cambiaron y los reportes ya no están conectados. Actualiza la lista.',{exact:true})).toBeVisible();
  await expect(page.getByTestId('duplicate-resolve')).toBeDisabled();expect(state.posts).toHaveLength(1);
});
test('ambiguous reversal closes confirmation and cannot send twice',async({page})=>{
  const state=await setup(page,{initialGroups:[group],mutate:(route,state)=>{state.groups=[];return route.abort();}});
  await page.getByTestId(`duplicate-reverse-${group.id}`).click();await page.getByTestId('duplicate-reverse-note').fill('Revisar');
  await page.getByTestId('duplicate-confirm-reverse').evaluate(button=>{button.click();button.click();});
  await expect(page.getByText(/No se confirmó el resultado/)).toBeVisible();
  await expect(page.getByTestId('duplicate-confirm-reverse')).not.toBeVisible();
  await page.getByRole('button',{name:'Consultar estado antes de continuar',exact:true}).click();
  await expect(page.getByTestId(`duplicate-select-${id(2)}`)).toBeAttached();expect(state.posts).toHaveLength(1);
});
test('dirty refresh can be cancelled and discards only local selection when confirmed',async({page})=>{
  const state=await setup(page);await select(page);
  await page.getByRole('button',{name:'Actualizar candidatos y grupos',exact:true}).click();
  await expect(page.getByText('¿Descartar esta selección?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Seguir editando',exact:true}).click();
  await expect(page.getByTestId(`duplicate-select-${id(1)}`)).toHaveAttribute('aria-checked','true');
  await page.getByRole('button',{name:'Actualizar candidatos y grupos',exact:true}).click();
  await page.getByRole('button',{name:'Descartar y continuar',exact:true}).click();
  await expect(page.getByTestId(`duplicate-select-${id(1)}`)).toHaveAttribute('aria-checked','false');expect(state.posts).toHaveLength(0);
});
for(const status of [401,403])test(`candidate read ${status} hides all reports and controls`,async({page})=>{
  await setup(page,{candidateStatus:status});
  await expect(page.getByText(status===401?'Inicia sesión como Administrador':'Acceso no permitido',{exact:true})).toBeVisible();
  await expect(page.getByTestId('duplicate-resolve')).toHaveCount(0);
});
test('logout during reversal ignores its late confirmation',async({page})=>{
  let release;const gate=new Promise(r=>{release=r;});
  const state=await setup(page,{initialGroups:[group],mutate:async route=>{await gate;await route.fulfill({json:{data:{duplicate_group:{...group,status:'reversed',resolution_version:2}}}});}});
  await page.getByTestId(`duplicate-reverse-${group.id}`).click();await page.getByTestId('duplicate-reverse-note').fill('Revisar');await page.getByTestId('duplicate-confirm-reverse').click();
  await expect.poll(()=>state.posts.length).toBe(1);
  // The test control changes the external token, as the session layer would.
  await page.getByRole('button',{name:'Cerrar sesión de prueba',exact:true}).evaluate(button=>button.click());release();
  await expect(page.getByText('Inicia sesión como Administrador',{exact:true})).toBeVisible();
  await expect(page.getByTestId('duplicate-reverse-note')).not.toBeVisible();
});
test('no token sends no requests',async({page})=>{
  let requests=0;await page.route('**/admin/**',route=>{requests++;return route.abort();});
  await page.goto('/?duplicates&no-session');await expect(page.getByText('Inicia sesión como Administrador',{exact:true})).toBeVisible();expect(requests).toBe(0);
});
test('confirmed resolution with failed refresh remains confirmed but blocks further commands',async({page})=>{
  let failRefresh=true;
  const state=await setup(page,{mutate:async(route,state)=>{
    state.groups=[group];
    await page.route('**/admin/duplicate-candidates',read=>failRefresh?read.fulfill({status:503,json:{error:{code:'dependency_unavailable'}}}):read.fulfill({json:{data:{reports:reports.slice(3),candidates:[edges[2]]}}}));
    return route.fulfill({status:201,json:{data:{duplicate_group:group}}});
  }});
  await select(page);await resolve(page);
  await expect(page.getByText('Resolución confirmada. El grupo está activo.',{exact:true})).toBeVisible();
  await expect(page.getByText(/La operación fue confirmada, pero la lista no pudo actualizarse/)).toBeVisible();
  await expect(page.getByTestId('duplicate-resolve')).toBeDisabled();
  failRefresh=false;await page.getByRole('button',{name:'Consultar estado antes de continuar',exact:true}).click();
  await expect(page.getByTestId(`duplicate-group-${group.id}`)).toBeAttached();expect(state.posts).toHaveLength(1);
});
test('initial unavailable service permits GET retry without exposing an editable partial graph',async({page})=>{
  let unavailable=true;
  await page.route('**/admin/duplicate-candidates',route=>route.fulfill(unavailable?{status:503,json:{error:{code:'dependency_unavailable'}}}:{json:{data:{reports:[],candidates:[]}}}));
  await page.route('**/admin/duplicate-groups',route=>route.fulfill({json:{data:{duplicate_groups:[]}}}));
  await page.goto('/?duplicates');await expect(page.getByTestId('duplicate-resolve')).toHaveCount(0);
  await expect(page.getByText('El servicio no está disponible por el momento.',{exact:true})).toBeVisible();
  unavailable=false;await page.getByRole('button',{name:'Reintentar carga',exact:true}).click();
  await expect(page.getByText('No hay sugerencias disponibles para resolver.',{exact:true})).toBeVisible();
});
test('permission revoked during resolution removes private report data and selection',async({page})=>{
  const state=await setup(page,{mutate:route=>route.fulfill({status:403,json:{error:{code:'forbidden'}}})});
  await select(page);await resolve(page);
  await expect(page.getByText('Acceso no permitido',{exact:true})).toBeVisible();
  await expect(page.getByTestId(`duplicate-select-${id(1)}`)).toHaveCount(0);expect(state.posts).toHaveLength(1);
});
