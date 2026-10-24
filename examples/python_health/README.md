# Python synthetic health monitor

Small FastAPI service that probes the deployed API's public endpoints, measures
each latency against the SLA threshold and answers one JSON report. It is not
part of the product backend (Hono Edge Function in `supabase/functions/api`).
An external uptime service (UptimeRobot) polls its `GET /health`, so a failure
in any component becomes a single alert. See `docs/deployment/MONITORING.md`.

```sh
cd examples/python_health
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

pytest                      # tests (every Supabase call is mocked)
uvicorn app:app --reload    # start the server
curl -i localhost:8000/health
```

## What it checks

| Component | Request | Healthy when |
|---|---|---|
| `api_database` | `GET /health` | 200 and `data.database == "up"` |
| `public_clusters` | `GET /public/clusters?zoom=10&limit=5` | 200 and `data` is a list |
| `public_reports` | `GET /public/reports?limit=5` | 200 and `data` is a list |

Each component reports `status` (`up`, `slow` or `down`), `http_status`,
`latency_ms` and `error`.

## Responses

- `200 {"status": "up", ...}`: every component answered within the threshold.
- `200 {"status": "degraded", ...}`: every component answered, at least one slower
  than `LATENCY_THRESHOLD_MS`.
- `503 {"status": "down", ...}`: at least one component failed, timed out or
  answered an unexpected body.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `API_BASE_URL` | staging API | API base, e.g. `https://<ref>.supabase.co/functions/v1/api` |
| `TIMEOUT_SECONDS` | `10` | Per-request timeout |
| `LATENCY_THRESHOLD_MS` | `3000` | Latency above this marks a component `slow` |

No keys or secrets are needed: every probed endpoint is public.

## Deploying (free tier)

Any service that runs a Python web process works. On Render (free web service):
root directory `examples/python_health`, build command
`pip install -r requirements.txt`, start command
`uvicorn app:app --host 0.0.0.0 --port $PORT`, and the variables above. Then add
the public `https://<service>/health` URL as a second UptimeRobot monitor; its
5-minute polling also keeps the free instance awake.

Quota: one report makes 3 Edge Function calls; polling every 5 minutes is about
26k invocations per month, well under the 500k Free limit.
