# Python /health example

Standalone FastAPI example. Its `GET /health` calls the public Supabase API
health endpoint (`/functions/v1/api/health`) and reports the result. It is not
part of the product backend (Hono Edge Function in `supabase/functions/api`)
and is not wired into CI or deployment.

```sh
cd examples/python_health
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

pytest                      # tests (Supabase call is mocked)
uvicorn app:app --reload    # start the server
curl -i localhost:8000/health
```

Responses:

- `200 {"status": "ok", "supabase": {...}}` when Supabase answers 200.
- `503 {"status": "unavailable", ...}` when Supabase answers non-200 or is unreachable.

To probe another environment, set `SUPABASE_HEALTH_URL` before starting the server.
No keys or secrets are needed: the endpoint is public.
