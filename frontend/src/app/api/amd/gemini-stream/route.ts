import { NextRequest, NextResponse } from 'next/server';
import { WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import { GeminiAMDProcessor } from '@/lib/gemini';

const prisma = new PrismaClient();

/**
 * WebSocket handler for Gemini Flash real-time AMD
 * Receives audio stream from Twilio Media Streams
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callSid = searchParams.get('callSid');
  const strategy = searchParams.get('strategy');

  if (!callSid || strategy !== 'gemini') {
    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    );
  }

  // This would be handled by a WebSocket server in production
  // For now, return connection info
  return NextResponse.json({
    message: 'Gemini AMD WebSocket endpoint',
    callSid,
    strategy,
    wsUrl: `wss://${request.headers.get('host')}/api/amd/gemini-stream?callSid=${callSid}`,
  });
}

/**
 * POST handler for processing audio chunks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callSid, audioData, sequenceNumber } = body;

    if (!callSid || !audioData) {
      return NextResponse.json(
        { error: 'CallSid and audioData are required' },
        { status: 400 }
      );
    }

    // Find call record
    const call = await prisma.call.findUnique({
      where: { callSid },
      include: { user: true },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Get Gemini API key from environment or user settings
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Process audio with Gemini
    const processor = new GeminiAMDProcessor({
      apiKey: geminiApiKey,
      temperature: 0.1,
      maxTokens: 200,
    });

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    processor.addAudioChunk(audioBuffer);

    // Trigger analysis
    const result = await processor.analyze();

    if (result) {
      // Find existing AMD event or create new one
      const existingEvent = await prisma.aMDEvent.findFirst({
        where: {
          callId: call.id,
          strategy: 'gemini',
        },
      });

      if (existingEvent) {
        // Update existing event
        await prisma.aMDEvent.update({
          where: { id: existingEvent.id },
          data: {
            decision: result.decision,
            confidence: result.confidence,
            latencyMs: result.latencyMs,
            metadata: {
              reasoning: result.reasoning,
              audioLength: result.metadata.audioLength,
              voiceCharacteristics: result.metadata.voiceCharacteristics,
              detectedPatterns: result.metadata.detectedPatterns,
              sequenceNumber,
            },
            timestamp: new Date(),
          },
        });
      } else {
        // Create new event
        await prisma.aMDEvent.create({
          data: {
            callId: call.id,
            strategy: 'gemini',
            decision: result.decision,
            confidence: result.confidence,
            latencyMs: result.latencyMs,
            metadata: {
              reasoning: result.reasoning,
              audioLength: result.metadata.audioLength,
              voiceCharacteristics: result.metadata.voiceCharacteristics,
              detectedPatterns: result.metadata.detectedPatterns,
              sequenceNumber,
            },
            timestamp: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        result: {
          decision: result.decision,
          confidence: result.confidence,
          reasoning: result.reasoning,
          latencyMs: result.latencyMs,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Audio chunk processed, analysis pending',
    });
  } catch (error: any) {
    console.error('Gemini AMD processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    );
  }
}
