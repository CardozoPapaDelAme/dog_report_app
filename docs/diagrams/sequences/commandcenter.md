# Secuencia: Command Center de Administrator

El contrato no define un endpoint agregado de dashboard. El Command Center usa la
cola de moderación contratada y solo puede resumir localmente la página recibida;
no obtiene BI de la Asociación de Hoteles de Chihuahua.

```mermaid
sequenceDiagram
  actor Admin as Administrator
  participant App as Aplicación React Native
  participant M as Middleware JWT de Hono
  participant C as Moderation Controller
  participant S as ModerationService
  participant R as ModerationRepository
  participant DB as PostgreSQL / RLS
  participant P as JSON Presenter

  Admin->>App: Abre Command Center
  App->>M: GET /admin/moderation-queue con limit, cursor y Bearer JWT
  alt Token ausente o inválido
    M->>P: Mapear fallo de autenticación
    P-->>App: 401 authentication_required o invalid_token
    App-->>Admin: Deniega acceso
  else JWT válido
    M->>C: Sujeto y app_role verificados
    C->>S: listQueue(actor, query)
    S->>DB: BEGIN, SET LOCAL app.user_id/app.role
    S->>R: Validar perfil Administrator y consultar contexto
    R->>DB: SELECT parametrizado bajo RLS
    alt Perfil inactivo o rol hermano incorrecto
      S->>DB: ROLLBACK
      S->>P: Mapear autorización fallida
      P-->>App: 403 inactive_profile, role_mismatch o forbidden
      App-->>Admin: Deniega acceso
    else Perfil Administrator activo y coincidente
      DB-->>R: Reportes y contexto de moderación
      R-->>S: Página y next_cursor
      S->>DB: COMMIT
      S->>P: Vista de cola autorizada
      P-->>App: 200 JSON
      App->>App: Resumir únicamente la página cargada
      App-->>Admin: Mostrar tarjetas y accesos a revisión
    end
  end
```

## Alcance y brecha contractual

- Ruta utilizada: `GET /admin/moderation-queue?limit=<1..500>&cursor=`.
- La respuesta puede incluir campos originales, ubicación exacta, señales GPS,
  mock/honeypot, confianza, denuncias, foto y contexto de duplicados.
- No se modifica contenido original y no se consulta `GET /association/reports`.
- **Brecha:** `docs/API.md` no contrata `GET /admin/dashboard` ni estadísticas
  agregadas globales. Un resumen global requiere ampliar el contrato; este flujo
  no lo fabrica a partir de acceso directo a tablas.

## Fuentes

- [`../../API.md`](../../API.md): contrato de la cola de moderación.
- [`../../SECURITY.md`](../../SECURITY.md): roles hermanos y autorización en profundidad.
- [`../../architecture/DECISIONS.md`](../../architecture/DECISIONS.md): ADR-001, ADR-018 y ADR-019.
