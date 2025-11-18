# Eva AI Marketing Website - Development Brief

## Project Overview

Build a premium marketing website for **Eva AI**, an intelligent AI receptionist platform designed specifically for medical spas and aesthetic practices. The site should position Eva as the industry-leading solution for automated patient communication, appointment management, and practice efficiency.

## Product Context

**Eva AI** is a production-ready voice AI receptionist that:
- Handles inbound calls with natural, empathetic conversation
- Books appointments automatically with 100% reliability via deterministic booking flow
- Supports omnichannel communications (voice, SMS, email) with unified customer timelines
- Provides real-time analytics with AI-powered satisfaction scoring
- Integrates with Google Calendar and major scheduling platforms
- Features smart interruption handling and dual-speed voice activity detection (120ms/300ms)
- Offers comprehensive admin dashboard for conversation monitoring and metrics

**Key Services Handled:**
- Botox, Dermal Fillers, Laser Hair Removal, HydraFacial, Chemical Peels
- Microneedling, CoolSculpting, PRP Facials, Consultations
- Full spectrum of aesthetic and wellness treatments

**Technical Highlights:**
- OpenAI Realtime API for natural voice conversations
- FastAPI backend with Supabase PostgreSQL
- Next.js admin dashboard with real-time metrics
- 100% appointment booking success rate (deterministic tool execution)
- Cross-channel AI sentiment analysis and satisfaction scoring

## Target Audience

### Primary
- **Medical Spa Owners & Managers** (30-60 years old)
  - Running 1-10 location practices
  - Annual revenue $500K-$10M
  - Pain points: missed calls, booking inefficiency, staff overhead
  - Values: professionalism, patient experience, ROI

- **Healthcare Practice Administrators**
  - Managing operations for aesthetic clinics
  - Focused on metrics, efficiency, compliance
  - Tech-savvy, data-driven decision makers

### Secondary
- Aesthetic medicine practitioners exploring automation
- Multi-location spa franchises
- Medical device/software buyers at conferences

## Technical Requirements

### Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + CSS modules
- **Components**: ShadCN UI (shadcn/ui)
- **Animation**: Framer Motion
- **Icons**: Lucide React or Heroicons
- **Typography**: Inter (body) + optional display font (DM Sans, Clash Display, or similar)
- **Additional Libraries**:
  - `react-intersection-observer` for scroll animations
  - `react-wrap-balancer` for headline text balance
  - `vaul` or `radix-ui` for modals/drawers

### Location & Structure

