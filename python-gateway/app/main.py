"""
Nexus gateway — the Python side of a deliberately polyglot stack.

Responsibilities:
  - Serves the REST API consumed by the JS frontend
  - Hosts the WebSocket endpoint powering live chat + the live visitor counter
  - Owns persistence (SQLite) for chat history, guestbook entries, and visits
  - Proxies to the Java "Cruncher" microservice and blends its response with
    Python-side data — the whole point being to demonstrate a real
    polyglot microservice call, not just "here are two unrelated services"
"""
import os
import random
import time
import uuid

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import db, live
from app.markov import generate as markov_generate

JAVA_SERVICE_URL = os.environ.get("JAVA_SERVICE_URL", "http://localhost:8081")

app = FastAPI(title="Nexus Gateway", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    db.init_db()


# ---------- Simple content banks ----------

QUOTES = [
    ("The best error message is the one that never shows up.", "Thomas Fuchs"),
    ("Programs must be written for people to read, and only incidentally for machines to execute.", "Harold Abelson"),
    ("There are only two hard things in Computer Science: cache invalidation and naming things.", "Phil Karlton"),
    ("Simplicity is prerequisite for reliability.", "Edsger W. Dijkstra"),
    ("First, solve the problem. Then, write the code.", "John Johnson"),
    ("Talk is cheap. Show me the code.", "Linus Torvalds"),
    ("Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", "Martin Fowler"),
    ("Premature optimization is the root of all evil.", "Donald Knuth"),
]

JOKES = [
    "Why do Java developers wear glasses? Because they don't C#.",
    "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "There are only 10 types of people: those who understand binary and those who don't.",
    "I'd tell you a UDP joke, but you might not get it.",
    "How many programmers does it take to change a light bulb? None — that's a hardware problem.",
]


# ---------- REST: content ----------

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "nexus-gateway-python", "time": int(time.time())}


@app.get("/api/quote")
def get_quote():
    text, author = random.choice(QUOTES)
    return {"text": text, "author": author}


@app.get("/api/joke")
def get_joke():
    return {"joke": random.choice(JOKES)}


@app.get("/api/markov")
def get_markov_text(words: int = 25):
    words = max(3, min(words, 80))
    return {"text": markov_generate(max_words=words)}


# ---------- REST: polyglot stats (Python calls Java, blends the result) ----------

@app.get("/api/stats")
async def combined_stats():
    """Demonstrates the actual polyglot call: this Python service reaches
    out to the Java microservice over HTTP, and merges its response with
    Python-owned data (visitor counts from SQLite, live WS connections)
    into one payload the frontend renders as a single dashboard."""
    java_status = "unreachable"
    primes_preview = []
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{JAVA_SERVICE_URL}/primes", params={"limit": 100})
            resp.raise_for_status()
            data = resp.json()
            primes_preview = data.get("primes", [])[:10]
            java_status = "ok"
    except Exception:
        pass

    return {
        "pythonService": "ok",
        "javaService": java_status,
        "livePresence": live.manager.count,
        "totalVisits": db.total_visits(),
        "uniqueVisitors": db.unique_visitors(),
        "primesPreviewFromJava": primes_preview,
    }


@app.get("/api/cruncher/primes")
async def proxy_primes(limit: int = 100):
    return await _proxy_java("/primes", {"limit": limit})


@app.get("/api/cruncher/collatz")
async def proxy_collatz(start: int = 27):
    return await _proxy_java("/collatz", {"start": start})


@app.get("/api/cruncher/textanalysis")
async def proxy_textanalysis(text: str = ""):
    return await _proxy_java("/textanalysis", {"text": text})


async def _proxy_java(path: str, params: dict):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{JAVA_SERVICE_URL}{path}", params=params)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Java service error: {e}")


# ---------- REST: visits + guestbook (SQLite) ----------

@app.post("/api/visit")
def record_visit(session_id: str | None = None):
    sid = session_id or str(uuid.uuid4())
    db.log_visit(sid)
    return {"sessionId": sid, "totalVisits": db.total_visits(), "uniqueVisitors": db.unique_visitors()}


class GuestbookEntry(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    message: str = Field(min_length=1, max_length=280)


@app.get("/api/guestbook")
def list_guestbook():
    return db.all_guestbook_entries()


@app.post("/api/guestbook")
def add_guestbook(entry: GuestbookEntry):
    return db.insert_guestbook_entry(entry.name, entry.message)


# ---------- WebSocket: live chat + presence ----------

@app.websocket("/ws/live")
async def live_socket(websocket: WebSocket, username: str = "Anonymous"):
    username = (username or "Anonymous")[:24]
    await live.manager.connect(websocket, username)

    history = db.recent_chat_messages(20)
    await websocket.send_json({"type": "history", "messages": history})

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "chat":
                body = str(data.get("body", ""))[:280].strip()
                if not body:
                    continue
                saved = db.insert_chat_message(username, body)
                await live.manager.broadcast({"type": "chat", "message": saved})
            elif data.get("type") == "cursor":
                await live.manager.broadcast({
                    "type": "cursor",
                    "username": username,
                    "x": data.get("x"),
                    "y": data.get("y"),
                })
    except WebSocketDisconnect:
        live.manager.disconnect(websocket)
        await live.manager.broadcast({"type": "presence", "count": live.manager.count})
