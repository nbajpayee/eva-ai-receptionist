# Testing Voice Calls - Troubleshooting Guide

## Recent Fixes Applied (Nov 8, 2025)

### Issues Fixed:
1. **CRITICAL ARCHITECTURAL FIX (Round 5)** - Removed manual commit workflow that was preventing transcription
   - Frontend no longer sends manual "commit" messages
   - OpenAI's server-side VAD now handles all commits automatically
   - This was the root cause of user speech not appearing in transcripts
2. **VAD (Voice Activity Detection) optimization** - Adjusted to be less sensitive to background noise while remaining responsive to interruptions
3. **Transcript logging improvements** - Added comprehensive logging for both user and assistant speech
4. **Import fixes** - Fixed missing timedelta import in realtime_client.py
5. **Transcription model fix** - Changed from incorrect model name to proper "whisper-1"
6. **Configuration fixes** - Fixed voice, content types, and message types in OpenAI API calls

### Latest Changes (Round 5 - ARCHITECTURAL):

#### frontend/app.js:
- **REMOVED manual commit workflow**
  - Deleted `commitTimeout` and `COMMIT_DELAY_MS` variables
  - Deleted `scheduleCommit()` function
  - Deleted `sendCommit()` function
  - Frontend now only streams audio continuously
  - No manual commit messages sent to backend

#### backend/main.py:
- **No changes needed**
  - Backend never had a commit handler (manual commits were being ignored)
  - Correctly calls `send_audio(commit=False)` because server VAD handles commits

#### backend/realtime_client.py:
- **Server-side VAD configuration (already correct)**
  - `"type": "server_vad"` - OpenAI detects speech automatically
  - `"create_response": True` - Auto-generates response when user stops speaking
  - `"silence_duration_ms": 600` - Waits 600ms of silence before committing buffer
  - With these settings, OpenAI automatically commits and transcribes user speech

### Previous Changes (Rounds 1-4):

#### backend/realtime_client.py:
- Fixed import: Added `timedelta` to imports at top of file
- **Transcription Model Fixed**:
  - Changed from `gpt-4o-mini-transcribe` to `whisper-1` (correct model for Realtime API)
- **VAD Settings Further Optimized**:
  - `threshold: 0.6` (increased from 0.5) - Even less sensitive to background noise
  - `prefix_padding_ms: 300` - Captures more of speech start
  - `silence_duration_ms: 600` (increased from 500) - More forgiving for natural pauses
  - `create_response: True` - Auto-generate responses when user stops speaking
- **Comprehensive Event Logging**:
  - All events except audio deltas are now logged
  - Full event data logged for transcription-related events
  - Detailed logging in conversation.item processing
  - Text extraction logging shows exactly what's being captured
- **Enhanced User Speech Capture**:
  - Added handler for `conversation.item.input_audio_transcription.delta`
  - Improved handling of `conversation.item.input_audio_transcription.completed`
  - Better text extraction from conversation items
  - Multiple fallback pathways for capturing user speech

#### backend/main.py:
- Added handler for "commit" message type from frontend
- Backend now commits audio buffer when client requests it

## How to Test

### 1. Start Backend
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Watch the console for these key messages:
- `✓ Connected to OpenAI Realtime API`
- `✓ Session initialized`
- `🗣️  Sent greeting request to Realtime API`

### 2. Start Voice Interface
Open `frontend/index.html` in your browser (Chrome recommended)

### 3. Test Scenarios

#### Test 1: Basic Conversation
1. Click "Start Call"
2. Allow microphone access
3. Listen for Ava's greeting: "Hi, thanks for calling [Med Spa Name]. My name is Ava. How can I help you?"
4. Say: "What services do you offer?"
5. **Expected**: Ava should list services
6. **Check console**: Look for:
   - `📝 User speech completed: What services do you offer?`
   - `🤖 Assistant speech completed: [Ava's response]`

#### Test 2: Identity Check
1. During a call, say: "Who are you?"
2. **Expected**: Ava should respond: "I'm Ava, the virtual receptionist for [Med Spa Name]. I'm here to help with appointments or any questions about our treatments."
3. **NOT**: "I'm ChatGPT" or "I'm an AI assistant"

#### Test 3: Interruption Handling
1. Start a call
2. Let Ava start speaking
3. Interrupt her mid-sentence by speaking loudly
4. **Expected**: Ava should stop and listen to you
5. **Check console**: Should see your speech captured even though you interrupted

#### Test 4: Background Noise Resistance
1. Start a call in a room with some background noise (music, fan, etc.)
2. Don't speak immediately
3. **Expected**: Ava should NOT constantly interrupt herself thinking you're speaking
4. **NOT**: False triggers from background noise