**Reference Project**: The Velora repository (https://github.com/nbajpayee/Velora) provides a strong starting structure with these pages:
- `/` (Index/Home)
- `/features`
- `/pricing`
- `/voice-demo`
- `/integrations`
- `/about`
- `/contact`
- `/careers`
- `/blog`

**Eva AI Marketing Site Structure** (adapt from Velora):
```
frontend/
├── marketing-site/          # New Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Homepage
│   │   │   ├── features/         # Features deep dive
│   │   │   │   └── page.tsx
│   │   │   ├── pricing/          # Pricing plans
│   │   │   │   └── page.tsx
│   │   │   ├── voice-demo/       # Interactive voice demo
│   │   │   │   └── page.tsx
│   │   │   ├── integrations/     # Integration partners
│   │   │   │   └── page.tsx
│   │   │   ├── about/            # Company story
│   │   │   │   └── page.tsx
│   │   │   ├── contact/          # Contact/Demo request
│   │   │   │   └── page.tsx
│   │   │   ├── blog/             # Content marketing (optional)
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx
│   │   │   └── layout.tsx        # Root layout with nav/footer
│   │   ├── components/
│   │   │   ├── sections/         # Page sections (Hero, Features, etc.)
│   │   │   ├── ui/               # ShadCN components
│   │   │   ├── layout/           # Header, Footer, Nav
│   │   │   └── animations/       # Reusable motion components
│   │   ├── lib/
│   │   │   ├── utils.ts          # Helper functions
│   │   │   └── constants.ts      # Site config, nav items
│   │   └── styles/
│   │       └── globals.css
│   ├── public/
│   │   ├── images/
│   │   ├── videos/               # Demo videos
│   │   ├── mockups/              # Dashboard screenshots
│   │   └── favicon.ico
│   └── package.json
```

### Configuration Files Needed
- `tailwind.config.ts` - Custom theme with medical spa color palette
- `next.config.js` - Image optimization, redirects
- `tsconfig.json` - TypeScript configuration
- `components.json` - ShadCN configuration

## Design Direction

### Visual Identity

**Color Palette** (create a sophisticated, trustworthy scheme):
- **Primary**: Soft blue/teal (healthcare trust) or elegant purple (luxury)
  - Example: `#6366F1` (indigo) or `#0EA5E9` (sky blue)
- **Secondary**: Warm accent (approachability)
  - Example: `#F59E0B` (amber) or `#EC4899` (pink)
- **Neutral**: Modern grays with warmth
  - Background: `#FAFAFA` to `#FFFFFF`
  - Text: `#1F2937` (dark), `#6B7280` (muted)
- **Success/Data**: `#10B981` (emerald for metrics)

**Typography Scale**:
- Headlines: 60px → 36px (responsive)
- Subheads: 24px → 18px
- Body: 16px → 14px
- Line height: 1.5-1.7 for readability

### Design Philosophy

**Inspiration Sources**:
1. **Apple** - Minimalism, white space, product-focused imagery, subtle animations
2. **Notion** - Clean typography, friendly illustrations, soft color transitions
3. **Asana** - Clear information hierarchy, confident copywriting, dashboard previews
4. **Airbnb** - Trust signals, social proof, user testimonials with photos

**Core Principles**:
- **Clarity over cleverness**: Direct value propositions, no jargon
- **Show, don't tell**: Animated demos, interactive elements, dashboard screenshots
- **Professional warmth**: Approachable but not playful, trustworthy but not corporate
- **Data-driven trust**: Metrics, case studies, specific results (e.g., "99.8% uptime")
- **Scannable content**: Short paragraphs, bullet points, visual hierarchy

### Layout Patterns
- **Hero sections**: Full viewport height, centered content, video backgrounds
- **Feature grids**: 3-column on desktop, 1-column mobile, icon + headline + description
- **Alternating content blocks**: Text left/image right, then flip
- **Sticky navigation**: Transparent → solid on scroll
- **Generous spacing**: Sections separated by 120px+ (desktop)

### Animation Guidelines
- **Entrance animations**: Fade up 20px with stagger on scroll
- **Micro-interactions**: Button hover states, card lifts (shadow + translate)
- **Scroll-triggered**: Progress bars, counters, parallax (subtle)
- **Page transitions**: Smooth fade/slide between routes
- **Performance**: 60fps, use `transform` and `opacity` only, respect `prefers-reduced-motion`

## Page Structure & Content

**Note**: Use the Velora repository structure (https://github.com/nbajpayee/Velora) as a starting reference for navigation, component organization, and overall architecture. Adapt its clean structure while customizing content for Eva AI's medical spa audience.

### 1. Homepage (`/`)

**Hero Section**
- **Headline**: "The AI Receptionist That Never Misses a Call"
  - Or: "Eva: Your Medical Spa's 24/7 Front Desk"
- **Subheadline**: "Automate appointments, answer questions, and delight patients—all with natural voice AI trusted by aesthetic practices nationwide."
- **CTA Primary**: "Book a Demo" (prominent button)
- **CTA Secondary**: "See How It Works" (scroll to demo video)
- **Visual**: Animated waveform or phone interface showing Eva in action
- **Trust Signals**: "Trusted by 200+ medical spas" | "4.9/5 on G2" | "HIPAA Compliant"

**Problem/Agitate Section**
- **Headline**: "Every Missed Call is Lost Revenue"
- **Pain Points** (3-column grid with icons):
  - "Calls going to voicemail during rush hours" → Icon: 📞❌
  - "Staff overwhelmed with repetitive booking questions" → Icon: 😓
  - "24/7 patient expectations vs. 9-5 availability" → Icon: ⏰
- **Stat**: "The average med spa loses $50,000/year to missed calls."

**Solution Section (How Eva Works)**
- **Headline**: "Meet Eva: Your Intelligent Front Desk"
- **3-Step Process** (animated):
  1. **Listen**: "Eva answers every call instantly with a warm, professional voice"
  2. **Understand**: "Natural language AI comprehends patient needs and questions"
  3. **Execute**: "Books appointments, provides pricing, schedules follow-ups—automatically"
- **Visual**: Flow diagram or animated sequence

**Demo Video Section**
- **Headline**: "Hear Eva in Action"
- **Embedded video**: 60-90 second demo call showing booking flow
- **Transcript overlay**: Real-time text showing what's being said
- **CTA**: "Try Eva for Free" button below

**Key Features (Icon Grid)**
- **Voice AI That Sounds Human**
  - "Powered by OpenAI Realtime API, Eva speaks naturally and handles interruptions gracefully"
- **100% Booking Reliability**
  - "Deterministic scheduling ensures every qualified caller gets an appointment"
- **Omnichannel Communication**
  - "Manage voice, SMS, and email conversations in one unified timeline"
- **AI-Powered Analytics**
  - "Real-time satisfaction scoring, sentiment analysis, and performance metrics"
- **Seamless Integrations**
  - "Connects to Google Calendar, Boulevard, and major scheduling platforms"
- **Admin Dashboard**
  - "Monitor conversations, track KPIs, and optimize your front desk—all in real-time"

**Social Proof**
- **Headline**: "Trusted by Leading Medical Spas"
- **Testimonials** (3 cards with photos):
  - "Eva answers 95% of our calls after hours. Our booking rate increased 40% in 2 months." — Dr. Sarah Chen, Beverly Hills Med Spa
  - "Staff can focus on in-person clients instead of answering the same questions all day." — Jessica Rodriguez, Glow Aesthetics
  - "The admin dashboard gives us insights we never had before. Game changer." — Michael Park, Luxe Skin Studios
- **Logos**: 6-8 client logos (can be anonymized or "Confidential Client" placeholders)

**Pricing Teaser**
- **Headline**: "Plans for Practices of Every Size"
- **3 Tiers** (cards):
  - **Starter**: $299/month - 500 calls, 1 location
  - **Growth**: $599/month - Unlimited calls, 3 locations, SMS
  - **Enterprise**: Custom - White-label, multi-location, dedicated support
- **CTA**: "View Full Pricing" link to /pricing

**Final CTA Section**
- **Headline**: "Ready to Transform Your Front Desk?"
- **Subheadline**: "Join 200+ medical spas using Eva to book more appointments and delight patients."
- **CTA Button**: "Schedule Your Demo"
- **Secondary**: "Or call us at (555) 123-4567"

### 2. Features Page (`/features`)

**Hero**
- **Headline**: "Every Feature Your Front Desk Needs"
- **Subheadline**: "From voice AI to analytics, Eva handles the complexity so you can focus on patients."

**Features Deep Dive** (expandable sections or tabs)
1. **Natural Voice AI**
   - Real-time conversations with interruption handling
   - Dual-speed VAD (120ms/300ms) for instant responses
   - Persona enforcement (Eva always identifies correctly)
   - Handles medical spa FAQs, pricing, provider info

2. **Deterministic Appointment Booking**
   - Preemptive availability checking
   - Automatic booking execution when details are complete
   - Zero AI hesitation or retry loops
   - Google Calendar and Boulevard integration

3. **Omnichannel Communications**
   - Unified timeline for voice, SMS, email
   - Multi-message threading for text conversations
   - Cross-channel satisfaction scoring
   - Single dashboard for all patient interactions

4. **AI-Powered Analytics**
   - GPT-4 sentiment analysis on every conversation
   - Satisfaction scoring (0-10 scale)
   - Frustration detection and escalation alerts
   - Daily, weekly, monthly metrics aggregation

5. **Admin Dashboard**
   - Real-time conversation monitoring
   - Filterable call history with transcripts
   - Provider performance metrics
   - Exportable reports for stakeholders

6. **Integrations**
   - Google Calendar (production-ready)
   - Boulevard (coming soon)
   - Twilio SMS, SendGrid Email
   - Webhook support for custom workflows

**Interactive Demo**
- Embedded voice interface or video showing each feature

**Comparison Table**
- "Eva vs. Traditional Receptionist vs. Basic Answering Service"

### 3. Pricing Page (`/pricing`)

**Headline**: "Transparent Pricing for Every Practice Size"

**Pricing Table** (3 columns):
- **Starter** - $299/month
  - 500 calls/month
  - Voice AI receptionist
  - Basic analytics
  - 1 location
  - Google Calendar integration
  - Email support

- **Professional** - $599/month (Most Popular)
  - Unlimited calls
  - Voice + SMS + Email
  - Advanced analytics & satisfaction scoring
  - Up to 3 locations
  - All integrations
  - Priority support
  - Custom persona training

- **Enterprise** - Custom
  - Everything in Professional
  - White-label options
  - Unlimited locations
  - Dedicated account manager
  - HIPAA compliance package
  - Custom integrations
  - SLA guarantees

**FAQ Section**
- "What counts as a 'call'?"
- "Can I upgrade or downgrade anytime?"
- "Is there a setup fee?"
- "What happens if I go over my call limit?"
- "Do you offer a free trial?"

**ROI Calculator** (interactive widget)
- Input: Calls/day, avg appointment value, current missed call rate
- Output: Projected revenue increase with Eva

### 4. About Page (`/about`)

**Headline**: "Built by Med Spa Operators, For Med Spa Operators"

**Origin Story**
- Brief narrative about why Eva was created
- Understanding the pain of missed calls and inefficient scheduling

**Team Section** (optional if actual team)
- Founder(s), key engineers, advisors
- Photos, LinkedIn links

**Mission Statement**
- "To empower aesthetic practices with AI that elevates patient experience and operational efficiency."

**Values** (4 icons + text)
- Patient-First Design
- Reliability & Trust
- Continuous Innovation
- Healthcare Compliance

### 5. Demo/Contact Page (`/demo` or `/contact`)

**Headline**: "See Eva in Action"

**Two Options**:
1. **Interactive Demo** (if feasible)
   - Embed the actual voice interface with sample scenario
   - "Try booking a Botox appointment with Eva"

2. **Calendly/Form Integration**
   - "Book a 15-minute demo with our team"
   - Form fields: Name, Email, Phone, Practice Name, # Locations
   - CTA: "Schedule Demo"

**Contact Information**
- Email: hello@eva-ai.com
- Phone: (555) EVA-CALL
- Address: (if applicable)

**FAQ**: "What happens during a demo?"

### 6. Voice Demo Page (`/voice-demo`)

**Headline**: "Experience Eva Yourself"

**Interactive Demo**
- Embed actual voice interface (similar to frontend/index.html)
- Pre-configured scenarios:
  - "Book a Botox appointment for next Tuesday"
  - "What are your hours and location?"
  - "Tell me about your pricing for dermal fillers"
- Real-time transcript display
- Waveform visualization during speech

**How It Works** (step-by-step breakdown)
- Visual flow diagram of the conversation
- Technical architecture explanation (for technical buyers)
- Security & privacy notes (HIPAA compliance)

**CTA**: "Ready to deploy Eva at your practice?" → Demo booking

### 7. Integrations Page (`/integrations`)

**Headline**: "Eva Connects to Your Existing Tools"

**Integration Grid** (logos + descriptions):
- **Google Calendar** (Live) - "Seamless appointment sync"
- **Boulevard** (Coming Soon) - "Full salon suite integration"
- **Twilio** (Live) - "SMS and phone capabilities"
- **SendGrid** (Live) - "Email automation"
- **Zapier** (Planned) - "Connect to 5000+ apps"
- **Webhooks** (Live) - "Custom integrations via API"

**API Documentation Link**
- "Build custom integrations with our developer API"

**Request Integration Form**
- "Don't see your platform? Request it here."

### 8. Blog (`/blog`) (Optional but Recommended for SEO)

**Purpose**: SEO, thought leadership

**Sample Topics**:
- "5 Ways Medical Spas Lose Revenue (And How to Fix Them)"
- "The ROI of AI Receptionists in Aesthetic Medicine"
- "Patient Satisfaction Starts With the First Call"
- "How Eva Achieved 100% Booking Reliability"

## Component Library Requirements

### Core Components to Build

1. **Navigation**
   - `<Header />` - Sticky nav with transparent → solid scroll effect
   - `<MobileMenu />` - Slide-out drawer with ShadCN Sheet
   - `<Footer />` - Multi-column with links, social, legal

2. **Sections**
   - `<Hero />` - Full-height with video/animation background
   - `<FeatureGrid />` - Responsive grid with icon, headline, description
   - `<TestimonialCarousel />` - Auto-rotating cards with pagination
   - `<PricingTable />` - Responsive pricing cards with feature comparison
   - `<CTASection />` - Reusable call-to-action block
   - `<StatsBar />` - Animated counters (e.g., "10,000+ calls handled")

3. **Interactive Elements**
   - `<DemoVideo />` - Video player with transcript overlay
   - `<ROICalculator />` - Interactive form with live calculations
   - `<ComparisonTable />` - Sticky header, expandable rows
   - `<FAQ />` - Accordion (ShadCN Accordion)

4. **Forms**
   - `<ContactForm />` - With validation (react-hook-form + zod)
   - `<DemoBookingForm />` - Integrated with Calendly or backend

5. **Animations**
   - `<FadeInUp />` - Scroll-triggered entrance (Framer Motion + Intersection Observer)
   - `<StaggerChildren />` - Wrapper for list animations
   - `<CountUp />` - Animated number counters for stats
   - `<ParallaxSection />` - Subtle parallax scroll effects

## Content Guidelines

### Voice & Tone
- **Professional but approachable**: "Eva helps you..." not "Our revolutionary AI-powered platform leverages..."
- **Benefit-focused**: Lead with outcomes, not features
- **Confident, not arrogant**: "Industry-leading" is fine, "only solution" is not
- **Empathetic**: Acknowledge pain points authentically
- **Data-driven**: Use specific numbers (e.g., "40% increase in bookings" not "significant increase")

### Copywriting Principles
- **Headlines**: Promise a benefit (max 10 words)
- **Subheadlines**: Expand on the promise, add specificity (max 20 words)
- **Body copy**: Short paragraphs (2-3 sentences), active voice
- **CTAs**: Action-oriented ("Schedule Your Demo" not "Learn More")
- **Avoid**: Jargon, buzzwords ("synergy", "revolutionary"), exclamation marks!!!

### SEO Considerations
- **Primary Keywords**: "AI receptionist for medical spas", "med spa automation", "aesthetic practice scheduling software"
- **Secondary**: "AI booking assistant", "medical spa phone answering", "automated patient scheduling"
- **Meta Descriptions**: 155 characters, include primary keyword + value prop
- **Alt Text**: Descriptive for all images, include keywords naturally
- **Internal Linking**: Cross-link features, blog posts, pricing

## Technical Implementation Details

### Performance Optimization
- Image optimization with Next.js `<Image />` component
- Lazy load below-the-fold content
- Preload critical assets (fonts, hero images)
- Code splitting by route
- Minimize third-party scripts
- Target: Lighthouse score >90 across all metrics

### Responsive Design
- **Breakpoints**: Mobile (< 768px), Tablet (768-1024px), Desktop (> 1024px)
- **Mobile-first approach**: Design for mobile, enhance for desktop
- **Touch targets**: Minimum 44x44px for buttons/links on mobile
- **Typography scaling**: Use `clamp()` for fluid sizing

### Accessibility (WCAG 2.1 AA)
- Semantic HTML (`<header>`, `<nav>`, `<main>`, `<article>`)
- ARIA labels for interactive elements
- Keyboard navigation support (focus states, skip links)
- Color contrast ratios: 4.5:1 for body text, 3:1 for large text
- Alt text for all meaningful images
- Video captions/transcripts

### Analytics & Tracking
- Google Analytics 4 integration
- Event tracking: CTA clicks, demo requests, pricing page views
- Conversion funnels: Homepage → Pricing → Demo → Signup
- Heatmaps (optional): Hotjar or Microsoft Clarity

### Integrations to Consider
- **Calendly**: Embed demo booking calendar
- **Intercom/Drift**: Live chat widget (optional)
- **HubSpot/Mailchimp**: Newsletter signup
- **Stripe/Checkout**: If offering trial signups (future)

## Deployment & Infrastructure

### Hosting Recommendations
- **Vercel** (recommended for Next.js)
  - Automatic deployments from Git
  - Edge functions for dynamic content
  - Built-in analytics and performance monitoring

### Domain & DNS
- Primary: `eva-ai.com` or similar
- Redirects: `www.eva-ai.com` → `eva-ai.com`

### Environment Variables
```env
NEXT_PUBLIC_API_URL=https://api.eva-ai.com
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/eva-ai/demo
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

## Success Metrics

### Launch Goals (First 3 Months)
- **Traffic**: 5,000+ unique visitors/month
- **Conversion Rate**: 3-5% demo booking rate
- **Bounce Rate**: < 50%
- **Page Speed**: Lighthouse score > 90
- **SEO**: First-page ranking for 3+ primary keywords

### User Behavior Targets
- Average session duration: > 2 minutes
- Pages per session: > 2.5
- Demo request form completion: > 60%

## Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind + ShadCN
- [ ] Set up design system (colors, typography, spacing)
- [ ] Build core components (Header, Footer, Button, Card)
- [ ] Create base layout and routing structure

### Phase 2: Homepage (Week 2)
- [ ] Hero section with animation
- [ ] Problem/solution sections
- [ ] Feature grid
- [ ] Testimonials
- [ ] Pricing teaser
- [ ] CTAs

### Phase 3: Subpages (Week 3)
- [ ] Features page with interactive demos
- [ ] Pricing page with comparison table
- [ ] About page
- [ ] Contact/Demo form

### Phase 4: Polish & Optimization (Week 4)
- [ ] Mobile responsiveness refinement
- [ ] Animation polish and performance testing
- [ ] SEO optimization (meta tags, sitemap, robots.txt)
- [ ] Accessibility audit and fixes
- [ ] Cross-browser testing
- [ ] Analytics integration

### Phase 5: Content & Launch (Week 5)
- [ ] Final copywriting review
- [ ] Professional screenshots/mockups
- [ ] Demo video production
- [ ] Deployment to production
- [ ] DNS configuration
- [ ] Launch announcement

## Brand Assets Needed

Before starting, gather or create:
- [ ] Logo (SVG, multiple sizes)
- [ ] Favicon set (16x16, 32x32, 180x180, etc.)
- [ ] Dashboard screenshots (anonymized patient data)
- [ ] Demo video (60-90 seconds)
- [ ] Team photos (if including About page)
- [ ] Client testimonial photos (with permissions)
- [ ] Social media cover images (OG images for sharing)
- [ ] Icon set for features (custom or Lucide icons)

## Velora Repository Reference

**Primary Code Reference**: https://github.com/nbajpayee/Velora

**What to Adapt from Velora:**
1. **Project Structure**: Follow the same Vite + React + TypeScript + ShadCN + Tailwind setup (or adapt to Next.js App Router)
2. **Routing Pattern**: Use Velora's clean route definitions as template (/, /features, /pricing, etc.)
3. **Component Organization**: Study how Velora structures its components, UI library, and page layouts
4. **Styling Approach**: Velora's Tailwind configuration and component styling patterns
5. **Provider Setup**: QueryClient, Tooltip, Toast/Sonner implementations
6. **404 Handling**: Velora's NotFound page pattern

**Key Differences for Eva AI:**
- **Content Focus**: Medical spa industry vs. general SaaS
- **Visual Identity**: Healthcare trust colors (blues/teals) vs. Velora's palette
- **Target Audience**: Healthcare professionals vs. broader market
- **Technical Depth**: Emphasize AI/voice technology and deterministic booking
- **Social Proof**: Medical spa testimonials, HIPAA compliance badges
- **Demo Experience**: Interactive voice interface (Velora may not have this)

**How to Use Velora:**
- Clone the repo and run locally to explore the live experience
- Study `src/App.tsx` for routing architecture
- Review component structure in `src/components/`
- Examine Tailwind config for theme customization patterns
- Use as scaffolding, then customize extensively for Eva's brand

## Reference Sites for Inspiration

**Study these for layout, animation, and content:**
- **Apple.com**: Product pages, white space, typography
- **Notion.so**: Friendly but professional tone, feature sections
- **Asana.com**: Dashboard previews, customer stories
- **Airbnb.com**: Trust signals, testimonials, photography
- **Stripe.com**: Developer-focused clarity, interactive demos
- **Linear.app**: Smooth animations, dark mode option, clean design
- **Intercom.com**: Customer-first messaging, clear value props

## Final Notes

- **Prioritize clarity**: If a visitor can't understand what Eva does in 5 seconds, redesign the hero
- **Show the product**: More screenshots, videos, and interactive demos—less stock imagery
- **Trust is critical**: Healthcare buyers need heavy social proof (testimonials, case studies, certifications)
- **Mobile matters**: Many med spa owners browse on phones between clients
- **Fast iteration**: Launch with core pages, iterate based on analytics

---

## Quick Start Prompt for Claude Sonnet 4.5

Use this concise version to kick off development:

---

**Project**: Build a premium marketing website for **Eva AI** — an intelligent AI receptionist platform for medical spas and aesthetic practices.

**Reference Architecture**: Use https://github.com/nbajpayee/Velora as structural foundation. It has the exact page structure we want (/, /features, /pricing, /voice-demo, /integrations, /about, /contact, /blog) built with Vite + React + TypeScript + ShadCN + Tailwind.

**Tech Stack**:
- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS + ShadCN UI
- Framer Motion for animations
- Lucide icons
- React Hook Form + Zod for forms

**Pages to Build**:
1. **Homepage**: Hero with demo video, problem/solution, feature grid, testimonials, pricing teaser, CTAs
2. **Features**: Deep dive on voice AI, deterministic booking, omnichannel, analytics, dashboard
3. **Pricing**: 3-tier pricing table (Starter $299, Professional $599, Enterprise custom) with ROI calculator
4. **Voice Demo**: Interactive voice interface with pre-configured scenarios
5. **Integrations**: Google Calendar, Boulevard, Twilio, SendGrid, Zapier, Webhooks
6. **About**: Origin story, mission, values, team (optional)
7. **Contact/Demo**: Calendly embed or form for demo booking
8. **Blog**: SEO content (optional but recommended)

**Design Direction**:
- **Inspiration**: Apple (minimalism), Notion (approachability), Asana (dashboard focus), Airbnb (trust signals)
- **Color Palette**: Primary: Soft blue/indigo (#6366F1) or teal (#0EA5E9), Secondary: Warm accent (amber/pink), Neutrals: Modern grays on white
- **Typography**: Inter (body), optional display font (DM Sans/Clash Display), strong hierarchy (60px → 16px)
- **Animations**: Subtle fade-up on scroll, button hovers, scroll-triggered counters, 60fps performance
- **Tone**: Professional but warm, benefit-focused, data-driven (no jargon)

**Target Audience**: Medical spa owners/managers (30-60), healthcare administrators — value professionalism, ROI, patient experience

**Key Messaging**:
- Eva answers every call 24/7 (never miss revenue)
- 100% appointment booking reliability (deterministic execution)
- Omnichannel: voice + SMS + email in unified timeline
- AI analytics: satisfaction scoring, sentiment analysis
- Trusted by 200+ medical spas

**Technical Requirements**:
- Mobile-first responsive (breakpoints: 768px, 1024px)
- WCAG 2.1 AA accessible (semantic HTML, ARIA, keyboard nav, color contrast)
- Lighthouse score > 90 (optimize images, lazy load, code split)
- SEO optimized (meta tags, keywords: "AI receptionist for medical spas", "med spa automation")

**Project Location**: Create in `/home/user/eva-ai-receptionist/frontend/marketing-site/`

**Deliverables**:
1. Full Next.js site with all pages
2. Reusable component library (sections, animations, forms)
3. Tailwind config with Eva brand theme
4. README with setup instructions
5. Placeholder content where final copy/images aren't ready

**Success Criteria**:
- Visitor understands what Eva does in 5 seconds (hero clarity)
- Trust signals prominent (testimonials, logos, HIPAA badge)
- Strong CTAs on every page (demo booking)
- Smooth animations without performance lag
- Professional design that appeals to healthcare decision-makers

---

**Start by**:
1. Cloning Velora structure and adapting to Next.js App Router
2. Setting up design system (colors, typography, spacing)
3. Building core layout (header, footer, nav)
4. Creating homepage with all sections
5. Expanding to subpages

Reference the full brief above for detailed content, components, and implementation guidance.
