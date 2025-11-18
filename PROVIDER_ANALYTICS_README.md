# Provider Analytics & Consultation Recording Feature

## Overview

A comprehensive provider analytics and AI-powered coaching system that records in-person consultations, transcribes conversations, and generates actionable insights to improve provider performance.

## Features Implemented

### 1. **Consultation Recording Page** (`/consultation`)
Record and transcribe in-person consultations with customers.

**Features:**
- 🎤 Voice recording with real-time timer
- 📝 Automatic transcription (OpenAI Whisper)
- 👥 Provider and customer selection
- 🏷️ Service type categorization
- 📊 Outcome tracking (Booked, Declined, Thinking, Follow-up Needed)
- 💬 Manual notes capture
- 🤖 Automatic AI analysis on completion

**How to Use:**
1. Navigate to `/consultation`
2. Select provider (required)
3. Optionally select customer and service type
4. Click microphone button to start recording
5. Conduct the consultation
6. Click stop button when finished
7. Select the outcome
8. Add any notes
9. Submit for AI analysis

---

### 2. **Provider List Page** (`/providers`)
Overview of all providers with performance metrics.

**Features:**
- 📊 Performance overview cards (conversion rate, revenue, consultations, satisfaction)
- 🏆 Top performer identification
- 📈 Visual performance indicators
- 🔄 Time period filtering (7/30/90 days)
- 🎯 Sort by conversion rate, revenue, or consultations
- 🏷️ "Above Average" vs "Coaching Opportunity" badges
- 🔗 Click-through to detailed provider view

**Key Metrics:**
- **Conversion Rate**: % of consultations that result in bookings
- **Total Revenue**: Generated from booked appointments
- **Total Consultations**: Number of consultations conducted
- **Avg Satisfaction**: AI-calculated satisfaction score (0-10)

---

### 3. **Provider Detail Page** (`/providers/[id]`)
Detailed analytics and AI insights for individual providers.

**Three Main Tabs:**

#### **AI Insights Tab** ⭐ (Most Important)
AI-powered coaching recommendations based on consultation analysis.

**Strengths Section:**
- What the provider does exceptionally well
- Supporting quotes from actual consultations
- Confidence scores (how often pattern appears)
- Mark as reviewed functionality

**Coaching Opportunities Section:**
- Areas for improvement
- Specific examples from conversations
- Actionable recommendations
- Comparison to top performers

**Example Insights:**
```
✅ STRENGTH: "Excellent rapport building"
"Provider consistently makes clients feel welcome and comfortable."
Quote: "Hi! Welcome to the spa. What brings you in today?"
Confidence: 90%

⚠️ OPPORTUNITY: "Improve objection handling for price concerns"
"When clients express price concerns, provider could better demonstrate
value instead of suggesting they 'think about it'."
💡 Recommendation: "Reinforce long-term value and results. Share success
stories from similar clients."
Confidence: 80%
```

#### **Analytics Tab**
Visual charts and data breakdowns:
- 📈 Conversion rate trend over time
- 🥧 Consultation outcomes pie chart
- 📊 Performance by service type
- 💰 Revenue trends

#### **Consultations Tab**
Recent consultation history with:
- Outcome badges (color-coded)
- AI summaries
- Duration, satisfaction score
- Service type
- Date

---

## Database Schema

### New Tables

#### `providers`
- `id` (UUID)
- `name`, `email`, `phone`
- `specialties` (array)
- `hire_date`, `avatar_url`, `bio`
- `is_active`

#### `in_person_consultations`
- `id` (UUID)
- `provider_id` (FK → providers)
- `customer_id` (FK → customers)
- `service_type`
- `duration_seconds`
- `recording_url`, `transcript`
- `outcome` (booked/declined/thinking/follow_up_needed)
- `satisfaction_score`, `sentiment`, `ai_summary`
- `notes`
- `created_at`, `ended_at`

#### `ai_insights`
- `id` (UUID)
- `insight_type` (strength/coaching_opportunity/comparison/best_practice)
- `provider_id` (FK → providers)
- `consultation_id` (FK → in_person_consultations)
- `title`, `insight_text`
- `supporting_quote`, `recommendation`
- `confidence_score` (0-1)
- `is_positive`
- `is_reviewed`

#### `provider_performance_metrics`
- `id` (UUID)
- `provider_id` (FK → providers)
- `period_start`, `period_end`, `period_type` (daily/weekly/monthly)
- `total_consultations`, `successful_bookings`, `conversion_rate`
- `total_revenue`
- `avg_consultation_duration_seconds`
- `avg_satisfaction_score`, `avg_nps_score`

