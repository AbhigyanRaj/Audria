import { Server } from 'ws';
import { prisma } from '@/lib/prisma';
import { AudioBufferManager } from '@/lib/audio-converter';
import { analyzeAudioWithGemini } from '@/lib/gemini';

/**
 * WebSocket handler for Twilio Media Streams → Gemini Flash AMD
 * Receives real-time audio from Twilio and processes with Gemini API
 */

// Store active sessions
const activeSessions = new Map<string, {
  callSid: string;
  audioBuffer: AudioBufferManager;
  analysisStarted: boolean;
  amdResult: any;
  startTime: number;
}>();

export async function GET(request: Request) {
  return new Response('Gemini Media Stream WebSocket endpoint. Use WebSocket connection.', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * Handle WebSocket upgrade for Twilio Media Streams
 */
export async function SOCKET(client: any, request: any) {
  console.log('🔵 Gemini Media Stream: WebSocket connection opened');
  
  let streamSid: string | null = null;
  let callSid: string | null = null;
  
  client.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.event) {
        case 'start':
          streamSid = data.streamSid;
          callSid = data.start.callSid;
          
          console.log(`🔵 Gemini Stream started: ${streamSid}, Call: ${callSid}`);
          
          // Initialize session
          activeSessions.set(streamSid, {
            callSid,
            audioBuffer: new AudioBufferManager(8000),
            analysisStarted: false,
            amdResult: null,
            startTime: Date.now(),
          });
          break;
          
        case 'media':
          if (!streamSid || !activeSessions.has(streamSid)) {
            console.warn('Media received before stream start');
            return;
          }
          
          const session = activeSessions.get(streamSid)!;
          
          // Decode base64 audio payload (mulaw format)
          const audioChunk = Buffer.from(data.media.payload, 'base64');
          session.audioBuffer.addChunk(audioChunk);
          
          // Check if we have enough audio to analyze (3 seconds minimum)
          if (!session.analysisStarted && session.audioBuffer.hasMinimumDuration(3000)) {
            session.analysisStarted = true;
            
            // Trigger AMD analysis
            analyzeWithGemini(streamSid, session, client);
          }
          break;
          
        case 'stop':
          console.log(`🔵 Gemini Stream stopped: ${streamSid}`);
          
          if (streamSid && activeSessions.has(streamSid)) {
            const session = activeSessions.get(streamSid)!;
            
            // If no result yet, analyze what we have
            if (!session.amdResult && session.audioBuffer.getSize() > 0) {
              await analyzeWithGemini(streamSid, session, client);
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
  
  client.on('close', () => {
    console.log('🔵 Gemini Media Stream: WebSocket connection closed');
    if (streamSid) {
      activeSessions.delete(streamSid);
    }
  });
  
  client.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
}

/**
 * Analyze audio with Gemini Flash API
 */
async function analyzeWithGemini(
  streamSid: string,
  session: any,
  client: any
) {
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
    
    // Send control command to Twilio based on result
    if (result.decision === 'machine' && result.confidence > 0.7) {
      // Hangup on machine detection
      await hangupCall(session.callSid);
      
      // Send mark to Twilio to stop stream
      client.send(JSON.stringify({
        event: 'mark',
        streamSid,
        mark: {
          name: 'amd_complete_hangup'
        }
      }));
    } else if (result.decision === 'human' && result.confidence > 0.7) {
      // Continue call for human
      console.log('✅ Human detected, continuing call');
      
      client.send(JSON.stringify({
        event: 'mark',
        streamSid,
        mark: {
          name: 'amd_complete_continue'
        }
      }));
    } else {
      // Low confidence or unknown - treat as human (safer)
      console.log('⚠️ Low confidence or unknown, treating as human');
    }
    
  } catch (error) {
    console.error('Gemini AMD analysis error:', error);
    
    // Fallback: treat as human on error
    await updateAMDResult(session.callSid, {
      decision: 'unknown',
      confidence: 0,
      reasoning: `Analysis failed: ${error}`,
      latencyMs: Date.now() - session.startTime,
      metadata: {
        audioLength: session.audioBuffer.getSize(),
        voiceCharacteristics: [],
        detectedPatterns: ['error'],
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