#### Test 5: Appointment Booking
1. Say: "I'd like to book a Botox appointment"
2. **Expected**: Ava should ask for:
   - Your name
   - Phone number
   - Email
   - Preferred date/time
3. Provide information when asked
4. **Check**: Function call logged in console: `handle_function_call: book_appointment`

#### Test 6: End Call & Database Check
1. Click "Stop Call"
2. **Check backend console** for:
   - `🔚 Finalizing session [session_id]`
   - `🧾 Transcript entries captured: [number]`
   - `🧾 Transcript preview: [last 3 entries]`

### 4. Verify Database Transcript Logging

After ending a call, check Supabase:

```python
# Quick check script
python -c "
from backend.database import SessionLocal, CallSession
import json

db = SessionLocal()
# Get most recent call
call = db.query(CallSession).order_by(CallSession.id.desc()).first()
if call:
    print(f'Session ID: {call.session_id}')
    print(f'Duration: {call.duration_seconds}s')
    print(f'Satisfaction: {call.satisfaction_score}')
    transcript = json.loads(call.transcript) if call.transcript else []
    print(f'\nTranscript entries: {len(transcript)}')
    for entry in transcript:
        print(f'  [{entry[\"speaker\"]}]: {entry[\"text\"][:50]}...')
else:
    print('No calls found')
"
```

### 5. Common Issues & Solutions

#### Issue: No transcript entries captured
**Symptoms**:
- Console shows: `🧾 Transcript entries captured: 0`
- Database transcript field is empty or `[]`

**Solutions**:
1. Check that audio is being sent:
   - Look for `🎙️  Sent audio chunk` messages
   - Look for `📱 Client requested audio buffer commit`
2. Check OpenAI events:
   - Look for `Received OpenAI event: input_audio_buffer.transcription.completed`
   - Look for `Received OpenAI event: response.audio_transcript.done`
3. Restart backend to reload configuration

#### Issue: Assistant identifies as ChatGPT
**Symptoms**: When asked "Who are you?", responds with "I'm ChatGPT" or similar

**Solutions**:
1. Check `.env` file has:
   ```
   AI_ASSISTANT_NAME=Ava
   MED_SPA_NAME=[Your Med Spa Name]
   ```
2. Restart backend server (config is loaded at startup)
3. Clear browser cache and refresh
4. Start a new call session

#### Issue: Constant interruptions / false triggers
**Symptoms**:
- Ava keeps stopping mid-sentence
- Background noise triggers speech detection

**Solutions**:
1. Increase VAD threshold in `backend/realtime_client.py`:
   ```python
   "turn_detection": {
       "type": "server_vad",
       "threshold": 0.6,  # Try higher values: 0.6, 0.7
       ...
   }
   ```
2. Test in quieter environment
3. Move microphone away from noise sources

#### Issue: Can't interrupt Ava
**Symptoms**:
- Ava keeps talking even when you speak
- Have to wait for Ava to finish before speaking

**Solutions**:
1. Decrease VAD threshold in `backend/realtime_client.py`:
   ```python
   "turn_detection": {
       "type": "server_vad",
       "threshold": 0.4,  # Try lower values: 0.4, 0.3
       ...
   }
   ```
2. Speak louder/closer to microphone
3. Check microphone is working properly

#### Issue: WebSocket connection fails
**Symptoms**:
- Browser shows "Error" status
- Console shows connection errors

**Solutions**:
1. Verify backend is running on port 8000
2. Check `.env` has valid `OPENAI_API_KEY`
3. Check OpenAI API quota/billing
4. Check CORS settings in `main.py`

#### Issue: Satisfaction score not calculated
**Symptoms**:
- `satisfaction_score` field in database is NULL
- No GPT-4 analysis in logs

**Solutions**:
1. Check OpenAI API key has access to GPT-4
2. Check `analyze_call_sentiment` function in `analytics.py`
3. Look for errors in backend console during call finalization

## VAD Tuning Guide

The VAD (Voice Activity Detection) settings control when the system thinks you're speaking:

### Threshold (0.0 to 1.0)
- **Lower (0.3-0.4)**: More sensitive, better for interruptions, but may trigger on background noise
- **Medium (0.5-0.6)**: Balanced, good for most environments
- **Higher (0.7-0.8)**: Less sensitive, better for noisy environments, but harder to interrupt

### Silence Duration (milliseconds)
- **Shorter (300-400ms)**: More responsive, but may cut off if you pause
- **Medium (500-700ms)**: Good for natural speech with pauses
- **Longer (800-1000ms)**: Very forgiving of pauses, but slower to detect end of speech

