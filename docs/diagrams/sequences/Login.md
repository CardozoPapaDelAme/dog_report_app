# Sequence: Authenticated sign-in and role routing

Supabase Auth acquires or refreshes the session. The app then calls the Hono API
for the authoritative active profile; a token alone never grants role access.

```mermaid
sequenceDiagram
  actor User as Asociación de Hoteles de Chihuahua or Administrator
  participant App as React Native app
  participant Auth as Supabase Auth
  participant M as Hono auth middleware
  participant C as Identity Controller
  participant S as IdentityService
  participant R as ProfileRepository
  participant DB as PostgreSQL / RLS
  participant P as JSON Presenter

  User->>App: Enter provisioned credentials
  App->>Auth: Acquire session
  alt Credentials rejected by Auth
    Auth-->>App: Authentication error, no session
    App-->>User: Show sign-in error
  else Session acquired
    Auth-->>App: Short-lived access JWT and refresh material
    App->>App: Store refresh material in platform secure storage
    App->>M: GET /me and Bearer JWT
    alt Missing or invalid access token
      M->>P: Map authentication failure
      P-->>App: 401 authentication_required or invalid_token
      App-->>User: Require sign-in or session refresh
    else Signature and required claims valid
      M->>C: Verified subject and app_role
      C->>S: getProfile(verified actor)
      S->>DB: BEGIN, SET LOCAL app.user_id/app.role
      S->>R: Load matching active profile
      R->>DB: Parameterized SELECT under RLS
      DB-->>R: Profile or no authorized row
      alt Inactive profile
        S->>DB: ROLLBACK
        S->>P: Map inactive profile
        P-->>App: 403 inactive_profile
        App-->>User: Deny access
      else Claim/profile role mismatch
        S->>DB: ROLLBACK
        S->>P: Map role mismatch
        P-->>App: 403 role_mismatch
        App-->>User: Deny access
      else Active matching profile
        S->>DB: COMMIT
        S->>P: ProfileView
        P-->>App: 200 data=ProfileView
        alt role is association
          App-->>User: Open Asociación dashboard
        else role is administrator
          App-->>User: Open Administrator command center
        end
      end
    end
  end

  opt Access JWT expires during a later session
    App->>Auth: Refresh session
    Auth-->>App: New session or refresh failure
    Note over App,M: After success, privileged domain calls repeat JWT, active-profile, and sibling-role checks.
  end
```

## Sources

- [`../../API.md`](../../API.md): `GET /me`, response envelope, and authentication errors.
- [`../../SECURITY.md`](../../SECURITY.md): manual provisioning, secure refresh storage, and fail-closed profile checks.
- [`../../architecture/DECISIONS.md`](../../architecture/DECISIONS.md): ADR-001, ADR-012, ADR-018, and ADR-019.
