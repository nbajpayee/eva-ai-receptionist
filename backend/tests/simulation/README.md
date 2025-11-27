# Synthetic Conversation Testing

**Purpose**: Simulate realistic customer conversations using LLM-based personas to validate Eva's behavior across all MECE intent buckets.

## Quick Start

### 1. Setup Environment

```bash
# Ensure OPENAI_API_KEY is set
export OPENAI_API_KEY="sk-..."

# Or add to your .env file
echo "OPENAI_API_KEY=sk-..." >> ../../.env
```

### 2. Run Simulations

```bash
cd backend

# Run all 7 persona simulations
pytest tests/simulation/test_synthetic_conversations.py -v -s -m simulation

# Run specific persona only
pytest tests/simulation/test_synthetic_conversations.py::TestSyntheticConversations::test_persona_conversation[planner_priya] -v -s -m simulation

# Test infrastructure without running full simulations
pytest tests/simulation/test_synthetic_conversations.py::test_simulation_infrastructure -v
```

### 3. Review Results

```bash
# Results saved to timestamped directory
ls tests/simulation_results/

# View specific conversation
cat tests/simulation_results/20251126_143022/planner_priya.json | jq '.'

# Read full transcript
cat tests/simulation_results/20251126_143022/planner_priya.json | jq '.transcript[]'
```

## The 7 MECE Personas

Each persona maps to one MECE intent bucket:

| Persona ID | Name | Bucket | Goal |
|------------|------|--------|------|
| `info_seeker_ivy` | Ivy | Information-Seeking | Ask about services/pricing before deciding |
| `planner_priya` | Priya | Appointment Booking | Book Botox/filler with specific timing |
| `juggler_jordan` | Jordan | Appointment Management | Reschedule/cancel/confirm existing bookings |
| `member_morgan` | Morgan | Operational/Account | Update profile or check membership balance |
| `curious_casey` | Casey | Sales/Conversion | Get treatment recommendations |
| `aftercare_alex` | Alex | Post-Appointment | Ask about aftercare/complications |
| `organizer_olivia` | Olivia | Administrative | Handle gift cards/feedback |

## Output Format

Each simulation creates a JSON file with:

```json
{
  "persona_id": "planner_priya",
  "persona_name": "Priya (Decisive Planner)",
  "persona_goal": "Book a Botox appointment...",
  "bucket": "appointment_booking",
  "timestamp": "2025-11-26T14:30:22",
  "transcript": [
    {
      "role": "customer",
      "content": "I'd like to book Botox tomorrow afternoon"
    },
    {
      "role": "assistant",
      "content": "Great! I have afternoon slots at 2 PM, 3 PM..."
    },
    ...
  ],
  "stats": {
    "total_messages": 8,
    "customer_messages": 4,
    "eva_messages": 4,
    "completed_naturally": true
  },
  "review_notes": {
    "manual_review_required": true,
    "check_for": {
      "specific_time_offers": true,
      "no_post_booking_recheck": true
    }
  }
}
```

## Manual Review Checklist

When reviewing transcripts, check:

### For All Personas:
- ✅ Natural, warm tone (not robotic)
- ✅ No backtracking ("3 PM is available" → "3 PM is booked")
- ✅ Appropriate responses to customer's goal
- ✅ No hallucinated information

### Persona-Specific:

**info_seeker_ivy**:
- ✅ Didn't push booking when customer is "just researching"
- ✅ Answered questions clearly
- ✅ Low-pressure tone

**planner_priya**:
- ✅ Booking completed successfully
- ✅ Handled fuzzy time windows correctly ("next week" → asked which day)
- ✅ No re-checking availability after booking

**juggler_jordan**:
- ✅ Clarified which appointment when customer said "my appointment"
- ✅ Mentioned cancellation policy if relevant
- ✅ Didn't create new booking when customer wanted to reschedule

**member_morgan**:
- ✅ Handled profile update without pushing booking
- ✅ Didn't guess membership balance (escalated to human if unavailable)

**curious_casey**:
- ✅ Gave recommendations without medical diagnosis
- ✅ Positioned consultation appropriately
- ✅ No pushy upselling

**aftercare_alex**:
- ✅ Provided safe, generic aftercare tips
- ✅ Escalated serious symptoms to clinic
- ✅ Didn't dismiss or diagnose medical concerns

**organizer_olivia**:
- ✅ Handled gift card inquiry clearly
- ✅ Showed empathy for complaints
- ✅ Offered to escalate to manager

## Cost Estimates

**Per simulation run (1 persona × 10 turns)**:
- Customer simulation: ~2,000 tokens (input + output)
- Eva responses: Your normal costs
- Total per persona: ~$0.03-0.06

**Full 7-persona run**: ~$0.20-0.40

## When to Run Simulations

### ✅ Run Before:
- Deploying major prompt changes
- Implementing GPT-5's Priority 1-5 improvements
- Releasing new features (multi-service booking, etc.)

### ✅ Run After:
- Fixing critical bugs (Liam 3 PM bug, etc.)
- Changing deterministic orchestration logic
- Updating `SYSTEM_PROMPT` or channel guidance

### ❌ Don't Run:
- In CI/CD pipeline (too slow, costs money)
- For every minor code change
- Without reviewing previous results first

## Limitations

**Current v1**:
- ❌ No automated quality scoring (manual review required)
- ❌ Mocked calendar service (not testing actual Google Calendar)
- ❌ SMS channel only (voice simulations pending)
- ❌ No multi-turn goal tracking (can't simulate "I changed my mind")

**Future improvements**:
- Add ConversationJudge for automated scoring
- Test voice channel via Realtime API
- Add failure scenarios (customer gets frustrated, etc.)
- Track whether persona's goal was achieved

## Troubleshooting

### "OPENAI_API_KEY not set"
```bash
export OPENAI_API_KEY="sk-..."
# Or add to .env file
```

### "Simulation tests skipped"
This is normal - simulations are opt-in only.

Run with:
```bash
pytest -m simulation
```

### "Customer responses are too generic"
Increase temperature in `llm_wrapper.py`:
```python
create_openai_simulator_callable(temperature=0.9)  # More varied
```

### Conversation loops/doesn't end
- Check if ending phrases are being detected
- Review `_conversation_ended()` logic
- May need to add more ending phrases

## Next Steps

1. **Run initial baseline**: Test all 7 personas with current prompts
2. **Review transcripts**: Manual quality check
3. **Implement GPT-5's improvements**: Priority 1-5 prompt changes
4. **Re-run simulations**: Compare before/after transcripts
5. **Document improvements**: Track which changes helped which personas
