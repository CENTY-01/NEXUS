-- Nexus persistence schema (SQLite)
-- Documented here as plain SQL even though the Python app creates it
-- programmatically on boot (see app/db.py) — kept as the source of truth
-- for the schema and for anyone restoring/inspecting the database by hand.

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guestbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS visit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    visited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_visit_log_time ON visit_log(visited_at);
