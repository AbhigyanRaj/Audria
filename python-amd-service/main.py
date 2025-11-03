"""
FastAPI Microservice for Advanced AMD (Answering Machine Detection)
Provides multiple ML models for real-time audio classification
"""

import asyncio
import json
import logging
import ssl
import os
ssl._create_default_https_context = ssl._create_unverified_context
os.environ['CURL_CA_BUNDLE'] = ''
import tempfile
import time
from typing import Dict, List, Optional, Union
import uuid
import wave

import librosa
import numpy as np
import torch
import torchaudio
import whisper
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline, Wav2Vec2Processor, Wav2Vec2ForCTC
import uvicorn
import webrtcvad

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AMD ML Microservice",
    description="Advanced Answering Machine Detection using Multiple ML Models",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model storage
models = {}
active_sessions = {}

class AudioAnalysisRequest(BaseModel):
    audio_data: str  # base64 encoded
    sample_rate: int = 8000
    model_type: str = "ensemble"  # wav2vec2, whisper, vad, ensemble

class AudioAnalysisResponse(BaseModel):
    detection: str  # human, machine, unknown
    confidence: float
    latency_ms: int
    model_used: str
    reasoning: str
    metadata: Dict

class StreamSession(BaseModel):
    session_id: str
    call_sid: str
    model_type: str
    buffer_size: int = 0
    analysis_count: int = 0
    last_detection: Optional[str] = None
    confidence_scores: List[float] = []

@app.on_event("startup")
async def load_models():
    """Load all ML models on startup"""
    logger.info("🚀 Loading ML models...")
    
    try:
        # Load Wav2Vec2 model
        logger.info("Loading Wav2Vec2 model...")
        models['wav2vec2_processor'] = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
        models['wav2vec2_model'] = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
        
        # Load Whisper model
        logger.info("Loading Whisper model...")
        models['whisper'] = whisper.load_model("base")
        
        # Load HuggingFace audio classification pipeline
        logger.info("Loading audio classification pipeline...")
        models['audio_classifier'] = pipeline(
            "audio-classification",
            model="superb/wav2vec2-base-superb-ks",
            return_all_scores=True
        )
        
        # Initialize VAD
        logger.info("Initializing Voice Activity Detection...")
        models['vad'] = webrtcvad.Vad(2)  # Aggressiveness level 2
        
        logger.info("✅ All models loaded successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error loading models: {e}")
        raise

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": len(models),
        "active_sessions": len(active_sessions),
        "timestamp": time.time()
    }

@app.get("/models")
async def list_models():
    """List available models"""
    return {
        "available_models": list(models.keys()),
        "model_info": {
            "wav2vec2": "Facebook Wav2Vec2 Base 960h - Speech recognition",
            "whisper": "OpenAI Whisper Base - Speech transcription",
            "audio_classifier": "SuperB Wav2Vec2 - Audio classification",
            "vad": "WebRTC VAD - Voice activity detection"
        }
    }

def preprocess_audio(audio_data: np.ndarray, target_sr: int = 16000) -> np.ndarray:
    """Preprocess audio for ML models"""
    # Normalize audio
    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)
    
    # Normalize to [-1, 1]
    if np.max(np.abs(audio_data)) > 0:
        audio_data = audio_data / np.max(np.abs(audio_data))
    
    return audio_data

def analyze_with_wav2vec2(audio_data: np.ndarray, sample_rate: int) -> Dict:
    """Analyze audio using Wav2Vec2"""
    try:
        # Resample to 16kHz if needed
        if sample_rate != 16000:
            audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)
        
        # Preprocess
        audio_data = preprocess_audio(audio_data)
        
        # Process with Wav2Vec2
        processor = models['wav2vec2_processor']
        model = models['wav2vec2_model']
        
        inputs = processor(audio_data, sampling_rate=16000, return_tensors="pt", padding=True)
        
        with torch.no_grad():
            logits = model(inputs.input_values).logits
        
        # Get predicted tokens
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = processor.batch_decode(predicted_ids)[0]
        
        # Analyze transcription for AMD
        detection, confidence, reasoning = analyze_transcription_for_amd(transcription)
        
        return {
            "detection": detection,
            "confidence": confidence,
            "reasoning": reasoning,
            "transcription": transcription,
            "model": "wav2vec2"
        }
        
    except Exception as e:
        logger.error(f"Wav2Vec2 analysis error: {e}")
        return {
            "detection": "unknown",
            "confidence": 0.5,
            "reasoning": f"Analysis failed: {str(e)}",
            "transcription": "",
            "model": "wav2vec2"
        }

def analyze_with_whisper(audio_data: np.ndarray, sample_rate: int) -> Dict:
    """Analyze audio using Whisper"""
    try:
        # Resample to 16kHz if needed
        if sample_rate != 16000:
            audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)
        
        # Preprocess
        audio_data = preprocess_audio(audio_data)
        
        # Transcribe with Whisper
        result = models['whisper'].transcribe(audio_data)
        transcription = result['text'].strip()
        
        # Analyze transcription for AMD
        detection, confidence, reasoning = analyze_transcription_for_amd(transcription)
        
        return {
            "detection": detection,
            "confidence": confidence,
            "reasoning": reasoning,
            "transcription": transcription,
            "language": result.get('language', 'unknown'),
            "model": "whisper"
        }
        
    except Exception as e:
        logger.error(f"Whisper analysis error: {e}")
        return {
            "detection": "unknown",
            "confidence": 0.5,
            "reasoning": f"Analysis failed: {str(e)}",
            "transcription": "",
            "model": "whisper"
        }

