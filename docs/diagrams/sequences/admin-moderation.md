# Sequence: Administrator moderation queue

Replaces the old `GET /api/admin/reportes` and `PATCH /api/admin/reportes/{id}`
flow. There is no custom Controller. PostgREST exposes SQL RPCs.

**Mantener** in the original task is mapped to `admin_approve_report` (keep /
publish after review). Leaving the row untouched needs no RPC.

```mermaid
sequenceDiagram
  actor Admin
  participant App
  participant PostgREST
  participant Postgres

  Admin->>App: Open moderation queue
  App->>PostgREST: supabase.rpc("get_administrator_moderation_queue")
  PostgREST->>Postgres: EXECUTE get_administrator_moderation_queue
  Postgres-->>Postgres: Require administrator profile
  Postgres-->>PostgREST: Pending/hidden/flagged/duplicate rows<br/>status, reason, flags, trust
  PostgREST-->>App: JSON list
  App-->>Admin: Show queue

  alt Ocultar
    Admin->>App: Hide + required note
    App->>PostgREST: supabase.rpc("admin_hide_report")
    PostgREST->>Postgres: pending/visible → hidden<br/>write audit_log
  else Eliminar
    Admin->>App: Logical delete + required note
    App->>PostgREST: supabase.rpc("admin_logical_delete_report")
    PostgREST->>Postgres: → deleted (reversible)<br/>write audit_log
  else Mantener / publicar
    Admin->>App: Approve
    App->>PostgREST: supabase.rpc("admin_approve_report")
    PostgREST->>Postgres: pending/hidden → visible<br/>write audit_log
  end

  PostgREST-->>App: Success or typed error
  App->>PostgREST: supabase.rpc("get_administrator_moderation_queue")
  PostgREST-->>App: Updated list
  App-->>Admin: Refresh queue
```

## Call mapping

| UI action | RPC | Effect |
|---|---|---|
| Enter queue | `get_administrator_moderation_queue` | Read-only list with flag reasons and counts |
| Ocultar | `admin_hide_report` | `hidden`; note required |
| Eliminar | `admin_logical_delete_report` | Logical `deleted`; reversible; note required |
| Mantener | `admin_approve_report` | `visible`; starts/restarts public window |
| Restore later | `admin_restore_report` | `hidden`/`deleted` → `pending_review` (not in this screen’s three buttons) |

The original report fields are never edited. Association BI RPCs are not used here.
