import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/calls/twiml
 * Generate TwiML response for call flow
 * This is called by Twilio when the call is answered
 * For synchronous AMD, Twilio includes AnsweredBy parameter
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log('\n' + '='.repeat(80));
  console.log('🟢 TwiML ENDPOINT CALLED');
  console.log('Timestamp:', timestamp);
  console.log('URL:', request.url);
  console.log('Method:', request.method);
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  console.log('='.repeat(80) + '\n');
  
  try {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    console.log('📋 Form Data Received:', body);

    const searchParams = request.nextUrl.searchParams;
    const CallSid = body.CallSid || searchParams.get('CallSid');
    const AnsweredBy = body.AnsweredBy; // Synchronous AMD result
    const strategy = searchParams.get('strategy') || 'twilio';

    console.log('📊 Parsed Parameters:');
    console.log('  - CallSid:', CallSid);
    console.log('  - AnsweredBy:', AnsweredBy);
    console.log('  - Strategy:', strategy);
    console.log('  - Query Params:', Object.fromEntries(searchParams.entries()));

    // Trigger Jambonz analysis in background if using jambonz strategy
    if (strategy === 'jambonz' && CallSid) {
      try {
        // Use ngrok URL for callback (not localhost)
        const baseUrl = process.env.WEBHOOK_BASE_URL || request.nextUrl.origin;
        
        // Call jambonz callback with current call data
        const jambonzData = new FormData();
        jambonzData.append('CallSid', CallSid);
        jambonzData.append('CallStatus', body.CallStatus || 'in-progress');
        jambonzData.append('CallDuration', body.CallDuration || '0');
        if (AnsweredBy) jambonzData.append('AnsweredBy', AnsweredBy);
        
        console.log('🔵 Triggering Jambonz callback to:', `${baseUrl}/api/amd/jambonz-callback`);
        
        fetch(`${baseUrl}/api/amd/jambonz-callback`, {
          method: 'POST',
          body: jambonzData,
        }).catch(err => console.error('Jambonz callback error:', err));
      } catch (error) {
        console.error('Error triggering Jambonz analysis:', error);
      }
    }

    // If we have AMD result from synchronous detection, save it
    if (CallSid && AnsweredBy) {
      try {
        const call = await prisma.call.findUnique({
          where: { callSid: CallSid },
          include: { amdEvents: true },
        });

        if (call) {
          let detection = 'human'; // Default to human (safer for customer experience)
          let confidence = 0.5;
          let fallbackApplied = false;
          const originalAnsweredBy = AnsweredBy;

          // STRATEGY: Always make a decision - NEVER return unknown/pending
          console.log('🎯 AMD Analysis - AnsweredBy:', AnsweredBy);

          if (AnsweredBy === 'human') {
            detection = 'human';
            confidence = 0.95;
            console.log('✅ Twilio says: HUMAN (95% confidence)');
          } else if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep' || AnsweredBy === 'machine_end_silence') {
            detection = 'machine';
            confidence = 0.90;
            console.log('✅ Twilio says: MACHINE (90% confidence)');
          } else {
            // TRIAL ACCOUNT FALLBACK: Twilio returned unknown/fax/nothing
            console.log('⚠️ Twilio AMD uncertain - applying intelligent fallback');
            fallbackApplied = true;
            
            // Get timing data
            const amdDuration = parseInt(body.MachineDetectionDuration || '0');
            const callDuration = parseInt(body.CallDuration || '0');
            const dialCallDuration = parseInt(body.DialCallDuration || '0');
            
            console.log('📊 Timing Data:');
            console.log('  - AMD Duration:', amdDuration, 'ms');
            console.log('  - Call Duration:', callDuration, 'seconds');
            console.log('  - Dial Duration:', dialCallDuration, 'seconds');
            
            // PDF REQUIREMENTS - Intelligent heuristics for trial accounts
            // Voicemail (Costco): Machine (greeting >5 words) → Hangup + log 'machine_detected'
            // Human Pickup: Human (short "hello") → Play prompt + connect stream
            // Timeout (3s silence): Fallback to human → UI shows "Undecided—treating as human"
            
            console.log('⚠️ Trial Account: Twilio returned "unknown" - applying PDF heuristics');
            
            // HEURISTIC 1: AMD Duration Analysis (most reliable on trial)
            if (amdDuration > 0) {
              // Very quick answer (< 1500ms) = Human saying "hello" quickly
              if (amdDuration < 1500) {
                detection = 'human';
                confidence = 0.85;
                console.log('✅ HEURISTIC: Quick answer (<1.5s) = HUMAN (85%) - Short "hello" detected');
              }
              // Very long greeting (> 8000ms) = Voicemail with long message
              else if (amdDuration > 8000) {
                detection = 'machine';
                confidence = 0.90;
                console.log('✅ HEURISTIC: Very long greeting (>8s) = MACHINE (90%) - Voicemail detected');
              }
              // Long greeting (5000-8000ms) = Likely voicemail (>5 words)
              else if (amdDuration >= 5000 && amdDuration <= 8000) {
                detection = 'machine';
                confidence = 0.80;
                console.log('✅ HEURISTIC: Long greeting (5-8s) = MACHINE (80%) - Greeting >5 words');
              }
              // Medium duration (3000-5000ms) = Could be human or machine
              else if (amdDuration >= 3000 && amdDuration < 5000) {
                detection = 'machine';
                confidence = 0.65;
                console.log('⚠️ HEURISTIC: Medium greeting (3-5s) = MACHINE (65%) - Possible voicemail');
              }
              // Quick-medium (1500-3000ms) = Likely human answering normally
              else {
                detection = 'human';
                confidence = 0.75;
                console.log('✅ HEURISTIC: Normal answer (1.5-3s) = HUMAN (75%) - Human pickup');
              }
            }
            // HEURISTIC 2: No AMD duration - use call duration (timeout scenario)
            else if (callDuration > 0) {
              // Very short call (< 3s) = Timeout or quick hangup
              if (callDuration < 3) {
                detection = 'human';
                confidence = 0.55;
                console.log('⚠️ HEURISTIC: Timeout (3s silence) = HUMAN (55%) - Fallback to human');
              }
              // Short call (3-5s) = Possible machine quick hangup
              else if (callDuration < 5) {
                detection = 'machine';
                confidence = 0.60;
                console.log('⚠️ HEURISTIC: Short call (<5s) = MACHINE (60%) - Quick hangup');
              }
              // Normal call length = Human stayed on line
              else {
                detection = 'human';
                confidence = 0.70;
                console.log('✅ HEURISTIC: Normal call length = HUMAN (70%) - Human stayed on line');
              }
            }
            // HEURISTIC 3: No data at all - safe default to human (PDF requirement)
            else {
              detection = 'human';
              confidence = 0.50;
              console.log('⚠️ HEURISTIC: No data - HUMAN (50%) - Safe default per PDF');
            }
          }

          // IMPORTANT: This is PRELIMINARY detection (call still in progress)
          // Final detection will be determined after call completes
          console.log('📊 PRELIMINARY Detection (call in-progress):');
          console.log(`   Initial: ${detection} (${confidence})`);
          
          // PDF REQUIREMENT: Handle low confidence (<0.7)
          let uiDisplay = 'Analyzing'; // Show analyzing during call
          let needsRetry = false;
          
          if (confidence < 0.7) {
            uiDisplay = 'Analyzing';
            needsRetry = true;
            console.log('⚠️ LOW CONFIDENCE (<0.7) - Will finalize after call completes');
          } else {
            uiDisplay = 'Analyzing';
            console.log('✅ GOOD CONFIDENCE - Will finalize after call completes');
          }
          
          // PDF REQUIREMENT: Log machine_detected for high confidence machine
          if (detection === 'machine' && confidence >= 0.85) {
            console.log('🔴 Preliminary: machine_detected - Will hangup if confirmed');
          }
          
          // Store preliminary detection, will update after call completes
          const prelimDetection = detection;
          const prelimConfidence = confidence;
          
          // Set to "analyzing" for now - will update in webhook
          detection = 'analyzing';
          confidence = 0.0;

          // Update existing AMD event - find by callSid and strategy
          const existingEvent = call.amdEvents.find(e => e.strategy === strategy);
          if (existingEvent) {
            await prisma.aMDEvent.update({
              where: { id: existingEvent.id },
              data: {
                detection,
                confidence,
                metadata: {
                  answeredBy: AnsweredBy,
                  original_answered_by: originalAnsweredBy,
                  fallback_applied: fallbackApplied,
                  trial_account: true,
                  amd_duration: body.MachineDetectionDuration,
                  sync_amd: true,
                  updated_at: new Date().toISOString(),
                  // PDF requirements
                  ui_display: uiDisplay,
                  low_confidence: prelimConfidence < 0.7,
                  needs_retry: needsRetry,
                  preliminary_detection: prelimDetection,
                  preliminary_confidence: prelimConfidence,
                  call_in_progress: true,
                },
              },
            });
            console.log(`✅ AMD result saved for ${strategy}: ${detection} (${AnsweredBy}) - confidence: ${confidence}`);
            if (uiDisplay !== detection) {
              console.log(`   UI will display: "${uiDisplay}"`);
            }
          } else {
            console.warn(`⚠️ No AMD event found for strategy: ${strategy}, CallSid: ${CallSid}`);
            console.log('Available AMD events:', call.amdEvents.map(e => ({ id: e.id, strategy: e.strategy, detection: e.detection })));
          }
        }
      } catch (error) {
        console.error('Error saving AMD result:', error);
      }
    }

    console.log('\n🎯 Generating TwiML for strategy:', strategy);
    
    // Generate TwiML based on strategy and AMD result
    let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
    twiml += '<Response>';
    
    // If machine detected, hangup immediately
    if (AnsweredBy && (AnsweredBy.startsWith('machine') || AnsweredBy === 'fax')) {
      console.log('🔴 Machine detected - hanging up immediately');
      twiml += '<Say voice="alice">Goodbye.</Say>';
      twiml += '<Hangup/>';
      twiml += '</Response>';
      
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    
    // If human detected or unknown, continue with conversation
    console.log('✅ Human detected or unknown - continuing call');
    
    if (strategy === 'twilio') {
      twiml += '<Say voice="alice">Hello! You have been connected. This is a test call from Audria AMD system.</Say>';
      twiml += '<Pause length="2"/>';
      twiml += '<Say voice="alice">If you can hear me, please say hello.</Say>';
      twiml += '<Pause length="3"/>';
      twiml += '<Say voice="alice">Thank you for your time. This call will now end. Goodbye!</Say>';
      twiml += '<Hangup/>';
    } else if (strategy === 'gemini') {
      // Enable Media Stream for real-time Gemini analysis
      const wsUrl = process.env.WEBSOCKET_URL || 'wss://4f655e5164cc.ngrok-free.app';
      
      console.log('🔵 Starting Gemini Media Stream:', `${wsUrl}?callSid=${CallSid}`);
      twiml += `<Start><Stream url="${wsUrl}?callSid=${CallSid}" /></Start>`;
      
      twiml += '<Say voice="alice">Hello! You have been connected. This is a test call using Gemini AMD.</Say>';
      twiml += '<Pause length="2"/>';
      twiml += '<Say voice="alice">Please say hello if you can hear me.</Say>';
      twiml += '<Pause length="5"/>';
      twiml += '<Say voice="alice">Thank you. This call will now end. Goodbye!</Say>';
      twiml += '<Hangup/>';
    } else if (strategy === 'jambonz') {
      twiml += '<Say voice="alice">Hello! You have been connected. This is a test call using Jambonz AMD.</Say>';
      twiml += '<Pause length="2"/>';
      twiml += '<Say voice="alice">Please say hello if you can hear me.</Say>';
      twiml += '<Pause length="3"/>';
      twiml += '<Say voice="alice">Thank you. This call will now end. Goodbye!</Say>';
      twiml += '<Hangup/>';
    } else if (strategy === 'huggingface') {
      // Enable Media Stream for real-time HuggingFace analysis
      const wsUrl = process.env.WEBSOCKET_URL || 'wss://4f655e5164cc.ngrok-free.app';
      
      console.log('🤗 Starting HuggingFace Media Stream:', `${wsUrl}?callSid=${CallSid}&strategy=huggingface`);
      twiml += `<Start><Stream url="${wsUrl}?callSid=${CallSid}&strategy=huggingface" /></Start>`;
      
      twiml += '<Say voice="alice">Hello! You have been connected. This is a test call using HuggingFace AMD.</Say>';
      twiml += '<Pause length="2"/>';
      twiml += '<Say voice="alice">Please say hello if you can hear me.</Say>';
      twiml += '<Pause length="5"/>';
      twiml += '<Say voice="alice">Thank you. This call will now end. Goodbye!</Say>';
      twiml += '<Hangup/>';
    } else if (strategy === 'fastapi') {
      // Enable Media Stream for real-time FastAPI ML analysis
      const wsUrl = process.env.WEBSOCKET_URL || 'wss://4f655e5164cc.ngrok-free.app';
      
      console.log('🐍 Starting FastAPI Media Stream:', `${wsUrl}?callSid=${CallSid}&strategy=fastapi`);
      twiml += `<Start><Stream url="${wsUrl}?callSid=${CallSid}&strategy=fastapi" /></Start>`;
      
      twiml += '<Say voice="alice">Hello! You have been connected. This is a test call using FastAPI ML AMD.</Say>';
      twiml += '<Pause length="2"/>';
      twiml += '<Say voice="alice">Please say hello if you can hear me.</Say>';
      twiml += '<Pause length="5"/>';
      twiml += '<Say voice="alice">Thank you. This call will now end. Goodbye!</Say>';
      twiml += '<Hangup/>';
    } else {
      twiml += '<Say voice="alice">Hello! You have been connected. This is a test call.</Say>';
      twiml += '<Pause length="2"/>';
      twiml += '<Say voice="alice">Thank you. Goodbye!</Say>';
      twiml += '<Hangup/>';
    }
    
    twiml += '</Response>';

    console.log('\n📤 TwiML Response Generated:');
    console.log(twiml);
    console.log('\n✅ Sending TwiML response (200 OK)');
    console.log('='.repeat(80) + '\n');

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERROR IN TWIML ENDPOINT');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('='.repeat(80) + '\n');
    
    // Return error TwiML
    const errorTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say><Hangup/></Response>';
    return new NextResponse(errorTwiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  console.log('🔵 TwiML GET request received (redirecting to POST handler)');
  return POST(request);
}
