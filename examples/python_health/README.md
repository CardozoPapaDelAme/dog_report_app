# Python /health example

Standalone FastAPI example. It is not part of the product backend (Hono Edge
Function in `supabase/functions/api`) and is not wired into CI or deployment.

```sh
cd examples/python_health
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

pytest                      # run the test
uvicorn app:app --reload    # start the server
curl -i localhost:8000/health
```

Expected response: `200 {"status": "ok"}`.
