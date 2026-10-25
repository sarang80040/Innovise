from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api import routes
from backend.app.api.websocket import ws_manager
from backend.app.core.cluster import ClusterCoordinator
from backend.app.core.experiments import ExperimentRunner


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register websocket broadcast callback
    routes.coordinator.register_broadcast_callback(ws_manager.broadcast)

    # Start cluster simulation loop
    await routes.coordinator.start()

    yield

    # Shutdown
    await routes.coordinator.stop()


app = FastAPI(
    title="Blockchain Consensus Failure Simulator API",
    description="Adaptive Raft-style distributed consensus simulator under network failures, partitions, and malicious activity.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST API routes
app.include_router(routes.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open and receive any client ping messages
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
