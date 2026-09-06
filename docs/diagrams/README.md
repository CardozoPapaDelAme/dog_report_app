# Diagram Sources

This directory owns versioned diagram sources. Create a file only when that
diagram is requested. Do not pre-create unused sequences.

Contract owners remain outside this folder. Review diagrams with
[`../DIAGRAM-READINESS.md`](../DIAGRAM-READINESS.md).

## Layout

| Path | Use when |
|---|---|
| `context.md` | System context and components |
| `deployment.md` | Managed deployment boundary |
| `erd.md` | Project-owned tables and relationships |
| `states.md` | Report, photo, and duplicate state machines |
| `sequences/<name>.md` | One requested interaction flow |

## Rules

- One diagram per file.
- Actors, screens, and UX can follow the team’s existing flows.
- Server calls must match [`../API.md`](../API.md): `supabase.rpc(...)` or
  `/rest/v1/rpc/<function>`, never a custom `/api/...` Controller.
- Do not invent routes, services, or physical Supabase internals.
- Public map locations stay approximate. Live geofence activation stays
  approval-gated by the Asociación de Hoteles de Chihuahua.
- The SQL role remains `association`; diagrams label the actor as
  Asociación de Hoteles de Chihuahua.

## Inventory

No diagram sources have been added yet.
