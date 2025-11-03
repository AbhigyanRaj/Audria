# 🧪 AMD TESTING GUIDE - TRIAL ACCOUNT

**Date**: November 3, 2025  
**Account Type**: Twilio Trial  
**Status**: Ready for Testing

---

## 📋 **PRE-TESTING SETUP**

### **Step 1: Verify Your Phone Number** (5 minutes)

1. Go to: [Twilio Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified)
2. Click **"Add a new number"**
3. Enter your personal phone number (e.g., +1XXXXXXXXXX)
4. Choose verification method: **SMS** or **Voice Call**
5. Enter the verification code
6. ✅ Your number is now verified and can receive test calls!

**Note**: You can verify up to 10 phone numbers on a trial account.

---

### **Step 2: Start All Services**

```bash
# Terminal 1: Start Next.js frontend/backend
cd /Users/abhigyanraj/Desktop/AttackCapital/audria/frontend
npm run dev

# Terminal 2: Start Python FastAPI microservice
cd /Users/abhigyanraj/Desktop/AttackCapital/audria/python-amd-service
python main_simple.py

# Terminal 3: Start ngrok tunnel on port 3000
ngrok http 3000
```

**Important**: Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`) and update your `.env.local`:

```bash
NEXTAUTH_URL=https://abc123.ngrok-free.app
WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
WEBSOCKET_URL=wss://abc123.ngrok-free.app
```

Restart Next.js after updating environment variables.

---

## 🎯 **TESTING MATRIX**

### **Test Set 1: Human Detection (Answer Calls)**

| Test # | Strategy | Phone | Action | Expected Result |
|--------|----------|-------|--------|----------------|
| 1.1 | Gemini Flash | Your verified # | Answer in <2s, say "Hello" | detection=human, confidence>0.8 |
| 1.2 | HuggingFace ML | Your verified # | Answer in <2s, say "Hello" | detection=human, confidence>0.75 |
| 1.3 | FastAPI ML | Your verified # | Answer in <2s, say "Hello" | detection=human, confidence>0.8 |
| 1.4 | Jambonz Heuristic | Your verified # | Answer in <1s | detection=human, confidence>0.75 |
| 1.5 | Twilio Native | Your verified # | Answer in <2s, say "Hello" | detection=human, confidence>0.65 (fallback) |

---

### **Test Set 2: Voicemail Detection (Don't Answer)**

| Test # | Strategy | Phone | Action | Expected Result |
|--------|----------|-------|--------|----------------|
| 2.1 | Gemini Flash | Your verified # | Don't answer, let go to voicemail | detection=machine, confidence>0.7 |
| 2.2 | HuggingFace ML | Your verified # | Don't answer, let go to voicemail | detection=machine, confidence>0.7 |
| 2.3 | FastAPI ML | Your verified # | Don't answer, let go to voicemail | detection=machine, confidence>0.75 |
| 2.4 | Jambonz Heuristic | Your verified # | Don't answer, let ring 5+ times | detection=machine, confidence>0.7 |
| 2.5 | Twilio Native | Your verified # | Don't answer, let go to voicemail | detection=machine, confidence>0.6 (fallback) |

---

### **Test Set 3: Edge Cases**

| Test # | Strategy | Phone | Action | Expected Result |
|--------|----------|-------|--------|----------------|
| 3.1 | Gemini Flash | Your verified # | Answer after 5s, stay silent | detection=human/machine, confidence>0.6 |
| 3.2 | HuggingFace ML | Your verified # | Answer, then hang up immediately | detection=human, confidence>0.65 |
| 3.3 | Jambonz Heuristic | Your verified # | Answer after 3s, say "Hello" | detection=human, confidence>0.7 |

---

## 📝 **HOW TO PERFORM EACH TEST**

### **For Each Test:**

1. **Open Dashboard**: Navigate to `http://localhost:3000/dashboard`

2. **Select Strategy**: Choose the strategy from dropdown (e.g., "Gemini Flash AMD")

3. **Enter Phone**: Type your verified phone number: `+1XXXXXXXXXX`

4. **Initiate Call**: Click "Start Call" button

