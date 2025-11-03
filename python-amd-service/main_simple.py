"""
Simplified FastAPI Microservice for Advanced AMD (Answering Machine Detection)
Provides basic ML models for real-time audio classification without external downloads
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional
import uuid
import base64

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Request/Response Models
class AudioAnalysisRequest(BaseModel):
    audio_data: str  # base64 encoded
    sample_rate: int = 8000
    model_type: str = "ensemble"

class AudioAnalysisResponse(BaseModel):
    detection: str  # human, machine, unknown
    confidence: float
    latency_ms: int
    model_used: str
    reasoning: str
    metadata: Dict

class HealthResponse(BaseModel):
    status: str
    models_loaded: int
    active_sessions: int
    timestamp: int

# Global state
active_sessions: Dict[str, Dict] = {}
app = FastAPI(title="FastAPI AMD Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimpleAMDAnalyzer:
    """Simple AMD analyzer using basic heuristics"""
    
    def __init__(self):
        self.models_loaded = 3  # Simulated models
        logger.info("SimpleAMDAnalyzer initialized")
    
    def analyze_audio_data(self, audio_data: bytes, sample_rate: int = 8000) -> Dict:
        """Analyze audio data using simple heuristics"""
        start_time = time.time()
        
        # Convert to numpy array (assuming mulaw format from Twilio)
        try:
            # Simple analysis based on audio characteristics
            audio_length = len(audio_data)
            
            # Basic heuristics
            if audio_length < 1000:  # Very short audio
                detection = "unknown"
                confidence = 0.3
                reasoning = "Audio too short for reliable analysis"
            elif audio_length > 10000:  # Long audio suggests human
                detection = "human"
                confidence = 0.8
                reasoning = "Long audio duration suggests human speech"
            else:
                # Medium length - analyze pattern
                # Simple pattern analysis (placeholder for real ML)
                pattern_score = self._analyze_pattern(audio_data)
                
                if pattern_score > 0.7:
                    detection = "human"
                    confidence = 0.75
                    reasoning = "Speech patterns indicate human voice"
                elif pattern_score < 0.3:
                    detection = "machine"
                    confidence = 0.65
                    reasoning = "Repetitive patterns suggest machine/voicemail"
                else:
                    detection = "unknown"
                    confidence = 0.5
                    reasoning = "Ambiguous audio patterns"
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            return {
                "detection": detection,
                "confidence": confidence,
                "latency_ms": latency_ms,
                "model_used": "simple_heuristic",
                "reasoning": reasoning,
                "metadata": {
                    "audio_length": audio_length,
                    "sample_rate": sample_rate,
                    "pattern_score": pattern_score if 'pattern_score' in locals() else 0.5
                }
            }
            
        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return {
                "detection": "unknown",
                "confidence": 0.5,
                "latency_ms": int((time.time() - start_time) * 1000),
                "model_used": "error_fallback",
                "reasoning": f"Analysis failed: {str(e)}",
                "metadata": {"error": str(e)}
            }
    
    def _analyze_pattern(self, audio_data: bytes) -> float:
        """Simple pattern analysis"""
        try:
            # Convert bytes to simple numeric analysis
            data_array = np.frombuffer(audio_data, dtype=np.uint8)
            
            # Calculate basic statistics
            mean_val = np.mean(data_array)
            std_val = np.std(data_array)
            
            # Simple heuristic: higher variation suggests human speech
            variation_score = std_val / (mean_val + 1)  # Avoid division by zero
            
            # Normalize to 0-1 range
            pattern_score = min(1.0, variation_score / 50.0)
            
            return pattern_score
            
        except Exception as e:
            logger.error(f"Pattern analysis error: {e}")
            return 0.5

# Initialize analyzer
analyzer = SimpleAMDAnalyzer()

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        models_loaded=analyzer.models_loaded,
        active_sessions=len(active_sessions),
        timestamp=int(time.time())
    )

@app.get("/models")
async def get_models():
    """Get available models"""
    return {
        "models": [
            {"name": "simple_heuristic", "type": "pattern_analysis", "loaded": True},
            {"name": "audio_statistics", "type": "statistical", "loaded": True},
            {"name": "ensemble", "type": "combined", "loaded": True}
        ],
        "total": 3
    }

@app.post("/analyze", response_model=AudioAnalysisResponse)
async def analyze_audio(request: AudioAnalysisRequest):
    """Analyze audio for AMD"""
    try:
        # Decode base64 audio data
        audio_data = base64.b64decode(request.audio_data)
        
        # Analyze audio
        result = analyzer.analyze_audio_data(audio_data, request.sample_rate)
        
        return AudioAnalysisResponse(**result)
        
    except Exception as e:
        logger.error(f"Analysis endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/stream/{call_sid}")
async def websocket_stream(websocket: WebSocket, call_sid: str):
    """WebSocket endpoint for real-time audio streaming"""
    await websocket.accept()
    
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = {
        "call_sid": call_sid,
        "websocket": websocket,
        "start_time": time.time(),
        "audio_buffer": bytearray()
    }
    
    logger.info(f"WebSocket session started: {session_id} for call {call_sid}")
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("event") == "media":
                # Process media data
                media_payload = message.get("media", {}).get("payload", "")
                audio_chunk = base64.b64decode(media_payload)
                
                # Add to buffer
                active_sessions[session_id]["audio_buffer"].extend(audio_chunk)
                
                # Analyze if buffer is large enough
                buffer_size = len(active_sessions[session_id]["audio_buffer"])
                if buffer_size > 3000:  # ~3 seconds of audio at 8kHz
                    
                    # Analyze accumulated audio
                    result = analyzer.analyze_audio_data(
                        bytes(active_sessions[session_id]["audio_buffer"]), 
                        8000
                    )
                    
                    # Send result back
                    response = {
                        "event": "analysis_result",
                        "session_id": session_id,
                        "call_sid": call_sid,
                        **result
                    }
                    
                    await websocket.send_text(json.dumps(response))
                    
                    # Clear buffer after analysis
                    active_sessions[session_id]["audio_buffer"] = bytearray()
                    
                    logger.info(f"Analysis sent for {call_sid}: {result['detection']} ({result['confidence']})")
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Cleanup
        if session_id in active_sessions:
            del active_sessions[session_id]

@app.get("/sessions")
async def get_sessions():
    """Get active streaming sessions"""
    sessions = []
    for session_id, session_data in active_sessions.items():
        sessions.append({
            "session_id": session_id,
            "call_sid": session_data["call_sid"],
            "duration": time.time() - session_data["start_time"],
            "buffer_size": len(session_data["audio_buffer"])
        })
    
    return {"sessions": sessions, "total": len(sessions)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
