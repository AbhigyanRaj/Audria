import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initiateCall, validatePhoneNumber } from '@/lib/twilio';
import { decrypt } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/calls/initiate
 * Initiate an outbound call with AMD
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { targetNumber, strategy = 'twilio' } = body;

    // Validate target phone number
    if (!targetNumber) {
      return NextResponse.json(
        { error: 'Target phone number is required' },
        { status: 400 }
      );
    }

    if (!validatePhoneNumber(targetNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +12345678900)' },
        { status: 400 }
      );
    }

    // For now, use environment variables for Twilio credentials
    // TODO: Implement user-specific encrypted credentials in settings
    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    };

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured in environment variables.' },
        { status: 400 }
      );
    }

    // Validate phone number for trial account restrictions
    function validatePhoneNumber(phoneNumber: string) {
      // Check for toll-free numbers (trial accounts can't call these)
      if (phoneNumber.match(/^\+1(800|888|877|866|855|844|833)/)) {
        throw new Error('TRIAL_RESTRICTION: Cannot call toll-free numbers on trial account. Please verify your personal phone number at https://console.twilio.com/phone-numbers/verified or upgrade to a paid account.');
      }
      
      // E.164 format validation: +[country code][number]
      // Support US (+1) and India (+91) numbers
      const usNumber = phoneNumber.match(/^\+1[0-9]{10}$/);
      const indiaNumber = phoneNumber.match(/^\+91[6-9][0-9]{9}$/); // India mobile: starts with 6-9, 10 digits
      
      if (!usNumber && !indiaNumber) {
        throw new Error('Invalid phone number format. Use E.164 format: +1XXXXXXXXXX (US) or +91XXXXXXXXXX (India). Note: On trial accounts, you must verify this number at https://console.twilio.com/phone-numbers/verified first.');
      }
      
      return true;
    }
    
    // Validate the target number
    try {
      validatePhoneNumber(targetNumber);
    } catch (validationError: any) {
      console.error('❌ Phone number validation failed:', validationError.message);
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    // Get base URL for callbacks - MUST be public ngrok URL for Twilio webhooks
    const baseUrl = process.env.WEBHOOK_BASE_URL;
    
    if (!baseUrl) {
      console.error('WEBHOOK_BASE_URL not configured!');
      return NextResponse.json(
        { 
          error: 'WEBHOOK_BASE_URL not configured. Please set your ngrok URL in .env.local (e.g., WEBHOOK_BASE_URL=https://xxxxx.ngrok-free.app)' 
        },
        { status: 500 }
      );
    }
    
    console.log('Using webhook base URL:', baseUrl);

    // Prepare call options based on strategy
    const callOptions: any = {
      to: targetNumber,
      from: twilioConfig.phoneNumber,
      url: `${baseUrl}/api/calls/twiml?strategy=${strategy}`,
      statusCallback: `${baseUrl}/api/calls/webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    };

    // Add AMD parameters - optimized for trial account
    // AsyncAMD requires paid account, so using Enable for better detection
    callOptions.machineDetection = 'Enable';
    callOptions.asyncAmd = false;
    
    // Optimize AMD parameters for trial account (longer timeouts = better accuracy)
    callOptions.machineDetectionTimeout = 30; // Increase from default 5s to 30s
    callOptions.machineDetectionSpeechThreshold = 2500; // Increase speech threshold
    callOptions.machineDetectionSpeechEndThreshold = 1500; // Increase end threshold  
    callOptions.machineDetectionSilenceTimeout = 3000; // Increase silence timeout

    console.log('Call options:', {
      to: callOptions.to,
      from: callOptions.from,
      url: callOptions.url,
      statusCallback: callOptions.statusCallback,
      asyncAmdStatusCallback: callOptions.asyncAmdStatusCallback,
      machineDetection: callOptions.machineDetection,
    });

    // Start WebSocket server for Gemini strategy
    if (strategy === 'gemini') {
      try {
        await fetch(`${baseUrl}/api/websocket/start`, { method: 'GET' });
      } catch (error) {
        console.log('WebSocket server may already be running');
      }
    }

    // Initiate Twilio call first to get unique CallSid
    console.log('📞 Calling Twilio API...');
    const twilioCall = await initiateCall(twilioConfig, callOptions);
    
    console.log('✅ Twilio call initiated successfully:');
    console.log('  - CallSid:', twilioCall.sid);
    console.log('  - Status:', twilioCall.status);
    console.log('  - Direction:', twilioCall.direction);

    // Create Call record in database with actual Twilio CallSid
    console.log('💾 Creating call record in database...');
    const callRecord = await prisma.call.create({
      data: {
        userId: session.user.id,
        callSid: twilioCall.sid,
        targetNumber,
        fromNumber: twilioConfig.phoneNumber,
        status: twilioCall.status,
        startedAt: new Date(),
      },
    });
    console.log('✅ Call record created with ID:', callRecord.id);

    // Create initial AMD event - will be updated when TwiML receives AnsweredBy
    console.log('💾 Creating initial AMD event...');
    const amdEvent = await prisma.aMDEvent.create({
      data: {
        callId: callRecord.id,
        callSid: twilioCall.sid,
        strategy,
        detection: 'analyzing', // Will be updated to human/machine by TwiML
        confidence: 0.0,
        latencyMs: 0,
        metadata: {
          strategy_version: strategy === 'gemini' ? 'gemini-2.0-flash-exp' : 
                           strategy === 'huggingface' ? 'wav2vec2-base' :
                           strategy === 'fastapi' ? 'fastapi-ensemble' :
                           strategy === 'jambonz' ? 'jambonz-heuristic' : 'twilio_native_amd',
          call_initiated_at: new Date().toISOString(),
          target_number: targetNumber,
          status: 'awaiting_answer',
          trial_account: true,
          strategy_type: strategy,
          ...( strategy === 'twilio' ? {
            amd_parameters: {
              machineDetection: 'Enable',
              timeout: 30,
              speechThreshold: 2500,
              speechEndThreshold: 1500,
              silenceTimeout: 3000
            }
          } : {}),
          ...( strategy === 'gemini' ? {
            model: 'gemini-2.0-flash-exp',
            api_provider: 'Google AI',
            websocket_streaming: true
          } : {})
        }
      },
    });
    console.log('✅ AMD event created with ID:', amdEvent.id);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      callId: callRecord.id,
      callSid: twilioCall.sid,
      status: twilioCall.status,
      targetNumber,
      strategy,
    });
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERROR INITIATING CALL');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('='.repeat(80) + '\n');
    
    return NextResponse.json(
      { error: error.message || 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
