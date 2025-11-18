# Availability Response Fix

**Date**: November 17, 2025
**Issue**: AI was ignoring `availability_summary` and `all_slots` fields, incorrectly telling users "4pm is not available" when it actually was.

---

## Problem Summary

### What Was Happening

**User Request**: "book me a botox appt for 4pm tomorrow"

**AI Response**:
```
We do have Botox appointments tomorrow, but 4 PM is not available.
Here are some options:
1. 9:00 AM
2. 9:30 AM
3. 10:00 AM
```

### The Bug

The `handle_check_availability` tool was returning:
- ✅ `availability_summary`: "We have availability from 9 AM to 7 PM"
- ✅ `suggested_slots`: [9:00 AM, 2:00 PM]
- ✅ `all_slots`: 20 slots including 4:00 PM (slot #15)

But the AI was:
1. ❌ Ignoring `availability_summary` (not mentioning full range)
2. ❌ Not checking `all_slots` for the requested time
3. ❌ Only presenting first 3 slots from `available_slots` (limited view)
4. ❌ Incorrectly claiming 4pm was unavailable

### Root Cause

**No prompt guidance** on how to use the new availability window fields added by GPT-5 in the previous implementation.

---

## Solution

### Changes Made

Updated `backend/prompts.py` to add explicit instructions for all three channels (voice, SMS, email):

#### SMS Channel (lines 71-87)
```
Using check_availability Results:
- The tool returns: `availability_summary`, `suggested_slots`, and `all_slots`
- ALWAYS lead with `availability_summary` to show the full range
- If guest requested a SPECIFIC time (e.g., "4pm", "2:30pm"):
  * Search `all_slots` to check if that exact time exists
  * If FOUND: "Great! [time] is available. Would you like to book it?"
  * If NOT FOUND: "[availability_summary], but [requested time] is booked.
                   I have [nearby time]. Would that work?"
- If guest did NOT request specific time:
  * Offer the times from `suggested_slots` (usually 2 options spanning the day)
- NEVER say a time is unavailable without first checking `all_slots`
  and mentioning `availability_summary`

Example Response for "book me at 4pm tomorrow":
If 4pm exists: "We have availability from 9 AM to 7 PM tomorrow.
                4 PM works! Would you like to book it?"
If 4pm missing: "We have availability from 9 AM to 7 PM tomorrow, but 4 PM
                 specifically is booked. I have 3:30 PM or 4:30 PM available.
                 Would either work?"
```

#### Voice Channel (lines 39-46)
```
Using check_availability Results:
- The tool returns: `availability_summary`, `suggested_slots`, and `all_slots`
- ALWAYS start by mentioning `availability_summary`
- If caller requested SPECIFIC time: Search `all_slots` to verify it exists
  * If found: "Perfect! [time] is available. Shall I book that for you?"
  * If not found: "We're open from [summary], but [requested time] is taken.
                   I have [nearby times]. Would one of those work?"
- If no specific time requested: Offer 2-3 times from `suggested_slots`
- NEVER say a time is unavailable without checking `all_slots`
  and stating the full range first
```

#### Email Channel (lines 154-161)
Similar guidance adapted for email's more verbose style.

---

## Expected Behavior After Fix

### Test Case 1: Specific Time Request (Available)
**User**: "book me a botox appt for 4pm tomorrow"

**Expected AI Response**:
```
We have availability from 9 AM to 7 PM tomorrow.
4 PM works! Would you like to book it?
```

### Test Case 2: Specific Time Request (Unavailable)
**User**: "book me at 8pm tomorrow"

**Expected AI Response**:
```
We have availability from 9 AM to 7 PM tomorrow, but 8 PM
is after our closing time. Our latest slot is 6:30 PM.
Would that work, or would you prefer an earlier time?
```

### Test Case 3: General Request (No Specific Time)
**User**: "book me a botox appointment tomorrow"

**Expected AI Response**:
```
We have availability from 9 AM to 7 PM tomorrow.
I have 9:00 AM or 2:00 PM available. What time works best for you?
```

---

## Technical Details

### Tool Response Structure
```json
{
  "success": true,
  "availability_summary": "We have availability from 9 AM to 7 PM.",
  "availability_windows": [
    {"label": "9 AM-7 PM", "start": "...", "end": "..."}
  ],
  "suggested_slots": [
    {"start_time": "09:00 AM", "start": "2025-11-18T09:00:00-05:00"},
    {"start_time": "02:00 PM", "start": "2025-11-18T14:00:00-05:00"}
  ],
  "available_slots": [...first 10 slots...],
  "all_slots": [...all 20 slots including 4pm...],
  "date": "2025-11-18",
  "service": "Botox"
}
```

### AI's Required Logic Flow
1. Parse user request for specific time
2. Call `check_availability` tool
3. **Check `all_slots`** for requested time
4. **Mention `availability_summary`** in response
5. If time found: confirm availability
6. If time not found: explain with full context + alternatives
7. If no specific time: offer `suggested_slots`

---

## Validation

### Manual Test Required
1. Start new SMS conversation
2. Send: "book me a botox appt for 4pm tomorrow"
3. Verify response includes:
   - ✅ "We have availability from 9 AM to 7 PM"
   - ✅ "4 PM works" or "4 PM is available"
   - ✅ Offer to book the 4pm slot

### Expected Outcome
- ✅ No more "4pm is not available" when it actually is
- ✅ AI always mentions full availability range
- ✅ AI checks all slots before claiming unavailability
- ✅ Better UX: users see abundance, not artificial scarcity

---

## Related Work

This fix completes the availability window feature implemented by GPT-5:
- ✅ Backend: Window-building logic (`booking_handlers.py`)
- ✅ Backend: Full-day validation (`handle_book_appointment`)
- ✅ Backend: Smart slot suggestions (`_suggested_slots`)
- ✅ Tests: 3 passing tests for window logic
- ✅ **Prompts**: Instructions for AI to use new fields (this fix)

---

## Files Changed

- `backend/prompts.py`: Added tool response guidance for voice, SMS, email

---

## Status

✅ **COMPLETE** - Ready for testing

Test with: "book me a botox appt for 4pm tomorrow"
