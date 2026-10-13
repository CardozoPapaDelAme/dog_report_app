"""Tests for the standalone /health example (Supabase call is mocked)."""

import httpx
from fastapi.testclient import TestClient

import app as health_app

client = TestClient(health_app.app)


def _fake_get(response=None, error=None):
    def fake(url, timeout):
        if error:
            raise error
        return response

    return fake


def test_health_ok_when_supabase_is_up(monkeypatch):
    body = {"data": {"ok": True, "database": "up"}}
    monkeypatch.setattr(
        health_app.httpx, "get", _fake_get(httpx.Response(200, json=body))
    )

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "supabase": body}


def test_health_503_when_supabase_returns_error(monkeypatch):
    monkeypatch.setattr(health_app.httpx, "get", _fake_get(httpx.Response(503)))

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "supabase_status": 503}


def test_health_503_when_supabase_unreachable(monkeypatch):
    monkeypatch.setattr(
        health_app.httpx, "get", _fake_get(error=httpx.ConnectError("boom"))
    )

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "error": "ConnectError"}