def analyze_with_vad(audio_data: np.ndarray, sample_rate: int) -> Dict:
    """Analyze audio using Voice Activity Detection"""
    try:
        # Convert to 16-bit PCM
        if audio_data.dtype != np.int16:
            audio_data = (audio_data * 32767).astype(np.int16)
        
        # Resample to supported rate (8kHz, 16kHz, 32kHz, 48kHz)
        supported_rates = [8000, 16000, 32000, 48000]
        target_rate = min(supported_rates, key=lambda x: abs(x - sample_rate))
        
        if sample_rate != target_rate:
            audio_data = librosa.resample(
                audio_data.astype(np.float32), 
                orig_sr=sample_rate, 
                target_sr=target_rate
            )
            audio_data = (audio_data * 32767).astype(np.int16)
            sample_rate = target_rate
        
        # Analyze in 30ms chunks
        vad = models['vad']
        frame_duration = 30  # ms
        frame_size = int(sample_rate * frame_duration / 1000)
        
        voice_frames = 0
        total_frames = 0
        
        for i in range(0, len(audio_data) - frame_size, frame_size):
            frame = audio_data[i:i + frame_size].tobytes()
            is_speech = vad.is_speech(frame, sample_rate)
            if is_speech:
                voice_frames += 1
            total_frames += 1
        
        if total_frames == 0:
            voice_ratio = 0
        else:
            voice_ratio = voice_frames / total_frames
        
        # Determine detection based on voice activity patterns
        if voice_ratio < 0.1:
            detection = "machine"  # Very little voice activity (silence/beep)
            confidence = 0.8
            reasoning = f"Low voice activity ratio: {voice_ratio:.2f}"
        elif voice_ratio > 0.7:
            detection = "human"  # High voice activity (conversation)
            confidence = 0.7
            reasoning = f"High voice activity ratio: {voice_ratio:.2f}"
        else:
            detection = "unknown"  # Ambiguous
            confidence = 0.5
            reasoning = f"Moderate voice activity ratio: {voice_ratio:.2f}"
        
        return {
            "detection": detection,
            "confidence": confidence,
            "reasoning": reasoning,
            "voice_ratio": voice_ratio,
            "voice_frames": voice_frames,
            "total_frames": total_frames,
            "model": "vad"
        }
        
    except Exception as e:
        logger.error(f"VAD analysis error: {e}")
        return {
            "detection": "unknown",
            "confidence": 0.5,
            "reasoning": f"Analysis failed: {str(e)}",
            "model": "vad"
        }

def analyze_transcription_for_amd(transcription: str) -> tuple:
    """Analyze transcription text for AMD patterns"""
    text = transcription.lower().strip()
    
    # Machine indicators
    machine_patterns = [
        "you have reached",
        "please leave a message",
        "after the beep",
        "not available",
        "voicemail",
        "mailbox",
        "press",
        "dial",
        "extension",
        "automated",
        "system",
        "recording"
    ]
    
    # Human indicators
    human_patterns = [
        "hello",
        "hi",
        "yes",
        "speaking",
        "this is",
        "how can i help",
        "what's up",
        "hey there"
    ]
    
    machine_score = sum(1 for pattern in machine_patterns if pattern in text)
    human_score = sum(1 for pattern in human_patterns if pattern in text)
    
    if len(text) < 3:
        return "unknown", 0.5, "Transcription too short"
    
    if machine_score > human_score:
        confidence = min(0.9, 0.6 + (machine_score * 0.1))
        return "machine", confidence, f"Machine patterns detected: {machine_score}"
    elif human_score > machine_score:
        confidence = min(0.9, 0.6 + (human_score * 0.1))
        return "human", confidence, f"Human patterns detected: {human_score}"
    else:
        return "unknown", 0.5, "Ambiguous transcription patterns"

def ensemble_analysis(results: List[Dict]) -> Dict:
    """Combine results from multiple models"""
    if not results:
        return {
            "detection": "unknown",
            "confidence": 0.5,
            "reasoning": "No analysis results",
            "model": "ensemble"
        }
    
    # Weight different models
    model_weights = {
        "whisper": 0.4,
        "wav2vec2": 0.3,
        "vad": 0.2,
        "audio_classifier": 0.1
    }
    
    detection_scores = {"human": 0, "machine": 0, "unknown": 0}
    total_weight = 0
    
    for result in results:
        model = result.get("model", "unknown")
        detection = result.get("detection", "unknown")
        confidence = result.get("confidence", 0.5)
        weight = model_weights.get(model, 0.1)
        
        detection_scores[detection] += confidence * weight
        total_weight += weight
    
    # Normalize scores
    if total_weight > 0:
        for key in detection_scores:
            detection_scores[key] /= total_weight
    
    # Get final decision
    final_detection = max(detection_scores, key=detection_scores.get)
    final_confidence = detection_scores[final_detection]
    
    return {
        "detection": final_detection,
        "confidence": final_confidence,
        "reasoning": f"Ensemble decision from {len(results)} models",
        "model": "ensemble",
        "individual_results": results,
        "detection_scores": detection_scores
    }

