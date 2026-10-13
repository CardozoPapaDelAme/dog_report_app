"""Standalone example: FastAPI app whose /health calls the Supabase API health.

This is NOT part of the product backend (which is the Hono Edge Function in
``supabase/functions/api``). It only probes that function's public
``GET /health`` endpoint and reports the result.
"""

import os

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse

SUPABASE_HEALTH_URL = os.environ.get(
    "SUPABASE_HEALTH_URL",
    "https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api/health",
)
TIMEOUT_SECONDS = 5.0

app = FastAPI(title="Health example")


@app.get("/health")
def health() -> JSONResponse:
    """Call the Supabase health endpoint.

    Returns 200 ``{"status": "ok", "supabase": <upstream body>}`` when Supabase
    answers 200, otherwise 503 ``{"status": "unavailable", ...}``.
    """
    try:
        upstream = httpx.get(SUPABASE_HEALTH_URL, timeout=TIMEOUT_SECONDS)
    except httpx.HTTPError as error:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "error": type(error).__name__},
        )

    if upstream.status_code != 200:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "supabase_status": upstream.status_code},
        )

    return JSONResponse(content={"status": "ok", "supabase": upstream.json()})
