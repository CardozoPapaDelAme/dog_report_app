# Sequence: Administrator moderation queue

Administrator reads moderation context and executes audited state commands. The
original report content is immutable through this flow, and Administrator does
not inherit Asociación de Hoteles de Chihuahua BI/export access.

```mermaid
sequenceDiagram
  actor Admin as Administrator
  participant App as React Native app
  participant M as Hono JWT middleware
  participant C as Moderation Controller
  participant S as ModerationService
  participant R as ModerationRepository
  participant DB as PostgreSQL / RLS
  participant P as JSON Presenter

  Admin->>App: Open moderation queue
  App->>M: GET /admin/moderation-queue with limit, cursor, and Bearer JWT
  alt Missing or invalid token
    M->>P: Map authentication failure
    P-->>App: 401 authentication_required or invalid_token
    App-->>Admin: Deny access
  else JWT valid
    M->>C: Verified subject and app_role
    C->>S: listQueue(actor, query)
    S->>DB: BEGIN, SET LOCAL app.user_id/app.role
    S->>R: Validate active Administrator and list context
    R->>DB: Parameterized SELECT under RLS
    alt Inactive or mismatched profile
      S->>DB: ROLLBACK
      S->>P: Map authorization failure
      P-->>App: 403 inactive_profile, role_mismatch, or forbidden
      App-->>Admin: Deny access
    else Queue authorized
      DB-->>R: Original fields, signals, flags, trust, photo, duplicates
      R-->>S: Page and next_cursor
      S->>DB: COMMIT
      S->>P: Authorized queue view
      P-->>App: 200 JSON
      App-->>Admin: Show moderation queue
    end
  end

  opt Administrator selects a loaded report
    alt Approve pending or hidden report
      Admin->>App: Approve, note optional
      App->>M: POST /admin/reports/:report_id/approve and Bearer JWT
    else Hide pending or visible report
      Admin->>App: Hide with required note
      App->>M: POST /admin/reports/:report_id/hide and Bearer JWT
    else Logically delete non-deleted report
      Admin->>App: Delete with required note
      App->>M: POST /admin/reports/:report_id/delete and Bearer JWT
    else Restore hidden or deleted report
      Admin->>App: Restore with required note
      App->>M: POST /admin/reports/:report_id/restore and Bearer JWT
    end

    M->>C: Reverify JWT and route role
    C->>S: Execute state command(actor, report_id, body)
    S->>DB: BEGIN, SET LOCAL app.user_id/app.role
    S->>R: Revalidate profile, lock report, transition, append audit
    R->>DB: Parameterized statements in one transaction
    alt Invalid or stale state
      S->>DB: ROLLBACK
      S->>P: Map invalid transition
      P-->>App: 409 invalid_*_transition
    else Command succeeds
      S->>DB: COMMIT
      S->>P: Present command result
      P-->>App: 200 JSON
      App->>M: GET /admin/moderation-queue and Bearer JWT
      Note over M,P: Refresh repeats the same middleware, Controller, Service, Repository, and Presenter path.
      App-->>Admin: Refresh queue
    end
  end
```

## State effects

| Command | Effect |
|---|---|
| `POST /admin/reports/:report_id/approve` | `pending_review`/`hidden` → `visible`; starts or restarts the 90-day public window |
| `POST /admin/reports/:report_id/hide` | `pending_review`/`visible` → `hidden` |
| `POST /admin/reports/:report_id/delete` | Any non-deleted state → reversible `deleted`; never hard-deletes |
| `POST /admin/reports/:report_id/restore` | `hidden`/`deleted` → `pending_review`; approval is still required to publish |

Every successful command locks, transitions, and appends audit evidence in the
same transaction. Hard deletion belongs only to retention.

## Sources

- [`../../API.md`](../../API.md): Administrator queue, command routes, bodies, and errors.
- [`../../DATA-MODEL.md`](../../DATA-MODEL.md): moderation state machine and retention.
- [`../../SECURITY.md`](../../SECURITY.md): sibling roles, immutable evidence, and audit controls.
