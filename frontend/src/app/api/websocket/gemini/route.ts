import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

// WebSocket server for Gemini real-time audio processing
let wss: WebSocketServer | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callSid = searchParams.get('callSid');
  
  if (!callSid) {
    return new Response('Missing callSid parameter', { status: 400 });
  }

  // Initialize WebSocket server if not exists
  if (!wss) {
    wss = new WebSocketServer({ port: 8080 });
    console.log('WebSocket server started on port 8080');
  }

  return new Response('WebSocket server ready', { status: 200 });
}

// Handle WebSocket connections for Twilio Media Streams
export function handleWebSocketConnection(ws: any, callSid: string) {
  console.log(`WebSocket connection established for call: ${callSid}`);
  
  let audioBuffer: Buffer[] = [];
  let geminiClient: any = null;
  let isProcessing = false;
  
  // Initialize Gemini client
  const initGemini = async () => {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
      geminiClient = genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp' 
      });
      console.log('Gemini client initialized');
    } catch (error) {
      console.error('Failed to initialize Gemini:', error);
    }
  };

  // Process audio chunk with Gemini
  const processAudioChunk = async (audioData: Buffer) => {
    if (!geminiClient || isProcessing) return;
    
    isProcessing = true;
    
    try {
      // Convert audio to base64
      const audioBase64 = audioData.toString('base64');
      
      // Create prompt for AMD detection
      const prompt = `Analyze this audio chunk for answering machine detection. 
      Listen for:
      1. Human voice patterns (natural speech, pauses, responses)
      2. Machine/voicemail patterns (robotic voice, continuous speech, beeps)
      3. Background noise and call quality
      
      Respond with JSON format:
      {
        "detection": "human" | "machine" | "unknown",
        "confidence": 0.0-1.0,
        "reasoning": "brief explanation",
        "audio_features": {
          "has_speech": boolean,
          "speech_duration": number,
          "silence_duration": number,
          "background_noise": "low" | "medium" | "high"
        }
      }`;

      const result = await geminiClient.generateContent([
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: audioBase64
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Parse Gemini response
      let analysis;
      try {
        analysis = JSON.parse(text);
      } catch (e) {
        // Fallback parsing if JSON is malformed
        analysis = {
          detection: text.toLowerCase().includes('human') ? 'human' : 
                    text.toLowerCase().includes('machine') ? 'machine' : 'unknown',
          confidence: 0.7,
          reasoning: text.substring(0, 200),
          audio_features: {
            has_speech: true,
            speech_duration: 2.0,
            silence_duration: 0.5,
            background_noise: 'low'
          }
        };
      }

      // Store AMD event in database
      await prisma.aMDEvent.create({
        data: {
          callSid,
          strategy: 'gemini',
          detection: analysis.detection,
          confidence: analysis.confidence,
          latencyMs: Date.now() - parseInt(callSid.split('_')[1] || '0'),
          metadata: {
            reasoning: analysis.reasoning,
            audio_features: analysis.audio_features,
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
          }
        }
      });

      // Send result back to Twilio
      ws.send(JSON.stringify({
        event: 'amd-result',
        callSid,
        detection: analysis.detection,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning
      }));

      console.log(`AMD Result for ${callSid}:`, analysis.detection, `(${analysis.confidence})`);

    } catch (error) {
      console.error('Error processing audio with Gemini:', error);
      
      // Send error result
      ws.send(JSON.stringify({
        event: 'amd-error',
        callSid,
        error: 'Failed to process audio'
      }));
    } finally {
      isProcessing = false;
    }
  };

  // Handle incoming messages from Twilio
  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.event) {
        case 'connected':
          console.log(`Twilio connected for call: ${callSid}`);
          await initGemini();
          break;
          
        case 'start':
          console.log(`Media stream started for call: ${callSid}`);
          break;
          
        case 'media':
          // Accumulate audio data
          const audioChunk = Buffer.from(data.media.payload, 'base64');
          audioBuffer.push(audioChunk);
          
          // Process when we have enough audio (e.g., 2 seconds worth)
          if (audioBuffer.length >= 20) { // Assuming ~100ms per chunk
            const combinedAudio = Buffer.concat(audioBuffer);
            audioBuffer = []; // Reset buffer
            
            await processAudioChunk(combinedAudio);
          }
          break;
          
        case 'stop':
          console.log(`Media stream stopped for call: ${callSid}`);
          break;
          
        default:
          console.log('Unknown event:', data.event);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed for call: ${callSid}`);
  });

  ws.on('error', (error: Error) => {
    console.error(`WebSocket error for call ${callSid}:`, error);
  });
}
