# AMD Call Flow Summary

## Overview
This document explains what happens after a call is initiated and ends, based on the project requirements.

---

## 📞 Call Flow by Detection Result

### **Case 1: MACHINE/VOICEMAIL DETECTED**

**Trigger:** AMD detects >5 words or voicemail pattern

**Current Implementation:**
1. ✅ Call is initiated via Twilio
2. ✅ AMD event created with `detection: 'pending'`
3. ✅ TwiML plays greeting message
4. ⚠️ **MISSING:** Real-time detection during call
5. ⚠️ **MISSING:** Immediate hangup on machine detection
6. ✅ Call completes and status updated in database
7. ⚠️ AMD event stays as "pending" (not updated to "machine")

**Required Implementation:**
1. Enable Twilio MachineDetection parameter
2. Receive AMD callback with `AnsweredBy: 'machine_start'`
3. Update AMD event: `detection: 'machine'`, `confidence: 0.90`
4. **Hangup call immediately** (save costs)
5. Log final result in database

**Expected Database State:**
```
Call:
  - status: 'completed'
  - duration: ~5s
  - endedAt: timestamp

AMDEvent:
  - detection: 'machine'
  - confidence: 0.90
  - latencyMs: 2100
  - strategy: 'twilio'
```

---

### **Case 2: HUMAN DETECTED**

**Trigger:** AMD detects human voice (immediate "hello")

**Current Implementation:**
1. ✅ Call is initiated via Twilio
2. ✅ AMD event created with `detection: 'pending'`
3. ✅ TwiML plays greeting message
4. ⚠️ **MISSING:** Real-time human detection
5. ⚠️ **MISSING:** Connect to agent/destination
6. ✅ Call completes and status updated
7. ⚠️ AMD event stays as "pending" (not updated to "human")

**Required Implementation:**
1. Enable Twilio MachineDetection parameter
2. Receive AMD callback with `AnsweredBy: 'human'` (within <3s)
3. Update AMD event: `detection: 'human'`, `confidence: 0.95`
4. **Connect call to agent or play message**
5. Continue call flow (don't hangup)
6. Log final result in database

**Expected Database State:**
```
Call:
  - status: 'in-progress' or 'completed'
  - duration: varies (could be minutes)
  - endedAt: timestamp when call ends

AMDEvent:
  - detection: 'human'
  - confidence: 0.95
  - latencyMs: 1800 (under 3s target)
  - strategy: 'twilio'
```

---

### **Case 3: UNKNOWN/TIMEOUT**

**Trigger:** No clear detection after 3s silence or ambiguous audio

**Current Implementation:**
1. ✅ Call is initiated
2. ✅ AMD event created with `detection: 'pending'`
3. ✅ TwiML plays greeting
4. ⚠️ **MISSING:** Timeout detection
5. ⚠️ **MISSING:** Fallback logic
6. ✅ Call completes
7. ⚠️ AMD event stays as "pending"

**Required Implementation:**
1. Enable Twilio MachineDetection with timeout
2. Receive AMD callback with `AnsweredBy: 'unknown'`
3. Update AMD event: `detection: 'unknown'`, `confidence: 0.50`
4. **Apply fallback logic:**
   - Option A: Treat as human (connect)
   - Option B: Treat as machine (hangup)
   - Option C: Play message and wait for response
5. Log final result

**Expected Database State:**
```
Call:
  - status: 'completed'
  - duration: varies based on fallback
  - endedAt: timestamp

AMDEvent:
  - detection: 'unknown'
  - confidence: 0.50
  - latencyMs: 3000 (timeout)
  - strategy: 'twilio'
```

---

## 🔧 What's Currently Broken

### **Issue 1: AMD Results Stay "Pending"**
**Problem:** All calls show `detection: 'pending'` in database
**Cause:** 
- Twilio MachineDetection parameter not enabled in call initiation
- No AMD callbacks being received
- AMD events never updated after creation

**Fix Required:**
```typescript
// In /api/calls/initiate/route.ts
callOptions.machineDetection = 'Enable';
callOptions.asyncAmd = true;
callOptions.asyncAmdStatusCallback = `${baseUrl}/api/amd/twilio-callback`;
```

### **Issue 2: No Action on Detection**
**Problem:** Calls continue regardless of detection result
**Cause:** TwiML doesn't check AMD result before proceeding

**Fix Required:**
- For machine: Add `<Hangup/>` immediately
- For human: Add `<Dial>` to connect to agent or play custom message

### **Issue 3: No Real-Time Processing**
**Problem:** Gemini/HuggingFace strategies don't process audio
**Cause:** WebSocket media streaming not implemented (Next.js limitation)

**Fix Required:**
- Implement standalone WebSocket server for media streams
- Or use Twilio Functions for real-time processing
- Or simplify to post-call analysis

---

## ✅ What Needs to Be Implemented

### **Priority 1: Enable Twilio Native AMD**
1. Add MachineDetection parameter to call initiation
2. Test with voicemail numbers (Costco: 1-800-774-2678)
3. Verify AMD callback updates database
4. Confirm detection results appear in Call History

### **Priority 2: Implement Call Actions**
1. Add conditional TwiML based on AMD result
2. Hangup on machine detection
3. Connect or play message on human detection
4. Handle unknown cases with fallback logic

### **Priority 3: Test All Strategies**
1. Twilio Native AMD (fastest, ~2s)
2. Gemini Flash (most accurate, ~5s) - requires WebSocket
3. HuggingFace ML (good balance, ~4s) - requires WebSocket
4. Jambonz SIP (specialized, ~3s) - requires SIP integration

### **Priority 4: Analytics & Reporting**
1. Calculate accuracy per strategy
2. Measure average latency per strategy
3. Track cost per strategy
4. Generate comparison reports

---

## 📊 Success Metrics

### **Performance Targets:**
- **Latency:** <3s for human detection
- **Accuracy:** >90% for all strategies
- **Cost:** Minimize by hanging up on machines quickly

### **Test Cases:**
1. ✅ Call to personal phone (human) - should detect "human" in <3s
2. ⚠️ Call to Costco voicemail - should detect "machine" and hangup
3. ⚠️ Call with 3s silence - should timeout and apply fallback
4. ⚠️ Call with fax tone - should detect "machine"

---

## 🚀 Next Steps

1. **Enable Twilio MachineDetection** in call initiation
2. **Test AMD callback** with real phone calls
3. **Verify database updates** from "pending" to actual results
4. **Implement hangup logic** for machine detection
5. **Add connect logic** for human detection
6. **Test all 4 strategies** and compare results
7. **Document findings** in README with comparison table

---

## 📝 Current Status

**Working:**
- ✅ Call initiation
- ✅ TwiML generation
- ✅ Database logging
- ✅ Call history display
- ✅ Status webhooks

**Not Working:**
- ❌ AMD detection results (all "pending")
- ❌ Real-time audio processing
- ❌ Automatic hangup on machine
- ❌ Call connection on human
- ❌ Strategy comparison data

**Needs Testing:**
- ⚠️ Twilio Native AMD with MachineDetection
- ⚠️ Voicemail detection accuracy
- ⚠️ Human detection speed (<3s)
- ⚠️ Cost optimization (early hangup)
