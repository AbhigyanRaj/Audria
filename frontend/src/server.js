const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize WebSocket server for Gemini after Next.js is ready
  try {
    // Use require for CommonJS compatibility
    const { WebSocketServer } = require('ws');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const { PrismaClient } = require('@prisma/client');
    
    const prisma = new PrismaClient();
    let wss = null;

    function initializeWebSocketServer() {
      if (wss) return wss;

      wss = new WebSocketServer({ port: 8080 });
      
      wss.on('connection', (ws, request) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const callSid = url.searchParams.get('callSid');
        
        if (!callSid) {
          ws.close(1008, 'Missing callSid parameter');
          return;
        }

        console.log(`WebSocket connection established for call: ${callSid}`);
        
        let audioBuffer = [];
        let geminiClient = null;
        let isProcessing = false;
        
        // Initialize Gemini client
        const initGemini = async () => {
          try {
            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
            geminiClient = genAI.getGenerativeModel({ 
              model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp' 
            });
            console.log('Gemini client initialized for call:', callSid);
          } catch (error) {
            console.error('Failed to initialize Gemini:', error);
          }
        };

        // Process audio chunk with Gemini
        const processAudioChunk = async (audioData) => {
          if (!geminiClient || isProcessing) return;
          
          isProcessing = true;
          const processingStartTime = Date.now();
          
          try {
            const audioBase64 = audioData.toString('base64');
            
            const prompt = `Analyze this audio for answering machine detection. 
            Listen carefully for:
            1. Human voice: Natural speech patterns, conversational responses, "hello", pauses for listening
            2. Machine/voicemail: Robotic voice, continuous scripted speech, beeps, "leave a message"
            3. Call quality and background sounds
            
            Respond ONLY with valid JSON:
            {
              "detection": "human" | "machine" | "unknown",
              "confidence": 0.0-1.0,
              "reasoning": "brief explanation of what you heard"
            }`;

            const result = await geminiClient.generateContent([
              {
                inlineData: {
                  mimeType: 'audio/mulaw',
                  data: audioBase64
                }
              },
              { text: prompt }
            ]);

            const response = await result.response;
            const text = response.text();
            
            let analysis;
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              const jsonText = jsonMatch ? jsonMatch[0] : text;
              analysis = JSON.parse(jsonText);
            } catch (e) {
              const lowerText = text.toLowerCase();
              analysis = {
                detection: lowerText.includes('human') ? 'human' : 
                          lowerText.includes('machine') || lowerText.includes('voicemail') ? 'machine' : 'unknown',
                confidence: 0.7,
                reasoning: text.substring(0, 200)
              };
            }

            const latencyMs = Date.now() - processingStartTime;

            // Find the call record to get callId
            const callRecord = await prisma.call.findUnique({
              where: { callSid }
            });

            if (callRecord) {
              await prisma.aMDEvent.create({
                data: {
                  callId: callRecord.id,
                  strategy: 'gemini',
                  decision: analysis.detection,
                  confidence: analysis.confidence,
                  latencyMs,
                  metadata: {
                    reasoning: analysis.reasoning,
                    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
                    audio_size_bytes: audioData.length,
                    processing_time_ms: latencyMs,
                    twilio_call_sid: callSid
                  }
                }
              });
            }

            ws.send(JSON.stringify({
              event: 'amd-result',
              callSid,
              detection: analysis.detection,
              confidence: analysis.confidence,
              reasoning: analysis.reasoning,
              latencyMs
            }));

            console.log(`AMD Result for ${callSid}: ${analysis.detection} (${analysis.confidence}) - ${latencyMs}ms`);

            if (analysis.confidence > 0.8 && analysis.detection !== 'unknown') {
              console.log(`High confidence result for ${callSid}, stopping analysis`);
              ws.send(JSON.stringify({
                event: 'amd-complete',
                callSid,
                finalResult: analysis.detection
              }));
            }

          } catch (error) {
            console.error('Error processing audio with Gemini:', error);
            
            ws.send(JSON.stringify({
              event: 'amd-error',
              callSid,
              error: 'Failed to process audio with Gemini'
            }));
          } finally {
            isProcessing = false;
          }
        };

        // Handle incoming messages from Twilio
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            switch (data.event) {
              case 'connected':
                console.log(`Twilio Media Stream connected for call: ${callSid}`);
                await initGemini();
                break;
                
              case 'start':
                console.log(`Media stream started for call: ${callSid}`);
                break;
                
              case 'media':
                const audioChunk = Buffer.from(data.media.payload, 'base64');
                audioBuffer.push(audioChunk);
                
                if (audioBuffer.length >= 150) {
                  const combinedAudio = Buffer.concat(audioBuffer);
                  audioBuffer = [];
                  
                  if (!isProcessing) {
                    await processAudioChunk(combinedAudio);
                  }
                }
                break;
                
              case 'stop':
                console.log(`Media stream stopped for call: ${callSid}`);
                if (audioBuffer.length > 0) {
                  const combinedAudio = Buffer.concat(audioBuffer);
                  await processAudioChunk(combinedAudio);
                }
                break;
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        });

        ws.on('close', () => {
          console.log(`WebSocket connection closed for call: ${callSid}`);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket error for call ${callSid}:`, error);
        });
      });

      console.log('WebSocket server initialized on port 8080');
      return wss;
    }
    
    initializeWebSocketServer();
    console.log('✅ WebSocket server initialized for Gemini AMD');
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket server:', error);
  }

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 Ready on http://${hostname}:${port}`);
    console.log(`📡 WebSocket server ready on ws://localhost:8080`);
  });
});