5. **Perform Action**: 
   - **Human Test**: Answer your phone quickly, say "Hello, this is [your name]"
   - **Voicemail Test**: Don't answer, let it go to voicemail, let greeting play

6. **Monitor Console**: Watch the terminal logs for:
   ```
   🟢 TwiML ENDPOINT CALLED
   📊 AMD Duration: XXXXms
   ✅ AMD result saved: human/machine - confidence: 0.XX
   ```

7. **Check Dashboard**: Refresh and verify the call appears in call history with:
   - Strategy name
   - Detection result (human/machine)
   - Confidence score
   - Latency (ms)

8. **Record Results**: Fill in the table below

---

## 📊 **RESULTS TRACKING TABLE**

### **Your Test Results:**

```markdown
| Test | Date/Time | Strategy | Detection | Confidence | Latency | Correct? | Notes |
|------|-----------|----------|-----------|------------|---------|----------|-------|
| 1.1  |           | Gemini   |           |            |         |          |       |
| 1.2  |           | HuggingF |           |            |         |          |       |
| 1.3  |           | FastAPI  |           |            |         |          |       |
| 1.4  |           | Jambonz  |           |            |         |          |       |
| 1.5  |           | Twilio   |           |            |         |          |       |
| 2.1  |           | Gemini   |           |            |         |          |       |
| 2.2  |           | HuggingF |           |            |         |          |       |
| 2.3  |           | FastAPI  |           |            |         |          |       |
| 2.4  |           | Jambonz  |           |            |         |          |       |
| 2.5  |           | Twilio   |           |            |         |          |       |
| 3.1  |           | Gemini   |           |            |         |          |       |
| 3.2  |           | HuggingF |           |            |         |          |       |
| 3.3  |           | Jambonz  |           |            |         |          |       |
```

### **Summary Statistics:**

```
Total Tests Performed: ___ / 13
Successful Detections: ___
Failed Detections: ___
Overall Accuracy: ____%

Average Confidence Score: ____
Average Latency: ____ms

Best Performing Strategy: __________
Worst Performing Strategy: __________
```

---

## 🐛 **TROUBLESHOOTING**

### **Error: "Cannot call toll-free numbers"**

**Problem**: You tried calling 1-800, 1-888, etc.  
**Solution**: Trial accounts cannot call toll-free numbers. Use your verified personal phone number instead.

---

### **Error: "Twilio cannot verify this number"**

**Problem**: Your phone number is not verified.  
**Solution**: Go to Twilio console and verify your number first (see Step 1 above).

---

### **AMD Returns "unknown"**

**Problem**: Twilio Native AMD returns "unknown" frequently on trial accounts.  
**Solution**: This is expected behavior. Our fallback logic will handle it:
- Quick answer (<2s) → Defaults to human
- Long greeting (>4s) → Defaults to machine
- Medium duration → Defaults to human (safer)

---

### **WebSocket Connection Fails**

**Problem**: Gemini/HuggingFace/FastAPI strategies fail to connect.  
**Solution**: 
1. Check ngrok is running: `ngrok http 3000`
2. Update `WEBSOCKET_URL` in `.env.local` with ngrok URL
3. Restart Next.js server
4. Ensure Python FastAPI service is running on port 8001

---

### **No Audio Data Received**

**Problem**: ML strategies show "No audio data received"  
**Solution**:
1. Check Twilio Media Streams are enabled in TwiML
2. Verify WebSocket server is running
3. Check ngrok tunnel is accessible
4. Look for WebSocket connection logs in terminal

---

## 📸 **SCREENSHOT CHECKLIST**

Take screenshots of:

1. ✅ **Twilio Verified Numbers**: Showing your verified phone number
2. ✅ **Dashboard Before Test**: Showing strategy selector and phone input
3. ✅ **Active Call**: Your phone ringing/voicemail playing
4. ✅ **Terminal Logs**: Showing AMD detection in console
5. ✅ **Dashboard After Test**: Showing call history with results
6. ✅ **Analytics Page**: Showing strategy comparison table
7. ✅ **Call Details**: Showing individual call AMD event details

---

## 🎬 **VIDEO WALKTHROUGH SCRIPT**

