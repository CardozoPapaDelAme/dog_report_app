"""Standalone example: minimal FastAPI app exposing a health endpoint.

This is NOT part of the product backend (which is the Hono Edge Function in
``supabase/functions/api``). It exists only as a self-contained Python example.
"""

from fastapi import FastAPI

app = FastAPI(title="Health example")


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check: returns 200 with a static ``ok`` status."""
    return {"status": "ok"}
