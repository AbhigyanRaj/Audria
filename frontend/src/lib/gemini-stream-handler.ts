/**
 * Gemini Media Stream Handler
 * Processes Twilio Media Streams for real-time AMD with Gemini Flash
 */
import { WebSocket } from 'ws';
import { prisma } from '@/lib/prisma';
import { AudioBufferManager } from '@/lib/audio-converter';
import { analyzeAudioWithGemini } from '@/lib/gemini';

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
 * Handle Twilio Media Stream WebSocket connection
 */
export async function handleGeminiMediaStream(ws: WebSocket) {
  console.log('🔵 Gemini Media Stream: WebSocket connection opened');
  
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
          
          console.log(`🔵 Gemini Stream started: ${streamSid}, Call: ${callSid}`);
          
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
          
          // Check if we have enough audio to analyze (2 seconds minimum for quick detection)
          if (!mediaSession.analysisStarted && mediaSession.audioBuffer.hasMinimumDuration(2000)) {
            mediaSession.analysisStarted = true;
            
            // Trigger AMD analysis
            await analyzeWithGemini(mediaSession);
          }
          break;
          
        case 'stop':
          console.log(`🔵 Gemini Stream stopped: ${streamSid}`);
          
          if (streamSid && activeSessions.has(streamSid)) {
            const stopSession = activeSessions.get(streamSid)!;
            
            // If no result yet, analyze what we have
            if (!stopSession.amdResult && stopSession.audioBuffer.getSize() > 0) {
              await analyzeWithGemini(stopSession);
            }
            
            // Cleanup
            activeSessions.delete(streamSid);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing media stream message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔵 Gemini Media Stream: WebSocket connection closed');
    if (streamSid) {
      activeSessions.delete(streamSid);
    }
  });
  
  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
}

/**
 * Analyze audio with Gemini Flash API
 */
async function analyzeWithGemini(session: StreamSession) {
  try {
    console.log(`🔵 Starting Gemini AMD analysis for call ${session.callSid}`);
    
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }
    
    // Get WAV audio
    const audioWav = session.audioBuffer.getWav();
    
    if (audioWav.length === 0) {
      console.warn('No audio data to analyze');
      return;
    }
    
    // Analyze with Gemini
    const result = await analyzeAudioWithGemini(audioWav, {
      apiKey,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    });
    
    console.log(`✅ Gemini AMD result: ${result.decision} (confidence: ${result.confidence})`);
    
    session.amdResult = result;
    
    // Update database
    await updateAMDResult(session.callSid, result);
    
    // PDF REQUIREMENTS: Action based on detection
    console.log(`📊 Gemini Analysis Complete: ${result.decision} (${result.confidence})`);
    console.log(`   Reasoning: ${result.reasoning}`);
    
    if (result.decision === 'machine' && result.confidence >= 0.80) {
      // PDF: "Voicemail (Costco)" → Machine (greeting >5 words) → Hangup + log 'machine_detected'
      await hangupCall(session.callSid);
      console.log(`🔴 machine_detected - Hangup (confidence: ${result.confidence})`);
      
      session.ws.send(JSON.stringify({
        event: 'mark',
        streamSid: session.streamSid,
        mark: {
          name: 'amd_complete_hangup'
        }
      }));
    } else if (result.decision === 'human') {
      // PDF: "Human Pickup" → Human (short "hello") → Play prompt + connect stream
      console.log(`✅ Human detected (${result.confidence}) - Continue call`);
      
      session.ws.send(JSON.stringify({
        event: 'mark',
        streamSid: session.streamSid,
        mark: {
          name: 'amd_complete_continue'
        }
      }));
    } else if (result.confidence < 0.7) {
      // PDF: "Low Confidence (<0.7)" → Log warning, prompt user override
      console.log(`⚠️ Low confidence (${result.confidence}) - Treating as human (safer)`);
      
      session.ws.send(JSON.stringify({
        event: 'mark',
        streamSid: session.streamSid,
        mark: {
          name: 'amd_low_confidence_continue'
        }
      }));
    }
    
  } catch (error) {
    console.error('Gemini AMD analysis error:', error);
    
    // PDF REQUIREMENT: "Timeout (3s silence)" → Fallback to human
    const audioSize = session.audioBuffer.getSize();
    const duration = (Date.now() - session.startTime) / 1000;
    
    let decision: 'human' | 'machine' = 'human';
    let confidence = 0.55;
    let reasoning = '';
    
    // Check if this is a timeout scenario (< 3s of audio)
    if (duration < 3 || audioSize < 10000) {
      decision = 'human';
      confidence = 0.55;
      reasoning = 'Timeout (3s silence) - Fallback to human per PDF requirements';
      console.log(`⚠️ TIMEOUT: ${duration}s, ${audioSize} bytes - Treating as human`);
    } else {
      // API error with some audio - use size heuristic
      if (audioSize > 40000) {
        decision = 'machine';
        confidence = 0.60;
        reasoning = 'API error. Large audio suggests long greeting (voicemail)';
      } else {
        decision = 'human';
        confidence = 0.60;
        reasoning = 'API error. Short audio suggests quick human answer';
      }
      console.log(`⚠️ API ERROR: Using size heuristic - ${decision} (${confidence})`);
    }
    
    await updateAMDResult(session.callSid, {
      decision,
      confidence,
      reasoning,
      latencyMs: Date.now() - session.startTime,
      metadata: {
        audioLength: audioSize,
        duration_seconds: duration,
        voiceCharacteristics: ['timeout_or_error_fallback'],
        detectedPatterns: duration < 3 ? ['timeout'] : ['api_error'],
        error: String(error),
        ui_display: confidence < 0.7 ? 'Undecided—treating as human' : decision
      },
    });
  }
}

