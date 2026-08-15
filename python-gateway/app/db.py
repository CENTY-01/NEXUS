"""SQLite persistence layer. Deliberately kept dependency-free (stdlib
sqlite3) since this app's write volume doesn't warrant an ORM or an
external database — the schema lives in schema.sql as the documented
source of truth, applied here on startup.
"""
import sqlite3
import time
import os
from pathlib import Path
from contextlib import contextmanager

DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).parent.parent / "data" / "nexus.db"))
SCHEMA_PATH = Path(__file__).parent.parent / "schema.sql"


def init_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA_PATH.read_text())


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def insert_chat_message(username: str, body: str) -> dict:
    now = int(time.time() * 1000)
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO chat_messages (username, body, created_at) VALUES (?, ?, ?)",
            (username, body, now),
        )
        return {"id": cur.lastrowid, "username": username, "body": body, "created_at": now}


def recent_chat_messages(limit: int = 30) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, username, body, created_at FROM chat_messages ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in reversed(rows)]


def insert_guestbook_entry(name: str, message: str) -> dict:
    now = int(time.time() * 1000)
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO guestbook (name, message, created_at) VALUES (?, ?, ?)",
            (name, message, now),
        )
        return {"id": cur.lastrowid, "name": name, "message": message, "created_at": now}


def all_guestbook_entries(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, message, created_at FROM guestbook ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def log_visit(session_id: str):
    now = int(time.time() * 1000)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO visit_log (session_id, visited_at) VALUES (?, ?)",
            (session_id, now),
        )


def total_visits() -> int:
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM visit_log").fetchone()
        return row["c"]


def unique_visitors() -> int:
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(DISTINCT session_id) as c FROM visit_log").fetchone()
        return row["c"]