---

## Backend Architecture

### Services

#### `consultation_service.py`
Handles consultation lifecycle:
- Create consultation sessions
- Upload audio recordings (local storage or S3/Supabase)
- Transcribe audio (OpenAI Whisper API)
- End consultations with outcome tracking
- List/search consultations

#### `ai_insights_service.py` ⭐
AI-powered analysis using GPT-4:
- **`analyze_consultation()`**: Extract techniques, objections, strengths/weaknesses
- **`compare_providers()`**: Identify what high performers do differently
- **`extract_best_practices()`**: Find patterns across successful consultations
- **`get_provider_insights()`**: Retrieve insights for coaching

**GPT-4 Prompts:**
```python
# Single consultation analysis
"Analyze this consultation transcript. Extract:
1. Key techniques used
2. Customer objections and how addressed
3. Emotional tone
4. What went well vs could improve
5. Specific quotes (effective/ineffective)"

# Cross-provider comparison
"Compare Provider A (75% conversion) vs Provider B (45% conversion).
Identify what Provider A does differently and provide specific
coaching for Provider B."

# Best practices extraction
"Analyze successful consultations (all resulted in bookings).
Extract common patterns and techniques that correlate with success."
```

#### `provider_analytics_service.py`
Performance metrics calculations:
- Calculate conversion rates, revenue, NPS
- Time-series trend data
- Service-specific performance
- Provider rankings
- Automated metric aggregation (daily/weekly/monthly)

### API Endpoints

#### Consultations
- `POST /api/consultations` - Create new consultation
- `POST /api/consultations/{id}/upload-audio` - Upload recording
- `POST /api/consultations/{id}/end` - End consultation + trigger AI analysis
- `GET /api/consultations` - List with filters
- `GET /api/consultations/{id}` - Get details

#### Providers
- `GET /api/providers` - List all providers
- `POST /api/providers` - Create provider
- `GET /api/providers/summary?days=30` - Performance summary
- `GET /api/providers/{id}` - Provider details
- `GET /api/providers/{id}/metrics?days=30` - Full metrics
- `GET /api/providers/{id}/insights` - AI insights
- `GET /api/providers/{id}/consultations` - Recent consultations

#### AI Insights
- `POST /api/insights/analyze/{consultation_id}` - Trigger analysis
- `POST /api/insights/compare-providers` - Compare 2 providers
- `POST /api/insights/best-practices` - Extract population-level patterns
- `PUT /api/insights/{id}/review` - Mark insight as reviewed
- `GET /api/insights/best-practices` - Get all best practices

---

## Setup & Usage

### 1. Run Database Migration
```bash
python backend/scripts/create_provider_analytics_schema.py
```

### 2. Seed Sample Data (Recommended for Testing)
```bash
python backend/scripts/seed_provider_analytics.py
```

This creates:
- 3 sample providers with different performance levels:
  - **Dr. Sarah Chen** (High performer - 75% conversion)
  - **Emily Rodriguez** (Medium - 55% conversion)
  - **Jessica Williams** (Needs coaching - 35% conversion)
- 40+ sample consultations with realistic transcripts
- AI insights for each provider

### 3. Start Backend
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start Frontend
```bash
cd admin-dashboard
npm run dev
```

### 5. Access Pages
- **Provider List**: http://localhost:3000/providers
- **Provider Detail**: http://localhost:3000/providers/[provider-id]
- **Consultation Recording**: http://localhost:3000/consultation

---

## Key Use Cases

### For Med Spa Owners:
1. **Identify Top Performers**: Quickly see which providers have highest conversion rates
2. **Spot Coaching Opportunities**: AI automatically flags providers who need support
3. **Extract Best Practices**: Learn what successful techniques work across the team
4. **Track Trends**: Monitor conversion rates and revenue over time
5. **Data-Driven Coaching**: Use AI insights to provide specific, actionable feedback

### For Providers:
1. **Self-Improvement**: Review their own insights to understand strengths/weaknesses
2. **Learn from the Best**: See what high performers do differently
3. **Track Progress**: Monitor conversion rate improvements over time

