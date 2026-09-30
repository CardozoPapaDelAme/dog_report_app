# TD-107 · FAB-6 / L6 — Pantalla de Gestión de Duplicados

Entrega local: 2026-09-30. Rama:
`TD-107-fab-6-pantalla-de-gestion-de-duplicados`.
Base: `ed36681` de `origin/main`, que incluye L5 (PR #25, `5da050c`),
la sesión del equipo y la cola de borradores de reportes.

## Resultado

Desde moderación, **Gestionar duplicados** muestra los candidatos sugeridos por
el sistema agrupados por conexión. Cada reporte muestra ID, moderación, fecha,
tipo, características, ubicación y detalles originales para apoyar la revisión.
Se eligen los reportes del caso y uno como canónico; el resto se marca como sus
duplicados. No se borran ni combinan sus datos.

La pantalla avisa antes del envío si el conjunto seleccionado no está conectado.
A–B–C es válido al seleccionar los tres; A/C sin B es inválido aunque los tres
aparezcan en la misma sugerencia. También bloquea selecciones de componentes
separados, un canónico no seleccionado, miembros no disponibles y más de 500
reportes. La validación del servidor permanece como autoridad final.

La lista de grupos activos permite revertir con motivo obligatorio. Tras la
respuesta se consultan candidatos y grupos de nuevo: los candidatos revisables
reaparecen sin inventar relaciones en el cliente. Revertir conserva toda la
información original y el estado de moderación, según lo acordado por Fabián.
Un reporte oculto sigue oculto y uno eliminado no se restaura por esta operación.

## Arquitectura y contrato

- `screens/DuplicateManagementScreen.js`: interfaz, selección accesible,
  confirmación de reversión y aviso de cambios locales al salir/actualizar.
- `hooks/useDuplicateResolution.js`: carga, selección, operaciones, sesión,
  bloqueo síncrono de doble envío y recuperación por lectura.
- `models/duplicateCandidate.js`: componentes, conectividad inducida, validación
  de canónico/motivos y lectura estricta del grafo/grupos.
- `services/duplicateApi.js`: Bearer, rutas FAB-3, preservación de errores por
  campo y verificación de que el grupo recibido coincide con la operación.
- `App.js` y CommandCenter: entrada desde la navegación de Administrador usando
  la sesión ya integrada en main; no se introduce login alternativo.

Se agregó `GET /admin/duplicate-candidates` dentro de las capas existentes de
FAB-3. Era necesario porque la cola de moderación excluye reportes visibles,
aunque esos reportes sí pueden ser candidatos válidos. Una única consulta SQL
lee candidatos pendientes y sus extremos, excluyendo reportes eliminados o con
membresía activa. Mantiene autorización, contexto transaccional, entorno, RLS y
grants existentes. No necesita migraciones ni privilegios adicionales.

El grafo se devuelve completo, sin paginación ni truncamiento, como las consultas
de grupos activos del prototipo. Escalarlo requerirá componentes completos o un
contrato explícito de snapshots; paginar reportes arbitrariamente rompe la
validación de conexión. Véase ADR-021 y el contrato en `docs/API.md`.

Se restablecieron `/admin/duplicate-groups` y `/:group_id/reverse`, que habían
pasado a camelCase durante un renombrado en main. Los alias camelCase permanecen
con los mismos controles. Creación y reversión mantienen FAB-3: motivo opcional
al resolver, obligatorio al revertir, auditoría y originales preservados.

Los POST nunca se reintentan automáticamente. Un resultado incierto o conflicto
bloquea nuevas operaciones hasta consultar el estado actual. Si el POST fue
confirmado pero falla la recarga, la pantalla conserva esa confirmación y pide
actualizar la lista. Cambio de sesión/desmontaje descarta respuestas anteriores;
401/403 retira el contenido. No persiste credenciales ni selecciones.

## Evidencia

- Deno: **194 aprobadas, 0 fallidas, 5 SQL opt-in omitidas** en la suite general.
- L6 incorpora **9 casos Deno** de modelo, API/integración, HTTP y Service.
  Se enumeran todos los subconjuntos de un grafo de cinco reportes y se compara
  la conectividad local con el dominio de FAB-3.
- PostgreSQL 17/PostGIS 3.5 desechable local: **1 suite aprobada, 10 pasos**.
  Valida la nueva consulta con `app_backend`, aislamiento de roles, resolución,
  reversión, datos originales, concurrencia y rollback. Contenedor retirado.
- Navegador: **39 aprobadas**, 16 de L6 y 23 regresiones de L4/L5. Comprueban que
  una selección desconectada no genera POST, canónico explícito, recuperación,
  errores exactos, permisos, sesión, doble envío y reversión.
- Capturas revisadas en 390 × 844 y 1200 × 900; accesibilidad checked corregida
  para web y conservada para nativo.
- Exportación Expo correcta en web, Android e iOS.
- Comandos y aceptación manual: `docs/TESTING.md`, sección FAB-6.

## Pendientes y alcance de entrega

La prueba con Administrador/JWT real sigue aplazada por decisión del usuario.
Quedan comprobaciones físicas/emulador de teclado, lector de pantalla y botón
atrás. Las pruebas HTTP de integración inyectan identidad; las de navegador
interceptan HTTP. La suite SQL usa una base local desechable, no Supabase.

Para la prueba remota se debe desplegar la única API con el nuevo GET de
candidatos y las rutas FAB-3 contractuales. Un backend sin ese endpoint muestra
un error en la pantalla, no candidatos ficticios. No se hizo push, PR, merge,
despliegue, migración ni resolución/reversión en un entorno compartido.

Fuentes utilizadas: guía externa `GuiaDeConstruccion.md` L6; handoffs L4/L5;
`AGENTS.md`; aclaraciones aprobadas y contrato FAB-3; código de la base actual.
El handoff histórico L5 decía entrega local, pero su estado fue superado por el
merge verificado del PR #25. Los históricos se conservan en el handoff.
