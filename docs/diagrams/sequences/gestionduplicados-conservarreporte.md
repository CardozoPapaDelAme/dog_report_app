# Secuencia: conservar reportes y revertir una resolución de duplicados

Conservar todos los reportes ya resueltos se implementa revirtiendo el grupo
activo. Esto desactiva sus membresías y devuelve los candidatos a revisión; no
elimina reportes ni cierra definitivamente la sugerencia.

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

  Admin->>App: Abre resoluciones activas
  App->>M: GET /admin/duplicate-groups con Bearer JWT
  alt Token ausente o inválido
    M->>P: Mapear fallo de autenticación
    P-->>App: 401 authentication_required o invalid_token
    App-->>Admin: Denegar acceso
  else JWT válido
    M->>C: Sujeto y app_role verificados
    C->>S: listActiveGroups(actor)
    S->>DB: BEGIN, SET LOCAL app.user_id/app.role
    S->>R: Validar Administrator y consultar grupos activos
    R->>DB: SELECT parametrizado bajo RLS
    alt Perfil inactivo o rol hermano incorrecto
      S->>DB: ROLLBACK
      S->>P: Mapear fallo de autorización
      P-->>App: 403 inactive_profile, role_mismatch o forbidden
      App-->>Admin: Denegar acceso
    else Consulta autorizada
      DB-->>R: id, canonical_report_id, miembros, fecha y versión
      R-->>S: Grupos activos
      S->>DB: COMMIT
      S->>P: Presentar grupos activos
      P-->>App: 200 JSON
      App-->>Admin: Mostrar resolución y evidencia original
    end
  end

  opt Administrator selecciona un grupo activo
    Admin->>App: Solicita conservar reportes y escribe nota
    App->>M: POST /admin/duplicate-groups/:group_id/reverse con Bearer JWT
    M->>C: Revalidar JWT y rol de ruta
    C->>S: reverse(group_id, note, actor)
    S->>DB: BEGIN, SET LOCAL app.user_id/app.role
    S->>R: Bloquear grupo activo y membresías
    R->>DB: Marcar grupo reversed, desactivar membresías y restaurar candidatos
    R->>DB: Insertar auditoría en la misma transacción
    alt Grupo inexistente, ya revertido o conflicto concurrente
      S->>DB: ROLLBACK
      S->>P: Mapear conflicto de duplicados
      P-->>App: 409
      App-->>Admin: Mantener vista y solicitar recarga
    else Reversión válida
      S->>DB: COMMIT
      S->>P: Presentar resultado
      P-->>App: 200 JSON
      App-->>Admin: Confirmar que ya no hay miembros no canónicos activos
    end
  end
```

## Diferencia entre conservar, revertir y eliminar

| Acción | Resultado |
|---|---|
| Seleccionar canónico | Crea un grupo activo; no fusiona contenido ni elimina filas |
| `POST /admin/duplicate-groups/:group_id/reverse` | Revierte el grupo, desactiva membresías y restaura la revisión de candidatos |
| `POST /admin/reports/:report_id/delete` | Eliminación lógica independiente, reversible y auditada |
| Retención | Único proceso que puede borrar físicamente cuando corresponde |

## Brecha contractual

Aunque el modelo persistente admite candidatos `dismissed`, `docs/API.md` no
expone un comando para descartar una sugerencia pendiente como “no son
duplicados”. Por ello este diagrama solo permite conservar mediante reversión de
un grupo activo; no fabrica un endpoint `KEEP_BOTH` ni acceso directo a tablas.

## Fuentes

- [`../../API.md`](../../API.md): consulta y reversión exacta de grupos duplicados.
- [`../../DATA-MODEL.md`](../../DATA-MODEL.md): reversibilidad y restauración de candidatos.
- [`../../../db/schema.sql`](../../../db/schema.sql): estados `pending`, `confirmed`, `dismissed`, `active` y `reversed`.
