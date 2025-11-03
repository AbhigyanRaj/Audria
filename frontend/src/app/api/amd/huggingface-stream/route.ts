import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { HuggingFaceAMDProcessor } from '@/lib/huggingface';

const prisma = new PrismaClient();

/**
 * WebSocket handler for HuggingFace real-time AMD
 * Receives audio stream from Twilio Media Streams
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callSid = searchParams.get('callSid');
  const strategy = searchParams.get('strategy');

  if (!callSid || strategy !== 'huggingface') {
    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: 'HuggingFace AMD WebSocket endpoint',
    callSid,
    strategy,
    wsUrl: `wss://${request.headers.get('host')}/api/amd/huggingface-stream?callSid=${callSid}`,
  });
}

/**
 * POST handler for processing audio chunks with HuggingFace
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

    // Get HuggingFace API key from environment
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      return NextResponse.json(
        { error: 'HuggingFace API key not configured' },
        { status: 500 }
      );
    }

    // Process audio with HuggingFace
    const processor = new HuggingFaceAMDProcessor({
      apiKey: hfApiKey,
      threshold: 0.7,
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
          strategy: 'huggingface',
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
              scores: result.scores,
              audioLength: result.metadata.audioLength,
              modelUsed: result.metadata.modelUsed,
              features: result.metadata.features,
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
            strategy: 'huggingface',
            decision: result.decision,
            confidence: result.confidence,
            latencyMs: result.latencyMs,
            metadata: {
              scores: result.scores,
              audioLength: result.metadata.audioLength,
              modelUsed: result.metadata.modelUsed,
              features: result.metadata.features,
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
          scores: result.scores,
          latencyMs: result.latencyMs,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Audio chunk processed, analysis pending',
    });
  } catch (error: any) {
    console.error('HuggingFace AMD processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    );
  }
}
