# Testing Smart Commits - Comparison Guide

## Overview

This guide helps you test **GPT-5's smart commit strategy** implemented in the voice interface:
- **Voice Interface**: `admin-dashboard/src/hooks/useVoiceSession.ts` and `admin-dashboard/src/app/voice/page.tsx`

## GPT-5's Smart Commit Strategy

### Key Features

1. **Dual-Speed Commits**:
   - **Normal delay (300ms)**: Scheduled after streaming each audio chunk
   - **Fast delay (120ms)**: Triggered when client-side VAD detects user stopped speaking

2. **Client-Side VAD**:
   - Calculates RMS (Root Mean Square) of audio buffer
   - Threshold: 0.005 (configurable)
   - Detects when user starts/stops speaking

3. **Force Commits**:
   - Before closing WebSocket connection
   - Before ending session
   - Ensures trailing speech isn't lost

### How It Works

```
User speaks:
  → Client VAD detects speech start
  → Stream audio chunks to backend
  → Each chunk schedules commit in 300ms
  → If new chunk arrives, reset timer to 300ms

User stops speaking:
  → Client VAD detects silence (RMS < threshold)
  → Schedule fast commit in 120ms
  → Commit is sent to backend
  → Backend calls OpenAI commit_audio_buffer()

Session ends:
  → Force commit (bypass delay)
  → Send end_session message
  → Close connection
```

## Prerequisites

### 1. Backend Running
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Verify backend has commit handler** (lines 186-188 in main.py):
```python
elif msg_type == "commit":
    print("📱 Client requested audio buffer commit")
    await realtime_client.commit_audio_buffer()
```

### 2. Frontend Setup

**Admin Dashboard Voice Interface:**
```bash
cd admin-dashboard
npm install
npm run dev  # Runs on http://localhost:3000
```

## Testing Instructions

### Test 1: Admin Dashboard Voice Interface

#### Step 1: Open Voice Interface
```bash
# Navigate to admin dashboard
open http://localhost:3000/voice
```

#### Step 2: Start Call and Watch Console
1. Open Chrome DevTools (F12) → Console tab
2. Click "Start Call" button
3. Allow microphone access

#### Step 3: Test Speech Detection

**Say "Hello"** and watch for these logs:

**In Browser Console:**
```
🎤 User started speaking (VAD)
🔇 User stopped speaking (VAD), scheduling fast commit
📤 Sending commit to backend
```

**In Backend Console:**
```
🎙️  Sent audio chunk (base64 len=...)
📱 Received from client: commit
📱 Client requested audio buffer commit
✅ Committed audio buffer
🔔 Received OpenAI event: input_audio_buffer.committed     ← KEY EVENT!
🔔 Received OpenAI event: conversation.item.input_audio_transcription.completed
📝 User audio transcription completed: Hello
📝 Captured transcript entry [customer]: Hello
```

#### Step 4: Test Conversation
Have a short conversation:
1. "What services do you offer?"
2. Wait for Ava's response
3. "Tell me about Botox"
4. Click "End Call"

#### Step 5: Check Database
After ending call, check backend console for:
```
🔚 Finalizing session session_xxx
🧾 Transcript entries captured: [should be > 2]
🧾 Transcript preview: [
  {"speaker": "assistant", "text": "..."},
  {"speaker": "customer", "text": "What services do you offer?"},  ← Customer!
  {"speaker": "assistant", "text": "..."},
  {"speaker": "customer", "text": "Tell me about Botox"}           ← Customer!
]
```

---

### Test 2: Next.js Frontend (admin-dashboard)

#### Step 1: Navigate to Voice Page
```
http://localhost:3000/voice
```

#### Step 2: Open Console and Network Tab
- Chrome DevTools (F12)
- Console tab for logs
- Network tab → WS filter for WebSocket messages

#### Step 3: Start Call
1. Click "Start Call" button
2. Allow microphone access
3. Wait for "Connected" status

#### Step 4: Monitor Commits

**In Browser Console:**
```
🎤 User started speaking (VAD)
🔇 User stopped speaking (VAD), scheduling fast commit
📤 Sending commit to backend
```

**In Network Tab (WS messages):**
Look for outgoing messages:
```json
{"type": "audio", "data": "base64..."}
{"type": "commit"}  ← Should appear ~120ms after you stop speaking
```

#### Step 5: Test Speech Detection
Same as Test 1:
1. Say "Hello"
2. Wait for response
3. Say "What services do you offer?"
4. End call

#### Step 6: Check Backend Logs
Should be identical to Test 1 backend logs.

---

## What to Look For

### ✅ Success Indicators

#### 1. Client-Side VAD Working
**Browser Console:**
- `🎤 User started speaking (VAD)` when you speak
- `🔇 User stopped speaking (VAD)` when you pause
- `📤 Sending commit to backend` after stopping

#### 2. Backend Receiving Commits
**Backend Console:**
- `📱 Client requested audio buffer commit`
- `✅ Committed audio buffer`

#### 3. OpenAI Processing Commits
**Backend Console (CRITICAL):**
- `🔔 Received OpenAI event: input_audio_buffer.committed` ← **MUST SEE THIS!**
- `🔔 Received OpenAI event: conversation.item.input_audio_transcription.completed`
- `📝 User audio transcription completed: [your speech]`