@app.post("/analyze", response_model=AudioAnalysisResponse)
async def analyze_audio(request: AudioAnalysisRequest):
    """Analyze audio for AMD detection"""
    start_time = time.time()
    
    try:
        # Decode base64 audio
        import base64
        audio_bytes = base64.b64decode(request.audio_data)
        
        # Convert to numpy array (assuming 16-bit PCM)
        audio_data = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32767.0
        
        results = []
        
        if request.model_type == "wav2vec2":
            result = analyze_with_wav2vec2(audio_data, request.sample_rate)
            results.append(result)
        elif request.model_type == "whisper":
            result = analyze_with_whisper(audio_data, request.sample_rate)
            results.append(result)
        elif request.model_type == "vad":
            result = analyze_with_vad(audio_data, request.sample_rate)
            results.append(result)
        elif request.model_type == "ensemble":
            # Run all models
            results.append(analyze_with_wav2vec2(audio_data, request.sample_rate))
            results.append(analyze_with_whisper(audio_data, request.sample_rate))
            results.append(analyze_with_vad(audio_data, request.sample_rate))
        
        # Get final result
        if request.model_type == "ensemble":
            final_result = ensemble_analysis(results)
        else:
            final_result = results[0] if results else {
                "detection": "unknown",
                "confidence": 0.5,
                "reasoning": "No analysis performed",
                "model": request.model_type
            }
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return AudioAnalysisResponse(
            detection=final_result["detection"],
            confidence=final_result["confidence"],
            latency_ms=latency_ms,
            model_used=final_result["model"],
            reasoning=final_result["reasoning"],
            metadata=final_result
        )
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/stream/{call_sid}")
async def websocket_stream(websocket: WebSocket, call_sid: str):
    """WebSocket endpoint for real-time audio streaming"""
    await websocket.accept()
    
    session_id = str(uuid.uuid4())
    session = StreamSession(
        session_id=session_id,
        call_sid=call_sid,
        model_type="ensemble"
    )
    active_sessions[session_id] = session
    
    logger.info(f"🔗 WebSocket session started: {session_id} for call: {call_sid}")
    
    audio_buffer = []
    buffer_duration = 3.0  # seconds
    sample_rate = 8000
    
    try:
        while True:
            # Receive audio data
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("event") == "media":
                # Decode audio payload (base64 mulaw)
                payload = message["media"]["payload"]
                audio_chunk = base64.b64decode(payload)
                
                # Convert mulaw to linear PCM
                audio_data = np.frombuffer(audio_chunk, dtype=np.uint8)
                # Simple mulaw decode (for demo - use proper mulaw decoder in production)
                linear_audio = ((audio_data.astype(np.float32) - 128) / 128.0)
                
                audio_buffer.extend(linear_audio)
                session.buffer_size = len(audio_buffer)
                
                # Analyze when we have enough audio
                required_samples = int(buffer_duration * sample_rate)
                if len(audio_buffer) >= required_samples:
                    # Analyze the buffer
                    analysis_audio = np.array(audio_buffer[:required_samples])
                    
                    # Run ensemble analysis
                    results = []
                    results.append(analyze_with_whisper(analysis_audio, sample_rate))
                    results.append(analyze_with_vad(analysis_audio, sample_rate))
                    
                    final_result = ensemble_analysis(results)
                    
                    session.analysis_count += 1
                    session.last_detection = final_result["detection"]
                    session.confidence_scores.append(final_result["confidence"])
                    
                    # Send result back
                    response = {
                        "event": "analysis_result",
                        "session_id": session_id,
                        "call_sid": call_sid,
                        "detection": final_result["detection"],
                        "confidence": final_result["confidence"],
                        "analysis_count": session.analysis_count,
                        "reasoning": final_result["reasoning"]
                    }
                    
                    await websocket.send_text(json.dumps(response))
                    
                    # Clear processed audio from buffer
                    audio_buffer = audio_buffer[required_samples//2:]  # 50% overlap
                    
                    logger.info(f"📊 Analysis {session.analysis_count}: {final_result['detection']} ({final_result['confidence']:.2f})")
            
            elif message.get("event") == "stop":
                logger.info(f"🛑 Stream stopped for session: {session_id}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    finally:
        if session_id in active_sessions:
            del active_sessions[session_id]
        logger.info(f"🧹 Cleaned up session: {session_id}")

@app.get("/sessions")
async def list_sessions():
    """List active streaming sessions"""
    return {
        "active_sessions": len(active_sessions),
        "sessions": [
            {
                "session_id": session.session_id,
                "call_sid": session.call_sid,
                "buffer_size": session.buffer_size,
                "analysis_count": session.analysis_count,
                "last_detection": session.last_detection
            }
            for session in active_sessions.values()
        ]
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
