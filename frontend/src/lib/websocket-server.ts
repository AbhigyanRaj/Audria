/**
 * WebSocket Server for Twilio Media Streams
 * Routes connections to appropriate AMD strategy handlers
 */

import { WebSocketServer } from 'ws';
import { handleGeminiMediaStream } from './gemini-stream-handler';
import { handleHuggingFaceMediaStream } from './huggingface-stream-handler';
import { handleFastAPIMediaStream } from './fastapi-stream-handler';

let wss: WebSocketServer | null = null;

export function startWebSocketServer(port: number = 8080) {
  if (wss) {
    console.log('WebSocket server already running');
    return wss;
  }

  wss = new WebSocketServer({ port });
  
  console.log(`🔌 WebSocket server started on port ${port}`);
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, 'http://localhost');
    const strategy = url.searchParams.get('strategy');
    
    console.log(`WebSocket connection established with strategy: ${strategy}`);
    
    // Route to appropriate handler based on strategy
    if (strategy === 'gemini') {
      handleGeminiMediaStream(ws);
    } else if (strategy === 'huggingface') {
      handleHuggingFaceMediaStream(ws);
    } else if (strategy === 'fastapi') {
      handleFastAPIMediaStream(ws);
    } else {
      console.warn(`Unknown strategy: ${strategy}, defaulting to Gemini`);
      handleGeminiMediaStream(ws);
    }
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  return wss;
}

export function stopWebSocketServer() {
  if (wss) {
    wss.close();
    wss = null;
    console.log('WebSocket server stopped');
  }
}
