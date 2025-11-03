/**
 * FastAPI Media Stream Handler
 * Processes Twilio Media Streams for real-time AMD with FastAPI ML microservice
 */

import { WebSocket as WSWebSocket } from 'ws';
import { prisma } from '@/lib/prisma';
import { AudioBufferManager } from '@/lib/audio-converter';
import { fastAPIAMDService } from '@/lib/fastapi-amd';

interface FastAPIStreamSession {
  callSid: string;
  streamSid: string;
  audioBuffer: AudioBufferManager;
  analysisStarted: boolean;
  amdResult: any | null;
  startTime: number;
  ws: WebSocket;
  fastAPIWebSocket: globalThis.WebSocket | null;
}

const activeSessions = new Map<string, FastAPIStreamSession>();

/**
 * Handle Twilio Media Stream WebSocket connection for FastAPI
 */
export async function handleFastAPIMediaStream(ws: WSWebSocket) {
  console.log('\n' + '='.repeat(80));
  console.log('🐍 FASTAPI MEDIA STREAM: WebSocket connection opened');
  console.log('='.repeat(80));
  
  let streamSid: string | null = null;
  let callSid: string | null = null;
  
  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.event) {
        case 'start':
          streamSid = message.streamSid;
          callSid = message.start.callSid;
          
          if (!streamSid || !callSid) {
            console.error('Missing streamSid or callSid in start event');
            return;
          }
          
          console.log(`🐍 FastAPI Stream started: ${streamSid}, Call: ${callSid}`);
          
          // Create FastAPI WebSocket connection
          const fastAPIWs = fastAPIAMDService.createWebSocketConnection(callSid);
          
          // Initialize session
          const startSession: FastAPIStreamSession = {
            callSid,
            streamSid,
            audioBuffer: new AudioBufferManager(8000),
            analysisStarted: false,
            amdResult: null,
            startTime: Date.now(),
            ws: ws as any,
            fastAPIWebSocket: fastAPIWs,
          };
          
          activeSessions.set(streamSid, startSession);
          
          // Set up FastAPI WebSocket handlers
          fastAPIWs.onopen = () => {
            console.log('🐍 FastAPI WebSocket connected');
          };
          
          fastAPIWs.onmessage = async (event) => {
            try {
              const result = JSON.parse(event.data);
              if (result.event === 'analysis_result') {
                await handleFastAPIResult(startSession, result);
              }
            } catch (error) {
              console.error('Error processing FastAPI result:', error);
            }
          };
          
          fastAPIWs.onerror = (error) => {
            console.error('🐍 FastAPI WebSocket error:', error);
          };
          
          fastAPIWs.onclose = () => {
            console.log('🐍 FastAPI WebSocket closed');
          };
          
          break;
          
        case 'media':
          if (!streamSid || !activeSessions.has(streamSid)) {
            console.warn('Media received before stream start');
            return;
          }
          
          const mediaSession = activeSessions.get(streamSid)!;
          
          // Forward media to FastAPI WebSocket
          if (mediaSession.fastAPIWebSocket && mediaSession.fastAPIWebSocket.readyState === globalThis.WebSocket.OPEN) {
            mediaSession.fastAPIWebSocket.send(JSON.stringify(message));
          }
          
          // Also buffer locally for fallback
          const audioChunk = Buffer.from(message.media.payload, 'base64');
          mediaSession.audioBuffer.addChunk(audioChunk);
          
          break;
          
        case 'stop':
          console.log(`🐍 FastAPI Stream stopped: ${streamSid}`);
          
          if (streamSid && activeSessions.has(streamSid)) {
            const stopSession = activeSessions.get(streamSid)!;
            
            // Close FastAPI WebSocket
            if (stopSession.fastAPIWebSocket) {
              stopSession.fastAPIWebSocket.close();
            }
            
            // If no result yet, use fallback analysis
            if (!stopSession.amdResult && stopSession.audioBuffer.getSize() > 0) {
              await performFallbackAnalysis(stopSession);
            }
            
            // Cleanup
            activeSessions.delete(streamSid);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing FastAPI media stream message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🐍 FastAPI Media Stream WebSocket closed');
    if (streamSid) {
      const session = activeSessions.get(streamSid);
      if (session?.fastAPIWebSocket) {
        session.fastAPIWebSocket.close();
      }
      activeSessions.delete(streamSid);
    }
  });

  ws.on('error', (error) => {
    console.error('🐍 FastAPI Media Stream WebSocket error:', error);
  });
}

/**
 * Handle analysis result from FastAPI
 */
async function handleFastAPIResult(session: FastAPIStreamSession, result: any) {
  try {
    const latencyMs = Date.now() - session.startTime;
    session.amdResult = result;
    
    console.log(`✅ FastAPI AMD result: ${result.detection} (confidence: ${result.confidence})`);
    console.log(`🕐 Analysis latency: ${latencyMs}ms`);
    
    // Find call record
    const callRecord = await prisma.call.findUnique({
      where: { callSid: session.callSid }
    });

    if (callRecord) {
      // Store AMD event in database
      await prisma.aMDEvent.create({
        data: {
          callId: callRecord.id,
          callSid: session.callSid,
          strategy: 'fastapi',
          detection: result.detection,
          confidence: result.confidence,
          latencyMs,
          metadata: {
            reasoning: result.reasoning,
            model_used: 'fastapi_ensemble',
            analysis_count: result.analysis_count,
            twilio_stream_sid: session.streamSid,
            fastapi_session_id: result.session_id,
            buffer_size: session.audioBuffer.getSize()
          }
        }
      });
      
      console.log('✅ FastAPI AMD result saved to database');
      
      // If machine detected with high confidence, hangup the call
      if (result.detection === 'machine' && result.confidence > 0.7) {
        console.log('🔴 Machine detected, hanging up call via Twilio REST API');
        
        try {
          const twilio = require('twilio')(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          
          await twilio.calls(session.callSid).update({ status: 'completed' });
          console.log('✅ Call hung up successfully');
        } catch (hangupError) {
          console.error('❌ Failed to hangup call:', hangupError);
        }
      } else {
        console.log('✅ Human detected, continuing call');
      }
    }
  } catch (error) {
    console.error('❌ Error handling FastAPI result:', error);
  }
}

/**
 * Perform fallback analysis if FastAPI is unavailable
 */
async function performFallbackAnalysis(session: FastAPIStreamSession) {
  try {
    console.log('🔄 Performing fallback analysis...');
    
    const wavBuffer = session.audioBuffer.getWav();
    const result = await fastAPIAMDService.analyzeAudio(wavBuffer, {
      sampleRate: 8000,
      modelType: 'ensemble'
    });
    
    await handleFastAPIResult(session, {
      detection: result.detection,
      confidence: result.confidence,
      reasoning: result.reasoning + ' (fallback)',
      analysis_count: 1,
      session_id: 'fallback'
    });
    
  } catch (error) {
    console.error('❌ Fallback analysis failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Final fallback: treat as human
    if (session.callSid) {
      try {
        const callRecord = await prisma.call.findUnique({
          where: { callSid: session.callSid }
        });

        if (callRecord) {
          await prisma.aMDEvent.create({
            data: {
              callId: callRecord.id,
              callSid: session.callSid,
              strategy: 'fastapi',
              detection: 'human',
              confidence: 0.5,
              latencyMs: Date.now() - session.startTime,
              metadata: {
                error: errorMessage,
                fallback: 'fastapi_service_unavailable_defaulting_to_human'
              }
            }
          });
        }
      } catch (dbError) {
        console.error('❌ Failed to save fallback AMD result:', dbError);
      }
    }
  }
}
