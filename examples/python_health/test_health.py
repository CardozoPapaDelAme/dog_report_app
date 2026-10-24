"""Tests for the synthetic health monitor (every Supabase call is mocked)."""

import httpx
from fastapi.testclient import TestClient

import app as health_app

client = TestClient(health_app.app)
BASE = "https://ref.supabase.co/functions/v1/api"

HEALTHY = {
    f"{BASE}/health": httpx.Response(200, json={"data": {"ok": True, "database": "up"}}),
    f"{BASE}/public/clusters?zoom=10&limit=5": httpx.Response(200, json={"data": []}),
    f"{BASE}/public/reports?limit=5": httpx.Response(200, json={"data": []}),
}


def _fake_get(routes, calls=None):
    def fake(url, timeout):
        if calls is not None:
            calls.append((url, timeout))
        answer = routes[url]
        if isinstance(answer, Exception):
            raise answer
        return answer

    return fake


def _stepping_clock(step_seconds):
    state = {"t": 0.0}

    def clock():
        state["t"] += step_seconds
        return state["t"]

    return clock


def _use(monkeypatch, routes, calls=None):
    monkeypatch.setenv("API_BASE_URL", BASE)
    monkeypatch.setattr(health_app.httpx, "get", _fake_get(routes, calls))


def test_health_up_when_every_component_answers(monkeypatch):
    calls = []
    _use(monkeypatch, HEALTHY, calls)

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "up"
    assert set(body["components"]) == {"api_database", "public_clusters", "public_reports"}
    assert all(c["status"] == "up" and c["http_status"] == 200 for c in body["components"].values())
    assert all(isinstance(c["latency_ms"], int) for c in body["components"].values())
    assert sorted(url for url, _ in calls) == sorted(HEALTHY)
    assert all(timeout == 10.0 for _, timeout in calls)


def test_health_503_when_the_api_reports_database_unavailable(monkeypatch):
    routes = {**HEALTHY, f"{BASE}/health": httpx.Response(503, json={"error": {"code": "database_unavailable"}})}
    _use(monkeypatch, routes)

    response = client.get("/health")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "down"
    assert body["components"]["api_database"] == {
        "status": "down", "http_status": 503, "latency_ms": body["components"]["api_database"]["latency_ms"],
        "error": "unexpected_response",
    }
    assert body["components"]["public_reports"]["status"] == "up"


def test_health_503_when_health_is_200_but_database_is_not_up(monkeypatch):
    routes = {**HEALTHY, f"{BASE}/health": httpx.Response(200, json={"data": {"ok": True, "database": "down"}})}
    _use(monkeypatch, routes)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["components"]["api_database"]["status"] == "down"


def test_health_503_when_supabase_unreachable(monkeypatch):
    routes = {**HEALTHY, f"{BASE}/public/clusters?zoom=10&limit=5": httpx.ConnectError("boom")}
    _use(monkeypatch, routes)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["components"]["public_clusters"] == {
        "status": "down", "http_status": None, "latency_ms": None, "error": "ConnectError",
    }


def test_health_503_when_a_timeout_happens(monkeypatch):
    routes = {**HEALTHY, f"{BASE}/public/reports?limit=5": httpx.ReadTimeout("slow")}
    _use(monkeypatch, routes)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["components"]["public_reports"]["error"] == "ReadTimeout"


def test_build_report_marks_degraded_when_latency_exceeds_the_threshold():
    config = {"api_base_url": BASE, "timeout_seconds": 10.0, "latency_threshold_ms": 3000}
    original = health_app.httpx.get
    health_app.httpx.get = _fake_get(HEALTHY)
    try:
        report, code = health_app.build_report(config, clock=_stepping_clock(4.0))
    finally:
        health_app.httpx.get = original

    assert code == 200
    assert report["status"] == "degraded"
    assert all(c["status"] == "slow" and c["latency_ms"] == 4000 for c in report["components"].values())


def test_load_config_reads_environment_and_strips_trailing_slash():
    config = health_app.load_config(
        {"API_BASE_URL": f"{BASE}/", "TIMEOUT_SECONDS": "5", "LATENCY_THRESHOLD_MS": "1500"}
    )

    assert config == {"api_base_url": BASE, "timeout_seconds": 5.0, "latency_threshold_ms": 1500}
    assert health_app.load_config({})["api_base_url"] == health_app.DEFAULT_API_BASE_URL
