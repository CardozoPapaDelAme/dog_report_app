# Sequence: Asociación de Hoteles de Chihuahua dashboard and export

The dashboard reads only the accepted canonical business projection. Statistics
and CSV/XLSX files are derived in the app from that same paginated projection;
there is no separate statistics or export endpoint.

```mermaid
sequenceDiagram
  actor Association as Asociación de Hoteles de Chihuahua
  participant App as React Native app
  participant M as Hono JWT middleware
  participant C as Association Controller
  participant S as AssociationService
  participant R as AssociationRepository
  participant DB as PostgreSQL / PostGIS / RLS
  participant P as JSON Presenter

  Association->>App: Open dashboard or change filters
  loop While next_cursor is present and the requested data is needed
    App->>M: GET /association/reports with from, to, limit, cursor, and Bearer JWT
    alt Missing or invalid token
      M->>P: Map authentication failure
      P-->>App: 401 authentication_required or invalid_token
    else Valid JWT
      M->>C: Verified subject and app_role
      C->>S: listReports(actor, filters, cursor)
      S->>DB: BEGIN, SET LOCAL app.user_id/app.role
      S->>R: Validate active association profile and query projection
      R->>DB: Parameterized SELECT under RLS
      alt Inactive, mismatched, or Administrator profile
        S->>DB: ROLLBACK
        S->>P: Map authorization failure
        P-->>App: 403 inactive_profile, role_mismatch, or forbidden
      else Active matching association profile
        DB-->>R: Accepted canonical business rows only
        R-->>S: Page and next_cursor
        S->>DB: COMMIT
        S->>P: AssociationReportView page
        P-->>App: 200 JSON
      end
    end
  end
  App->>App: Calculate date, incident, and trend views from authorized rows
  App-->>Association: Show dashboard

  opt Export CSV or XLSX
    Association->>App: Export current authorized dataset
    App->>App: Serialize the same AssociationReportView fields
    App-->>Association: Save CSV or XLSX locally
  end
```

## Projection rules

Route: `GET /association/reports?from=&to=&limit=<1..5000>&cursor=`.

The projection includes accepted canonical business data retained for up to five
years. It excludes pending, hidden, deleted, non-canonical, fingerprint, raw EXIF,
flag, trust, moderation, private-path, and operator-identity data. Administrator
does not inherit this route.

## Contract gap

RF16 requires statistics by zone, but `AssociationReportView` does not include a
zone identifier and the API exposes no association zone-metadata or aggregate
route. The diagram therefore does not claim an official zone statistic; that
capability requires an explicit API contract extension.

## Sources

- [`../../API.md`](../../API.md): association route, pagination, fields, and export parity.
- [`../../DATA-MODEL.md`](../../DATA-MODEL.md): canonical disposition and retention.
- [`../../SECURITY.md`](../../SECURITY.md): sibling-role capability matrix.