#### 4. Database Has Both Speakers
**Backend Console:**
- Transcript preview shows BOTH `customer` and `assistant` entries

### ❌ Failure Indicators

#### 1. Commits Not Being Sent
**Browser Console Missing:**
- No `📤 Sending commit to backend` messages

**Possible causes:**
- Client-side VAD threshold too high (try lowering from 0.005 to 0.001)
- Microphone not working
- Audio processing loop not running

#### 2. Backend Not Processing Commits
**Backend Console Missing:**
- No `📱 Client requested audio buffer commit` messages

**Possible causes:**
- Backend commit handler not implemented (check main.py lines 186-188)
- WebSocket connection issue

#### 3. OpenAI Not Committing
**Backend Console Missing:**
- No `input_audio_buffer.committed` events

**Possible causes:**
- OpenAI API error (check for error events)
- Audio buffer empty (check `🎙️ Sent audio chunk` messages)
- Transcription disabled (check session.updated event)

#### 4. Transcription Not Captured
**Backend Console Shows:**
- `input_audio_buffer.committed` but no `transcription.completed`

**Possible causes:**
- Transcription model not configured (check `input_audio_transcription` in session config)
- Audio quality too low
- Silence instead of speech

---

## Troubleshooting

### Issue: Client VAD Too Sensitive
**Symptoms:**
- Constant `🎤 User started speaking` messages even when silent
- Background noise triggering VAD

**Solution:**
Increase VAD threshold in `admin-dashboard/src/hooks/useVoiceSession.ts`:

```typescript
const DEFAULT_VAD_THRESHOLD = 0.01;  // Increase from 0.005
```

### Issue: Client VAD Not Sensitive Enough
**Symptoms:**
- Never see `🎤 User started speaking` even when talking loudly
- No commits being sent

**Solution:**
Decrease VAD threshold:
```javascript
const VAD_THRESHOLD = 0.001;  // Decrease from 0.005
```

### Issue: Commits Too Slow
**Symptoms:**
- Long delay between stopping speech and seeing transcription

**Solution:**
Decrease fast commit delay in `admin-dashboard/src/hooks/useVoiceSession.ts`:

```typescript
const COMMIT_DELAY_FAST_MS = 80;  // Decrease from 120
```

### Issue: Speech Cut Off
**Symptoms:**
- End of your sentences missing from transcription
- "Hello world" becomes "Hello wor"

**Solution:**
Increase fast commit delay to give more buffer time:
```javascript
const COMMIT_DELAY_FAST_MS = 200;  // Increase from 120
```

---

## Comparison: Before vs After

### Before (Round 5 - No Commits)
```
✗ User speaks
✗ Audio streamed to OpenAI
✗ OpenAI never commits buffer
✗ No transcription generated
✗ Only assistant speech in database
```

### After (GPT-5's Smart Commits)
```
✓ User speaks
✓ Client VAD detects speech
✓ Audio streamed to OpenAI
✓ Client VAD detects silence
✓ Fast commit (120ms) sent to backend
✓ Backend calls OpenAI commit_audio_buffer()
✓ OpenAI commits buffer
✓ Transcription generated
✓ Both customer and assistant speech in database
```

---

## Data to Collect

When testing, please collect:

### 1. Browser Console Logs
- Copy all logs from call start to call end
- Look for VAD start/stop messages
- Look for commit messages

### 2. Backend Console Logs
- Copy all logs from call start to call end
- Focus on events between `input_audio_buffer.speech_stopped` and `transcription.completed`
- Look for `input_audio_buffer.committed` event

### 3. Transcript Preview
- Copy the transcript preview at end of call
- Verify both speakers present

### 4. Timing Information
- Time from "stopped speaking" to "commit sent"
- Time from "commit sent" to "transcription completed"

---

## Expected Timeline

For a typical "Hello" utterance:

```
T+0ms:     User says "Hello"
T+10ms:    Client VAD detects speech → 🎤 User started speaking
T+10-500ms: Audio chunks streamed, commits scheduled at 300ms
T+500ms:   User stops speaking
T+510ms:   Client VAD detects silence → 🔇 User stopped speaking
T+630ms:   Fast commit sent (120ms delay) → 📤 Sending commit
T+640ms:   Backend receives commit → 📱 Client requested audio buffer commit
T+650ms:   Backend calls OpenAI → ✅ Committed audio buffer
T+700ms:   OpenAI commits → input_audio_buffer.committed
T+1200ms:  Transcription complete → 📝 User audio transcription completed: Hello
```

**Key metric: ~1200ms from speech end to transcription**

---

## Next Steps

After testing both frontends:

1. **Document which approach works**:
   - Does client VAD + smart commits capture transcription?
   - Are commits reaching OpenAI?
   - Is transcription being generated?

2. **Compare timing**:
   - How long from speech end to transcription?
   - Is 120ms fast commit optimal or should it be faster/slower?

3. **Tune VAD threshold**:
   - Test in different environments (quiet, noisy)
   - Find optimal threshold that doesn't false trigger but catches real speech

4. **Update documentation**:
   - Document the working approach
   - Update TODO.md with results
   - Update CLAUDE.md with final architecture decision