### Example Workflow:
1. **Record Consultation**: Provider uses `/consultation` page to record in-person meeting
2. **Auto-Analysis**: System transcribes and GPT-4 analyzes conversation patterns
3. **Review Insights**: Owner checks `/providers` to see new insights
4. **Coaching Session**: Owner meets with provider, references specific quotes and recommendations
5. **Track Improvement**: Monitor conversion rate trend on provider detail page

---

## AI Analysis Examples

### What the AI Identifies:

**Strengths:**
- Effective rapport building techniques
- Clear treatment explanations
- Proactive objection handling
- Natural price anchoring
- Consultative selling approach
- Emotional connection building

**Opportunities:**
- Weak objection handling
- Lack of qualifying questions
- Rushed consultations
- Poor value demonstration
- Missing closing techniques
- Ineffective pricing presentation

**Best Practices Extracted:**
- "Start with open-ended questions about desired results"
- "Address safety concerns before the client asks"
- "Frame pricing in context of long-term value"
- "Use social proof ('Many of our clients...'')"
- "Offer conservative start with follow-up adjustment"

---

## Future Enhancements

### Near-term:
- [ ] Real-time speech-to-text during consultations
- [ ] Video recording support (not just audio)
- [ ] Provider comparison view (side-by-side)
- [ ] Automated weekly coaching reports (email)
- [ ] Mobile app for consultation recording
- [ ] Export insights to PDF

### Medium-term:
- [ ] Predictive analytics (which consultations likely to book)
- [ ] Personalized training modules based on weaknesses
- [ ] Client sentiment tracking across visits
- [ ] Integration with scheduling system for follow-ups
- [ ] Team leaderboards and gamification

### Long-term:
- [ ] Real-time AI coaching (live suggestions during consultations)
- [ ] Voice tone analysis (confidence, empathy levels)
- [ ] Automated role-play training scenarios
- [ ] Multi-location provider benchmarking

---

## Technical Details

### Audio Processing:
- **Recording Format**: WebM (browser native)
- **Transcription**: OpenAI Whisper API
- **Storage**: Local filesystem (backend/uploads/consultations/)
  - Production: Migrate to Supabase Storage or S3

### AI Models:
- **Transcription**: `whisper-1`
- **Analysis**: `gpt-4o` with structured JSON outputs
- **Token Optimization**: Transcript excerpts limited to 1000-1500 chars for analysis

### Frontend Components:
- **shadcn/ui**: All UI components
- **Recharts**: Charts and visualizations
- **Next.js 14**: App router, server components
- **TailwindCSS**: Styling

### Database:
- **PostgreSQL** (via Supabase)
- **SQLAlchemy ORM**
- **UUID primary keys** for providers/consultations/insights
- **Array columns** for specialties
- **JSONB** for flexible metadata

---

## Cost Considerations

### OpenAI API Usage:
- **Whisper Transcription**: ~$0.006/minute of audio
  - 10-minute consultation = $0.06
- **GPT-4 Analysis**: ~$0.03-0.10 per consultation
  - Depends on transcript length

**Example Monthly Cost** (50 consultations):
- Transcription: 50 × $0.06 = $3.00
- Analysis: 50 × $0.07 = $3.50
- **Total: ~$6.50/month**

### Storage:
- Audio files: ~5-10 MB per 10-minute consultation
- 50 consultations/month = ~500 MB
- Minimal cost on S3/Supabase Storage

---

## Success Metrics

Track these KPIs to measure ROI:

1. **Average Conversion Rate**: Target 10-20% improvement over 3 months
2. **Provider Variance**: Reduce gap between top/bottom performers
3. **Insight Implementation**: % of recommendations acted upon
4. **Revenue per Consultation**: Should increase as providers improve
5. **Customer Satisfaction**: NPS scores by provider

---

## Support & Documentation

- **Code Location**:
  - Backend: `backend/consultation_service.py`, `backend/ai_insights_service.py`, `backend/provider_analytics_service.py`
  - Frontend: `admin-dashboard/src/app/consultation/`, `admin-dashboard/src/app/providers/`
  - Database: `backend/database.py` (lines 201-345)

- **API Documentation**: Auto-generated at http://localhost:8000/docs (FastAPI Swagger UI)

---

## Security Considerations

- [ ] Add authentication/authorization for admin pages
- [ ] Implement RBAC (providers can only see their own data)
- [ ] HIPAA compliance for storing consultation recordings
- [ ] Encrypt sensitive data at rest
- [ ] Audit logs for insight access
- [ ] Secure audio file storage (pre-signed URLs)

---

**Built with ❤️ for med spa success**
