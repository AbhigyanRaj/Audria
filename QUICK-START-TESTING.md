# 🚀 QUICK START - TEST AMD SYSTEM NOW

**Time to Complete**: 15 minutes  
**Status**: ALL FIXES APPLIED - READY TO TEST

---

## ⚡ **FASTEST PATH TO WORKING SYSTEM**

### **Step 1: Verify Your Phone** (2 minutes)

Go here: https://console.twilio.com/us1/develop/phone-numbers/manage/verified

1. Click "Add a new number"
2. Enter: `+1XXXXXXXXXX` (your mobile)
3. Get verification code via SMS
4. ✅ Done!

---

### **Step 2: Start Services** (3 minutes)

Open 3 terminals:

```bash
# Terminal 1 - Next.js
cd /Users/abhigyanraj/Desktop/AttackCapital/audria/frontend
npm run dev

# Terminal 2 - FastAPI
cd /Users/abhigyanraj/Desktop/AttackCapital/audria/python-amd-service
python main_simple.py

# Terminal 3 - ngrok
ngrok http 3000
```

**Copy the ngrok URL** (e.g., `https://abc123.ngrok-free.app`)

---

### **Step 3: Update Environment** (1 minute)

Edit: `/frontend/.env.local`

```bash
NEXTAUTH_URL=https://abc123.ngrok-free.app
WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
WEBSOCKET_URL=wss://abc123.ngrok-free.app
```

Restart Terminal 1 (Next.js)

---

### **Step 4: First Test - Human Detection** (3 minutes)

1. Open: http://localhost:3000/dashboard
2. Select: **Gemini Flash 2.5**
3. Enter: **Your verified phone number**
4. Click: **Start Call**
5. **Answer phone quickly**
6. Say: **"Hello, this is [your name]"**

**Watch terminal - you should see:**
```
🟢 TwiML ENDPOINT CALLED
✅ AMD result saved: human - confidence: 0.9+
```

**Check dashboard - should show:**
- Detection: human
- Confidence: 0.85-0.95
- Status: completed

✅ **SUCCESS!** Your system works!

---

### **Step 5: Second Test - Voicemail Detection** (3 minutes)

1. Same dashboard
2. Select: **HuggingFace ML** or **FastAPI ML**
3. Enter: **Your verified phone number**
4. Click: **Start Call**
5. **Don't answer** - let it ring
6. **Let voicemail play** for 5-10 seconds

**Watch terminal - you should see:**
```
📊 WebSocket connected
🎤 Audio data received
✅ AMD result: machine - confidence: 0.8+
```

**Check dashboard - should show:**
- Detection: machine
- Confidence: 0.75-0.90
- Status: completed

✅ **SUCCESS!** Voicemail detection works!

---

## 🎯 **WHAT TO TEST**

### **Minimum Testing (15 min):**
- ✅ 1 human detection test (answer call)
- ✅ 1 voicemail detection test (don't answer)
- ✅ 2 different strategies

### **Complete Testing (60 min):**
- ✅ All 5 strategies tested
- ✅ 3 human tests (different behaviors)
- ✅ 3 voicemail tests (different timings)
- ✅ Results documented

---

## ❌ **COMMON MISTAKES**

### **Mistake 1: Trying to call toll-free numbers**
❌ `+18007742678` (Costco)  
❌ `+18882211161` (PayPal)

**Fix**: Use your verified personal phone number!

### **Mistake 2: Forgetting to update .env.local**
**Fix**: Copy ngrok URL to all 3 variables, restart Next.js

### **Mistake 3: Not verifying phone first**
**Fix**: Verify at https://console.twilio.com/phone-numbers/verified

### **Mistake 4: Not restarting Next.js after .env change**
**Fix**: Kill Terminal 1 (Ctrl+C) and run `npm run dev` again

---

## ✅ **YOU'RE DONE WHEN...**

- [ ] Your phone receives test calls from Twilio
- [ ] Terminal shows AMD detection logs
- [ ] Dashboard shows call results
- [ ] At least 2 tests completed (1 human, 1 machine)
- [ ] Screenshots captured
- [ ] Results documented

---

## 📊 **RESULTS TABLE**

Fill this out after each test:

```
Test 1 - Human Detection:
Strategy: Gemini Flash
Result: human / machine / unknown
Confidence: ___
Correct?: YES / NO

Test 2 - Voicemail Detection:
Strategy: HuggingFace ML
Result: human / machine / unknown
Confidence: ___
Correct?: YES / NO
```

---

## 🎬 **RECORD VIDEO** (5 min)

Show on screen:
1. Dashboard with phone number input
2. Starting a call
3. Answering phone / showing voicemail
4. Terminal logs
5. Dashboard results

---

## 🐛 **TROUBLESHOOTING**

**"Cannot call this number"**
→ Verify your number first

**"AMD returns unknown"**
→ Normal on trial! Fallback logic handles it

**"WebSocket fails"**
→ Check ngrok is running, update .env.local

**"No logs in terminal"**
→ Check ngrok URL is correct in .env.local

---

## 📞 **TEST NUMBERS**

✅ **Your verified personal number** - USE THIS!  
❌ **Toll-free numbers (1-800, 1-888)** - DON'T USE (blocked on trial)

---

## ⏱️ **TIMELINE**

- **Now**: Verify phone (2 min)
- **+2 min**: Start services (3 min)
- **+5 min**: Update .env.local (1 min)
- **+6 min**: First test - human (3 min)
- **+9 min**: Second test - voicemail (3 min)
- **+12 min**: Document results (2 min)
- **+14 min**: Take screenshots (1 min)

**Total: 15 minutes to working system! 🎉**

---

## 🚀 **GO!**

Start now with Step 1: Verify your phone number!

Everything else is ready. All code fixes are applied. Just test and document! 💪
