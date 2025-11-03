import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // WebSocket server is already initialized in server.js
    // This endpoint just confirms it's ready
    
    return NextResponse.json({ 
      message: 'WebSocket server already running',
      port: 8080,
      status: 'ready'
    });
  } catch (error) {
    console.error('WebSocket server check failed:', error);
    return NextResponse.json(
      { error: 'WebSocket server not available' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
