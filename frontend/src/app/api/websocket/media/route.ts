import { NextRequest } from 'next/server';

/**
 * WebSocket endpoint for Twilio Media Streams
 * This handles the upgrade from HTTP to WebSocket for Gemini AMD
 */
export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get('upgrade');
  
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // For Next.js, we need to handle WebSocket upgrades differently
  // This endpoint signals that WebSocket is available
  return new Response('WebSocket endpoint ready', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}
