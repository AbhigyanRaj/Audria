import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/amd/jambonz-callback
 * Jambonz SIP-Enhanced AMD callback handler
 * Uses heuristic analysis of call patterns for AMD detection
 */
export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(80));
  console.log('🔵 JAMBONZ AMD CALLBACK RECEIVED');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    const CallSid = body.CallSid;
    const CallStatus = body.CallStatus;
    const CallDuration = body.CallDuration;
    const AnsweredBy = body.AnsweredBy; // May be present from Twilio

    console.log('📋 Jambonz Analysis Input:');
    console.log('  - CallSid:', CallSid);
    console.log('  - CallStatus:', CallStatus);
    console.log('  - CallDuration:', CallDuration);
    console.log('  - AnsweredBy:', AnsweredBy);

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

    // Use MachineDetectionDuration from Twilio (time from answer to AMD result)
    // This is more accurate than elapsed time from call start
    const machineDetectionDuration = body.MachineDetectionDuration 
      ? parseInt(body.MachineDetectionDuration) 
      : null;
    
    const callDurationSeconds = CallDuration ? parseInt(CallDuration) : 0;

    // Heuristic-based AMD analysis
    let detection = 'unknown';
    let confidence = 0.5;
    let analysisMethod = 'heuristic';

    console.log('⏱️ Timing Analysis:');
    console.log('  - MachineDetectionDuration:', machineDetectionDuration, 'ms');
    console.log('  - Call duration:', callDurationSeconds, 'seconds');
    console.log('  - Call status:', CallStatus);

    // Rule 1: Use Twilio's AnsweredBy if available (highest priority)
    if (AnsweredBy && AnsweredBy !== 'unknown') {
      if (AnsweredBy === 'human') {
        detection = 'human';
        confidence = 0.85;
        analysisMethod = 'twilio_assisted';
        console.log('✅ Rule 1: Twilio says HUMAN');
      } else if (AnsweredBy.startsWith('machine')) {
        detection = 'machine';
        confidence = 0.80;
        analysisMethod = 'twilio_assisted';
        console.log('✅ Rule 1: Twilio says MACHINE');
      }
    } 
    // Rule 2: Very quick AMD detection (< 3s) = likely human
    else if (machineDetectionDuration && machineDetectionDuration < 3000) {
      detection = 'human';
      confidence = 0.75;
      analysisMethod = 'quick_detection';
      console.log('✅ Rule 2: Quick AMD detection (<3s) = HUMAN');
    }
    // Rule 3: Long AMD detection (> 5s) = likely machine
    else if (machineDetectionDuration && machineDetectionDuration > 5000) {
      detection = 'machine';
      confidence = 0.70;
      analysisMethod = 'delayed_detection';
      console.log('✅ Rule 3: Long AMD detection (>5s) = MACHINE');
    }
    // Rule 4: Call completed very quickly (< 10s) = likely voicemail
    else if (CallStatus === 'completed' && callDurationSeconds < 10) {
      detection = 'machine';
      confidence = 0.65;
      analysisMethod = 'quick_hangup';
      console.log('✅ Rule 4: Quick hangup (<10s) = MACHINE');
    }
    // Rule 5: Default to human if uncertain (safer)
    else {
      detection = 'human';
      confidence = 0.60;
      analysisMethod = 'fallback_to_human';
      console.log('⚠️ Rule 5: Uncertain, defaulting to HUMAN (safer)');
    }

    const latencyMs = machineDetectionDuration || 0;

    // Find existing AMD event for jambonz strategy
    const existingEvent = call.amdEvents.find(e => e.strategy === 'jambonz');

    if (existingEvent) {
      // Update existing event
      await prisma.aMDEvent.update({
        where: { id: existingEvent.id },
        data: {
          detection,
          confidence,
          latencyMs,
          metadata: {
            analysisMethod,
            callStatus: CallStatus,
            machineDetectionDuration,
            callDurationSeconds,
            answeredBy: AnsweredBy || 'not_provided',
            timestamp: new Date().toISOString(),
          },
        },
      });
      console.log(`✅ Jambonz AMD updated: ${detection} (${analysisMethod}) - confidence: ${confidence}`);
    } else {
      // Create new AMD event
      await prisma.aMDEvent.create({
        data: {
          callId: call.id,
          callSid: CallSid,
          strategy: 'jambonz',
          detection,
          confidence,
          latencyMs,
          metadata: {
            analysisMethod,
            callStatus: CallStatus,
            machineDetectionDuration,
            callDurationSeconds,
            answeredBy: AnsweredBy || 'not_provided',
          },
        },
      });
      console.log('\n🎯 Jambonz AMD Decision:');
      console.log('  - Detection:', detection);
      console.log('  - Confidence:', confidence);
      console.log('  - Method:', analysisMethod);
      console.log('  - Latency:', latencyMs, 'ms');
    }

    console.log('✅ Jambonz AMD analysis complete');
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      detection,
      confidence,
    });
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERROR IN JAMBONZ CALLBACK');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80) + '\n');
    return NextResponse.json(
      { error: 'Failed to process Jambonz callback' },
      { status: 500 }
    );
  }
}

// Support GET for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Jambonz AMD callback endpoint',
    methods: ['POST'],
    description: 'Processes SIP-enhanced AMD analysis results'
  });
}
