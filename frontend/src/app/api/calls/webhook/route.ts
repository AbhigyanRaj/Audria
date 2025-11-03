import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';

const prisma = new PrismaClient();

/**
 * POST /api/calls/webhook
 * Twilio StatusCallback webhook handler
 * Receives call status updates from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    const {
      CallSid,
      CallStatus,
      CallDuration,
      From,
      To,
      Direction,
    } = body;

    console.log('Twilio Webhook:', {
      CallSid,
      CallStatus,
      CallDuration,
      From,
      To,
      Direction,
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
    });

    if (!call) {
      console.warn(`Call not found for CallSid: ${CallSid}`);
      return NextResponse.json({ received: true });
    }

    // Update call status
    const updateData: any = {
      status: CallStatus,
    };

    if (CallDuration) {
      updateData.duration = parseInt(CallDuration, 10);
    }

    if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'no-answer' || CallStatus === 'busy' || CallStatus === 'canceled') {
      updateData.endedAt = new Date();
      
      // FINALIZE AMD DETECTION after call completes
      const callWithAmd = await prisma.call.findUnique({
        where: { callSid: CallSid },
        include: { amdEvents: true },
      });
      
      if (callWithAmd && callWithAmd.amdEvents.length > 0) {
        const amdEvent = callWithAmd.amdEvents[0];
        const metadata = amdEvent.metadata as any;
        
        if (metadata?.preliminary_detection && metadata?.call_in_progress) {
          // Use preliminary detection as final
          let finalDetection = metadata.preliminary_detection;
          let finalConfidence = metadata.preliminary_confidence || 0.5;
          
          // Apply low confidence override
          if (finalConfidence < 0.7 && finalDetection === 'machine') {
            console.log(`⚠️ Finalizing: Low confidence machine → human (safer)`);
            finalDetection = 'human';
          }
          
          const uiDisplay = finalConfidence < 0.7 ? 'Undecided—treating as human' : finalDetection;
          
          await prisma.aMDEvent.update({
            where: { id: amdEvent.id },
            data: {
              detection: finalDetection,
              confidence: finalConfidence,
              metadata: {
                ...metadata,
                ui_display: uiDisplay,
                call_in_progress: false,
                finalized_at: new Date().toISOString(),
                final_call_duration: parseInt(CallDuration || '0', 10),
              },
            },
          });
          
          console.log(`✅ FINALIZED AMD: ${finalDetection} (${finalConfidence}) - UI: "${uiDisplay}"`);
        }
      }
    }

    await prisma.call.update({
      where: { callSid: CallSid },
      data: updateData,
    });

    console.log(`Call ${CallSid} updated to status: ${CallStatus}`);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing Twilio webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

// Support GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Twilio webhook endpoint' });
}