/**
 * Update AMD result in database
 */
async function updateAMDResult(callSid: string, result: any) {
  try {
    const call = await prisma.call.findUnique({
      where: { callSid },
      include: { amdEvents: true },
    });
    
    if (!call) {
      console.warn(`Call not found: ${callSid}`);
      return;
    }
    
    // Find existing Gemini AMD event
    const existingEvent = call.amdEvents.find(e => e.strategy === 'gemini');
    
    if (existingEvent) {
      await prisma.aMDEvent.update({
        where: { id: existingEvent.id },
        data: {
          detection: result.decision,
          confidence: result.confidence,
          latencyMs: result.latencyMs,
          metadata: {
            reasoning: result.reasoning,
            voiceCharacteristics: result.metadata?.voiceCharacteristics || [],
            detectedPatterns: result.metadata?.detectedPatterns || [],
            audioLength: result.metadata?.audioLength || 0,
            analysisMethod: 'gemini_live_stream',
          },
        },
      });
    } else {
      await prisma.aMDEvent.create({
        data: {
          callId: call.id,
          callSid,
          strategy: 'gemini',
          detection: result.decision,
          confidence: result.confidence,
          latencyMs: result.latencyMs,
          metadata: {
            reasoning: result.reasoning,
            voiceCharacteristics: result.metadata?.voiceCharacteristics || [],
            detectedPatterns: result.metadata?.detectedPatterns || [],
            audioLength: result.metadata?.audioLength || 0,
            analysisMethod: 'gemini_live_stream',
          },
        },
      });
    }
    
    console.log(`✅ AMD result saved to database for call ${callSid}`);
  } catch (error) {
    console.error('Error updating AMD result:', error);
  }
}

/**
 * Hangup call via Twilio REST API
 */
async function hangupCall(callSid: string) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      console.warn('Twilio credentials not configured for hangup');
      return;
    }
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Status=completed',
    });
    
    if (response.ok) {
      console.log(`✅ Call ${callSid} hung up successfully`);
    } else {
      console.error(`Failed to hangup call: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error hanging up call:', error);
  }
}
