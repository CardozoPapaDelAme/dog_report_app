"""Synthetic health monitor for the deployed Supabase API.

This is NOT part of the product backend (which is the Hono Edge Function in
``supabase/functions/api``). It is a small external service that probes the
API's public read endpoints, measures each latency, compares it with the SLA
threshold and answers one JSON report. An uptime service (UptimeRobot) polls
its ``GET /health`` so a failure in any component becomes one alert.

Configuration (environment variables, no secrets needed):

- ``API_BASE_URL``: API base, e.g. ``https://<ref>.supabase.co/functions/v1/api``.
- ``TIMEOUT_SECONDS``: per-request timeout (default 10).
- ``LATENCY_THRESHOLD_MS``: a slower component marks the report ``degraded`` (default 3000).
"""

import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse

DEFAULT_API_BASE_URL = "https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api"

# Component name -> (path, validator of the parsed JSON body).
CHECKS = {
    "api_database": (
        "/health",
        lambda body: isinstance(body, dict) and (body.get("data") or {}).get("database") == "up",
    ),
    "public_clusters": (
        "/public/clusters?zoom=10&limit=5",
        lambda body: isinstance(body, dict) and isinstance(body.get("data"), list),
    ),
    "public_reports": (
        "/public/reports?limit=5",
        lambda body: isinstance(body, dict) and isinstance(body.get("data"), list),
    ),
}

app = FastAPI(title="Dog Report synthetic health monitor")


def load_config(env=None):
    """Read the monitor configuration from environment variables."""
    env = os.environ if env is None else env
    return {
        "api_base_url": env.get("API_BASE_URL", DEFAULT_API_BASE_URL).rstrip("/"),
        "timeout_seconds": float(env.get("TIMEOUT_SECONDS", "10")),
        "latency_threshold_ms": int(env.get("LATENCY_THRESHOLD_MS", "3000")),
    }


def check_component(url, validate, timeout_seconds, latency_threshold_ms, clock=time.perf_counter):
    """Probe one endpoint and return its status, HTTP code and latency in ms."""
    started = clock()
    try:
        response = httpx.get(url, timeout=timeout_seconds)
    except httpx.HTTPError as error:
        return {"status": "down", "http_status": None, "latency_ms": None, "error": type(error).__name__}
    latency_ms = round((clock() - started) * 1000)
    try:
        body = response.json()
    except ValueError:
        body = None
    if response.status_code != 200 or not validate(body):
        return {"status": "down", "http_status": response.status_code, "latency_ms": latency_ms,
                "error": "unexpected_response"}
    status = "slow" if latency_ms > latency_threshold_ms else "up"
    return {"status": status, "http_status": 200, "latency_ms": latency_ms, "error": None}


def build_report(config, clock=time.perf_counter):
    """Run every check and combine them into one report and HTTP status code."""
    components = {
        name: check_component(
            config["api_base_url"] + path, validate,
            config["timeout_seconds"], config["latency_threshold_ms"], clock,
        )
        for name, (path, validate) in CHECKS.items()
    }
    statuses = {c["status"] for c in components.values()}
    if "down" in statuses:
        overall, code = "down", 503
    elif "slow" in statuses:
        overall, code = "degraded", 200
    else:
        overall, code = "up", 200
    report = {
        "status": overall,
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "latency_threshold_ms": config["latency_threshold_ms"],
        "components": components,
    }
    return report, code


@app.get("/health")
def health() -> JSONResponse:
    """Return 200 when every component answers (``up`` or ``degraded``), else 503."""
    report, code = build_report(load_config())
    return JSONResponse(status_code=code, content=report)
