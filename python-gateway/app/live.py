"""Manages live WebSocket connections for the visitor counter + chat feed.
Kept in-memory and process-local — documented as a scaling limitation in
the README, same pattern as the PulseBoard project's presence map.
"""
from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        self.active: dict[WebSocket, str] = {}  # socket -> username

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active[websocket] = username
        await self.broadcast({"type": "presence", "count": len(self.active)})

    def disconnect(self, websocket: WebSocket):
        self.active.pop(websocket, None)

    async def broadcast(self, message: dict):
        dead = []
        payload = json.dumps(message)
        for ws in list(self.active.keys()):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.pop(ws, None)

    @property
    def count(self) -> int:
        return len(self.active)


manager = ConnectionManager()
