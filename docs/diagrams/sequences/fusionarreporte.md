# Secuencia: resolver duplicados mediante selección canónica

La acción histórica “fusionar” significa seleccionar manualmente un reporte
canónico y vincular los demás como duplicados. No combina contenido, no modifica
evidencia original y no cambia ningún reporte a `deleted`.

```mermaid
sequenceDiagram
  actor Admin as Administrator
  participant App as Aplicación React Native
  participant M as Middleware JWT de Hono
  participant C as Duplicate Controller
  participant S as DuplicateService
  participant R as DuplicateRepository
  participant DB as PostgreSQL / RLS
  participant P as JSON Presenter

  Admin->>App: Abre gestión de duplicados
  App->>M: GET /admin/moderation-queue con Bearer JWT
  M->>C: Sujeto y app_role verificados
  C->>S: listPendingCandidates(actor, query)
  S->>DB: BEGIN, SET LOCAL app.user_id/app.role
  S->>R: Validar Administrator y consultar candidatos pendientes
  R->>DB: SELECT parametrizado bajo RLS
  DB-->>R: Candidatos, señales y reportes originales
  R-->>S: Contexto de candidatos pendientes
  S->>DB: COMMIT
  S->>P: Contexto de moderación autorizado
  P-->>App: 200 JSON
  App-->>Admin: Mostrar sugerencias sin resolverlas automáticamente

  Admin->>App: Selecciona conjunto conectado y reporte canónico
  App->>M: POST /admin/duplicate-groups con Bearer JWT
  M->>C: Revalidar JWT y rol de ruta
  C->>S: resolve(canonical_report_id, report_ids, note)
  S->>DB: BEGIN, SET LOCAL app.user_id/app.role
  S->>R: Bloquear candidatos y miembros
  R->>DB: Validar grafo conectado y ausencia de membresía activa
  alt Conflicto de candidatos o membresía
    S->>DB: ROLLBACK
    S->>P: Mapear conflicto de duplicados
    P-->>App: 409
    App-->>Admin: Conservar sugerencia para revisión
  else Resolución válida
    S->>R: Crear grupo activo y membresías canonical/duplicate
    R->>DB: Insertar resolución y auditoría en la misma transacción
    S->>DB: COMMIT
    S->>P: Presentar grupo resuelto
    P-->>App: 201 JSON
    App-->>Admin: Confirmar selección canónica
  end

  opt Consultar resoluciones activas
    App->>M: GET /admin/duplicate-groups con Bearer JWT
    M->>C: Revalidar JWT y rol de ruta
    C->>S: listActiveGroups(actor)
    S->>DB: BEGIN, SET LOCAL app.user_id/app.role
    S->>R: Consultar grupo, canónico, miembros y versión
    R->>DB: SELECT parametrizado bajo RLS
    DB-->>R: Grupos activos autorizados
    R-->>S: Grupos activos
    S->>DB: COMMIT
    S->>P: Presentar grupos activos
    P-->>App: 200 JSON
  end
```

## Efecto de la resolución

- `POST /admin/duplicate-groups` usa
  `{ "canonical_report_id": "uuid", "report_ids": ["uuid", "uuid"], "note"?: string }`.
- El canónico sigue sujeto a su estado de moderación; la resolución no lo publica.
- Los miembros no canónicos quedan excluidos de mapa público y proyección de la
  Asociación de Hoteles de Chihuahua mientras la membresía esté activa.
- Reportes, fotos y evidencia permanecen intactos y vinculados.
- La eliminación lógica es un comando de moderación independiente y reversible;
  nunca forma parte de la resolución de duplicados.

## Fuentes

- [`../../API.md`](../../API.md): cola de moderación y rutas de grupos duplicados.
- [`../../DATA-MODEL.md`](../../DATA-MODEL.md): grafo pendiente, membresías y canonicidad.
- [`../../architecture/DECISIONS.md`](../../architecture/DECISIONS.md): ADR-004 y ADR-018.
