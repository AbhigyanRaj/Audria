import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/amd/twilio-callback
 * Twilio Native AMD callback handler
 * Receives AMD detection results from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== AMD CALLBACK RECEIVED ===');
    
    const formData = await request.formData();
    const body: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    console.log('Full AMD callback body:', body);

    const {
      CallSid,
      AnsweredBy,
      MachineDetectionDuration,
    } = body;

    console.log('Twilio AMD Callback:', {
      CallSid,
      AnsweredBy,
      MachineDetectionDuration,
      timestamp: new Date().toISOString(),
    });

    if (!CallSid) {
      return NextResponse.json(
        { error: 'CallSid is required' },
        { status: 400 }
      );
    }

    // Find call record
    const call = await prisma.call.findUnique({
      where: { callSid: CallSid },
      include: { amdEvents: true },
    });

    if (!call) {
      console.warn(`Call not found for CallSid: ${CallSid}`);
      return NextResponse.json({ received: true });
    }

    // Determine detection based on AnsweredBy
    let detection = 'unknown';
    let confidence = 0.5;
    
    if (AnsweredBy === 'human') {
      detection = 'human';
      confidence = 0.95;
    } else if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep' || AnsweredBy === 'machine_end_silence') {
      detection = 'machine';
      confidence = 0.90;
    } else if (AnsweredBy === 'fax') {
      detection = 'machine';
      confidence = 0.85;
    }

    // Calculate latency in milliseconds (Twilio sends in seconds, convert to ms)
    const latencyMs = MachineDetectionDuration ? Math.round(parseFloat(MachineDetectionDuration) * 1000) : 0;

    // Find existing AMD event for this call
    const existingEvent = call.amdEvents.find(e => e.strategy === 'twilio');

    if (existingEvent) {
      // Update existing event
      await prisma.aMDEvent.update({
        where: { id: existingEvent.id },
        data: {
          detection,
          confidence,
          latencyMs,
          metadata: {
            answeredBy: AnsweredBy,
            machineDetectionDuration: MachineDetectionDuration,
            updated_at: new Date().toISOString(),
          },
        },
      });
    } else {
      // Create new AMD event
      await prisma.aMDEvent.create({
        data: {
          callId: call.id,
          callSid: CallSid,
          strategy: 'twilio',
          detection,
          confidence,
          latencyMs,
          metadata: {
            answeredBy: AnsweredBy,
            machineDetectionDuration: MachineDetectionDuration,
          },
        },
      });
    }

    console.log(`AMD result for ${CallSid}: ${detection} (${AnsweredBy}) - ${confidence * 100}% confidence`);

    return NextResponse.json({ received: true, detection, confidence });
  } catch (error: any) {
    console.error('Error processing AMD callback:', error);
    return NextResponse.json(
      { error: 'Failed to process AMD callback' },
      { status: 500 }
    );
  }
}

// Support GET for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Twilio AMD callback endpoint' });
}