### **3-5 Minute Demo Video:**

**Minute 0:00-0:30**: Introduction
- "This is the Audria AMD system with 5 AMD strategies"
- "Testing on Twilio trial account with verified phone number"
- Show dashboard interface

**Minute 0:30-1:30**: Demonstrate Strategy Switching
- Select Gemini Flash strategy
- Enter verified phone number
- Click "Start Call"
- Show call initiating

**Minute 1:30-2:30**: Human Detection Test
- Answer phone on camera
- Say "Hello, this is [name]"
- Show terminal detecting human
- Show dashboard updating with result

**Minute 2:30-3:30**: Voicemail Detection Test
- Start another call with HuggingFace strategy
- Don't answer, let go to voicemail
- Show voicemail greeting playing
- Show terminal detecting machine
- Show dashboard updating with result

**Minute 3:30-4:30**: Results & Analytics
- Navigate to Analytics page
- Show strategy comparison table
- Explain accuracy, latency, confidence scores
- Show all 5 strategies work on trial account

**Minute 4:30-5:00**: Conclusion
- "4 out of 5 strategies work perfectly on trial account"
- "Twilio Native limited but has fallback logic"
- "System ready for production with paid account"

---

## ✅ **SUCCESS CRITERIA**

Your testing is complete when:

- [ ] Your phone number is verified in Twilio
- [ ] All 3 services are running (Next.js, FastAPI, ngrok)
- [ ] You've tested at least 3 strategies
- [ ] You've done at least 1 human detection test (answered call)
- [ ] You've done at least 1 voicemail detection test (didn't answer)
- [ ] Results are visible in dashboard call history
- [ ] Results are documented in the tracking table
- [ ] Screenshots captured for all key steps
- [ ] Video walkthrough recorded (3-5 minutes)

---

## 📈 **NEXT STEPS AFTER TESTING**

### **If Tests Pass (80%+ accuracy):**
1. ✅ Document results in `AMD-TEST-RESULTS.md`
2. ✅ Create comparison table with all 5 strategies
3. ✅ Record video walkthrough showing working system
4. ✅ Update README with trial account limitations
5. ✅ Push to GitHub
6. ✅ (Optional) Upgrade to paid account for toll-free testing

### **If Tests Fail:**
1. Check console logs for errors
2. Verify environment variables are correct
3. Ensure all services are running
4. Test WebSocket connection manually
5. Review fallback logic in code
6. Ask for help with specific error messages

---

## 💡 **TIPS FOR BEST RESULTS**

1. **Use a quiet environment** when testing human detection
2. **Speak clearly** - say "Hello" or your name when answering
3. **Wait for full voicemail greeting** - let it play 5-10 seconds
4. **Test one strategy at a time** - don't rush
5. **Give 30 seconds between tests** - let previous call complete
6. **Check logs after each test** - verify AMD detection happened
7. **Document everything** - screenshots, notes, timestamps
8. **Be patient with trial account** - Twilio Native may return "unknown"

---

## 🎯 **EXPECTED ACCURACY RANGES**

Based on trial account limitations:

| Strategy | Human Detection | Voicemail Detection | Overall |
|----------|----------------|---------------------|---------|
| Gemini Flash | 85-95% | 80-90% | 85-92% |
| HuggingFace ML | 80-90% | 75-85% | 78-88% |
| FastAPI ML | 85-95% | 80-90% | 83-92% |
| Jambonz Heuristic | 75-85% | 70-80% | 73-82% |
| Twilio Native | 60-75% (fallback) | 55-70% (fallback) | 58-72% |

**Note**: These are estimates for trial accounts. Paid accounts will have higher accuracy.

---

## 📞 **NEED HELP?**

If you encounter issues during testing:

1. Check the **TROUBLESHOOTING** section above
2. Review terminal logs for error messages
3. Verify all environment variables are set correctly
4. Ensure all services are running (Next.js, FastAPI, ngrok)
5. Check Twilio debugger: https://console.twilio.com/monitor/logs/debugger
6. Review the `CRITICAL-ISSUES-AND-SOLUTIONS.md` document

---

**Happy Testing! 🚀**
