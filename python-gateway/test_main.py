"""Tests for the Nexus gateway. Run with: pytest"""
import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Use an isolated throwaway DB for tests, set before importing the app
_tmpdir = tempfile.mkdtemp()
os.environ["DB_PATH"] = str(Path(_tmpdir) / "test.db")

sys.path.insert(0, str(Path(__file__).parent))
from app.main import app  # noqa: E402
from app import db  # noqa: E402

db.init_db()  # TestClient doesn't trigger startup events unless used as a context manager
client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_quote_returns_text_and_author():
    res = client.get("/api/quote")
    assert res.status_code == 200
    body = res.json()
    assert "text" in body and "author" in body


def test_joke_returns_string():
    res = client.get("/api/joke")
    assert res.status_code == 200
    assert isinstance(res.json()["joke"], str)


def test_markov_respects_word_bounds():
    res = client.get("/api/markov?words=500")
    assert res.status_code == 200
    text = res.json()["text"]
    assert len(text.split()) <= 82  # capped at 80 + punctuation slack


def test_guestbook_roundtrip():
    res = client.post("/api/guestbook", json={"name": "Alice", "message": "Hello!"})
    assert res.status_code == 200
    entry = res.json()
    assert entry["name"] == "Alice"

    listing = client.get("/api/guestbook")
    assert listing.status_code == 200
    assert any(e["name"] == "Alice" for e in listing.json())


def test_guestbook_rejects_empty_name():
    res = client.post("/api/guestbook", json={"name": "", "message": "Hi"})
    assert res.status_code == 422


def test_visit_tracking_increments():
    r1 = client.post("/api/visit")
    sid = r1.json()["sessionId"]
    before = r1.json()["totalVisits"]

    r2 = client.post(f"/api/visit?session_id={sid}")
    after = r2.json()["totalVisits"]
    assert after == before + 1
    # Same session id shouldn't add a new unique visitor
    assert r2.json()["uniqueVisitors"] == r1.json()["uniqueVisitors"]


def test_stats_endpoint_shape():
    res = client.get("/api/stats")
    assert res.status_code == 200
    body = res.json()
    for key in ["pythonService", "javaService", "livePresence", "totalVisits", "uniqueVisitors"]:
        assert key in body


def test_websocket_chat_flow():
    with client.websocket_connect("/ws/live?username=Tester") as ws:
        presence = ws.receive_json()
        assert presence["type"] == "presence"

        history = ws.receive_json()
        assert history["type"] == "history"

        ws.send_json({"type": "chat", "body": "test message"})
        broadcast = ws.receive_json()
        assert broadcast["type"] == "chat"
        assert broadcast["message"]["body"] == "test message"
        assert broadcast["message"]["username"] == "Tester"