### Prefix Padding (milliseconds)
- **Shorter (100-200ms)**: May miss start of words
- **Medium (300-400ms)**: Captures most speech starts
- **Longer (500+ms)**: Captures all speech but may include noise before speaking

**Recommended Starting Point** (currently set):
```python
"threshold": 0.6,
"prefix_padding_ms": 300,
"silence_duration_ms": 600
```

## What Changed After Round 5 Architectural Fix

**CRITICAL:** The manual commit workflow has been completely removed. This was the root cause of user speech not appearing in transcripts.

### How It Works Now

1. **Frontend streams audio continuously** - No manual commit messages
2. **OpenAI's server VAD detects speech** - Automatic silence detection
3. **OpenAI auto-commits after 600ms silence** - No manual intervention needed
4. **Transcription generated automatically** - With `create_response: True`
5. **Backend captures transcription** - Both customer and assistant speech

### Key Event to Watch For

After Round 5, you should now see this event when you stop speaking:

```
🔔 Received OpenAI event: input_audio_buffer.committed
```

This proves OpenAI is automatically committing the buffer! If you don't see this, something is wrong with the server VAD configuration.

### Expected Flow

```
You speak: "Hello"
  ↓
🔔 input_audio_buffer.speech_started
  ↓
(Frontend streams audio chunks continuously)
  ↓
You stop speaking (600ms silence detected by OpenAI)
  ↓
🔔 input_audio_buffer.speech_stopped
🔔 input_audio_buffer.committed                    ← NEW! Critical event
🔔 conversation.item.created (role: user)
🔔 conversation.item.input_audio_transcription.completed
📝 User audio transcription completed: Hello
📝 Captured transcript entry [customer]: Hello
  ↓
🔔 response.created
🔔 response.audio_transcript.delta
🤖 Assistant speech: (response text)
```

## Debugging User Speech Capture

With the enhanced logging, you can now diagnose exactly why user speech isn't being captured. Look for these event sequences:

### What You Should See When You Speak:

1. **Audio Buffer Events:**
```
🔔 Received OpenAI event: input_audio_buffer.speech_started
🔔 Received OpenAI event: input_audio_buffer.speech_stopped
```

2. **Transcription Events (ONE of these should appear):**

**Option A - Direct transcription:**
```
🔔 Received OpenAI event: input_audio_buffer.transcription.completed
📝 User speech completed: [your speech here]
```

**Option B - Conversation item with transcription:**
```
🔔 Received OpenAI event: conversation.item.created
🧩 Processing conversation.item.created - ID: item_xxx, Role: user, Speaker: customer
   📝 Extracted texts from content: ['your speech here']
🔔 Received OpenAI event: conversation.item.input_audio_transcription.completed
📝 User audio transcription completed (item item_xxx): your speech here
```

3. **Transcript Entry Captured:**
```
📝 Captured transcript entry [customer]: your speech here
```

### If User Speech Is NOT Captured:

Look for these warning signs in the logs:

**Missing transcription events:**
- You see `input_audio_buffer.speech_started` but NO `transcription.completed`
- You see `conversation.item.created` but role is NOT "user"
- You see `conversation.item.created` but NO texts extracted from content

**Empty content:**
```
⚠️ No texts extracted from content: [...]
```

**Item not finalized:**
```
📋 Finalizing pending item xxx: Speaker=customer, Text=EMPTY
⚠️ Skipping empty text for item xxx
```

**Check the event data:**
When you see a `conversation.item.created` event, look at the logged data to see if there's a transcript field in the content array.

## Monitoring Transcript Capture

During a call, watch for these console messages:

### Good Signs:
```
📝 User speech delta: Hello
📝 User speech completed: Hello, I'd like to book an appointment
🤖 Assistant speech delta: I'd be happy
🤖 Assistant speech completed: I'd be happy to help you book an appointment
📝 Captured transcript entry [customer]: Hello, I'd like to book an appointment
📝 Captured transcript entry [assistant]: I'd be happy to help you book an appointment
```

### Warning Signs:
```
⚠️  No audio data in delta
⚠️  Empty audio payload received
⚠️  WebSocket not ready
```

### At Call End:
```
🔚 Finalizing session session_123456
🧾 Transcript entries captured for session_123456: 12
🧾 Transcript preview: [{'speaker': 'customer', 'text': '...'}, ...]
```

## Next Steps

If you're still experiencing issues:
1. Check the backend logs carefully for error messages
2. Verify your `.env` file has all required variables
3. Test with a simple phrase like "Hello"
4. Try different browsers (Chrome works best)
5. Check your OpenAI API usage/quota
6. Verify Supabase connection string is correct

For detailed architecture and development information, see `CLAUDE.md`.
