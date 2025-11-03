/**
 * HuggingFace Media Stream Handler
 * Processes Twilio Media Streams for real-time AMD with HuggingFace ML models
 */

import { WebSocket } from 'ws';
import { prisma } from '@/lib/prisma';
import { AudioBufferManager } from '@/lib/audio-converter';
import { analyzeAudioWithHuggingFace } from '@/lib/huggingface';

interface StreamSession {
  callSid: string;
  streamSid: string;
  audioBuffer: AudioBufferManager;
  analysisStarted: boolean;
  amdResult: any | null;
  startTime: number;
  ws: WebSocket;
}

const activeSessions = new Map<string, StreamSession>();

/**
 * Handle Twilio Media Stream WebSocket connection for HuggingFace
 */
export async function handleHuggingFaceMediaStream(ws: WebSocket) {
  console.log('\n' + '='.repeat(80));
  console.log('🤗 HUGGINGFACE MEDIA STREAM: WebSocket connection opened');
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
          
          console.log(`🤗 HuggingFace Stream started: ${streamSid}, Call: ${callSid}`);
          
          // Initialize session
          const startSession: StreamSession = {
            callSid,
            streamSid,
            audioBuffer: new AudioBufferManager(8000),
            analysisStarted: false,
            amdResult: null,
            startTime: Date.now(),
            ws,
          };
          
          activeSessions.set(streamSid, startSession);
          break;
          
        case 'media':
          if (!streamSid || !activeSessions.has(streamSid)) {
            console.warn('Media received before stream start');
            return;
          }
          
          const mediaSession = activeSessions.get(streamSid)!;
          
          // Decode base64 audio payload (mulaw format)
          const audioChunk = Buffer.from(message.media.payload, 'base64');
          mediaSession.audioBuffer.addChunk(audioChunk);
          
          // Check if we have enough audio to analyze (3 seconds minimum)
          if (!mediaSession.analysisStarted && mediaSession.audioBuffer.hasMinimumDuration(3000)) {
            mediaSession.analysisStarted = true;
            
            console.log('🤗 Starting HuggingFace AMD analysis for call:', callSid);
            // Trigger AMD analysis
            await analyzeWithHuggingFace(mediaSession);
          }
          break;
          
        case 'stop':
          console.log(`🤗 HuggingFace Stream stopped: ${streamSid}`);
          
          if (streamSid && activeSessions.has(streamSid)) {
            const stopSession = activeSessions.get(streamSid)!;
            
            // If no result yet, analyze what we have
            if (!stopSession.amdResult && stopSession.audioBuffer.getSize() > 0) {
              await analyzeWithHuggingFace(stopSession);
            }
            
            // Cleanup
            activeSessions.delete(streamSid);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing HuggingFace media stream message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🤗 HuggingFace Media Stream WebSocket closed');
    if (streamSid) {
      activeSessions.delete(streamSid);
    }
  });

  ws.on('error', (error) => {
    console.error('🤗 HuggingFace Media Stream WebSocket error:', error);
  });
}

/**
 * Analyze audio with HuggingFace and update database
 */
async function analyzeWithHuggingFace(session: StreamSession) {
  try {
    const startTime = Date.now();
    
    // Convert audio buffer to WAV
    const wavBuffer = session.audioBuffer.getWav();
    console.log(`🤗 Analyzing ${wavBuffer.length} bytes of audio with HuggingFace...`);
    
    // Call HuggingFace API
    const analysis = await analyzeAudioWithHuggingFace(wavBuffer, {
      apiKey: process.env.HUGGINGFACE_API_KEY,
      model: 'facebook/wav2vec2-base-960h',
      threshold: 0.7
    });
    
    const latencyMs = Date.now() - startTime;
    session.amdResult = analysis;
    
    console.log(`✅ HuggingFace AMD result: ${analysis.decision} (confidence: ${analysis.confidence})`);
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
          strategy: 'huggingface',
          detection: analysis.decision,
          confidence: analysis.confidence,
          latencyMs,
          metadata: {
            model: analysis.metadata.modelUsed,
            audio_size_bytes: wavBuffer.length,
            processing_time_ms: latencyMs,
            twilio_stream_sid: session.streamSid,
            scores: analysis.scores,
            audio_length: analysis.metadata.audioLength
          }
        }
      });
      
      console.log('✅ HuggingFace AMD result saved to database');
      
      // If machine detected with high confidence, hangup the call
      if (analysis.decision === 'machine' && analysis.confidence > 0.7) {
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
  } catch (error: any) {
    console.error('❌ Error in HuggingFace AMD analysis:', error);
    
    // Fallback: treat as human if analysis fails
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
              strategy: 'huggingface',
              detection: 'human',
              confidence: 0.5,
              latencyMs: Date.now() - session.startTime,
              metadata: {
                error: error?.message || 'Unknown error',
                fallback: 'analysis_failed_defaulting_to_human'
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
