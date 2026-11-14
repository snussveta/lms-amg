import asyncio
import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger("exam_manager")


class LiveExamManager:
    def __init__(self):
        # session_id -> Set of active WebSocket connections
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, session_id: int, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            if session_id not in self.active_connections:
                self.active_connections[session_id] = set()
            self.active_connections[session_id].add(websocket)
        logger.info(f"[LiveExam] Client connected to session #{session_id}. Active count: {len(self.active_connections[session_id])}")

    async def disconnect(self, session_id: int, websocket: WebSocket):
        async with self.lock:
            if session_id in self.active_connections:
                self.active_connections[session_id].discard(websocket)
                if not self.active_connections[session_id]:
                    del self.active_connections[session_id]
        logger.info(f"[LiveExam] Client disconnected from session #{session_id}")

    async def broadcast(self, session_id: int, message: dict):
        """Sends a JSON message to all connected clients in the exam session."""
        async with self.lock:
            connections = list(self.active_connections.get(session_id, []))

        if not connections:
            return

        payload = json.dumps(message, default=str)
        tasks = []
        for ws in connections:
            tasks.append(self._safe_send(session_id, ws, payload))
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_send(self, session_id: int, ws: WebSocket, payload: str):
        try:
            await ws.send_text(payload)
        except Exception:
            await self.disconnect(session_id, ws)


live_exam_manager = LiveExamManager()
