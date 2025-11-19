# Eva AI Marketing Site - Development Guide

## Overview

This directory contains a comprehensive development brief for building Eva AI's marketing website. The brief is designed to be fed to Claude Sonnet 4.5 (or any AI coding assistant) to generate a production-ready marketing site.

## Quick Start

### Option 1: Use the Quick Start Prompt (Recommended)

Open `MARKETING_SITE_PROMPT.md` and scroll to the bottom section titled **"Quick Start Prompt for Claude Sonnet 4.5"**. Copy that entire section and paste it into a new Claude conversation.

This condensed version includes:
- Project overview and goals
- Reference to Velora repository structure
- Tech stack and pages to build
- Design direction and key messaging
- Technical requirements and success criteria

### Option 2: Use the Full Brief

For more detailed guidance, copy the entire `MARKETING_SITE_PROMPT.md` file content. This includes:
- Detailed page-by-page content specifications
- Component library requirements
- Animation guidelines
- Accessibility standards
- SEO strategy
- Development phases and timeline

## What You'll Get

The prompt will guide Claude to build:

1. **Full Next.js 14+ Marketing Site** with:
   - Homepage with hero, features, testimonials, pricing teaser
   - Features page with interactive demos
   - Pricing page with comparison table and ROI calculator
   - Voice Demo page with embedded interface
   - Integrations page
   - About, Contact, and Blog pages

2. **Modern Tech Stack**:
   - Next.js 14+ (App Router)
   - TypeScript
   - Tailwind CSS
   - ShadCN UI components
   - Framer Motion animations

3. **Professional Design**:
   - Inspired by Apple, Notion, Asana, Airbnb
   - Medical spa-appropriate color palette (blues/teals for trust)
   - Clean typography and strong visual hierarchy
   - Subtle, performant animations

4. **Production-Ready Code**:
   - WCAG 2.1 AA accessible
   - SEO optimized
   - Mobile-first responsive
   - Lighthouse score > 90

## File Structure

```
/home/user/eva-ai-receptionist/
├── MARKETING_SITE_PROMPT.md       # Full development brief (this is the main file)
├── MARKETING_SITE_README.md        # This file - usage instructions
└── frontend/
    └── marketing-site/             # Will be created by Claude
        ├── src/
        │   ├── app/                # Next.js App Router pages
        │   ├── components/         # React components
        │   ├── lib/                # Utilities
        │   └── styles/             # Global styles
        ├── public/                 # Static assets
        └── package.json
```

## Development Workflow

### Step 1: Generate the Site

1. Open a new Claude conversation (or use Claude Code CLI)
2. Copy the "Quick Start Prompt" from `MARKETING_SITE_PROMPT.md`
3. Paste into Claude with: "Please build this marketing site exactly as specified"
4. Claude will generate the complete project structure

### Step 2: Customize Content

The generated site will have placeholder content. Replace:

- **Copy**: Update headlines, descriptions, testimonials
- **Images**: Add actual dashboard screenshots, team photos, logos
- **Videos**: Record and add real demo videos
- **Branding**: Finalize color palette, fonts, and visual identity
- **Forms**: Connect contact forms to your backend or Calendly

### Step 3: Integration

Connect the marketing site to Eva AI backend:

- Demo page → WebSocket to `/ws/voice/{session_id}` endpoint
- Contact forms → FastAPI contact endpoint or third-party (HubSpot, Mailchimp)
- Analytics → Google Analytics 4, Mixpanel, or Plausible
- CMS (optional) → Sanity, Contentful for blog content

### Step 4: Deploy

Deploy to Vercel (recommended):

```bash
cd frontend/marketing-site
vercel deploy --prod
```

Or use your preferred hosting (Netlify, AWS Amplify, Railway).

## Design Decisions Explained

### Why These Technologies?

- **Next.js 14+**: Industry standard for marketing sites, excellent SEO, fast page loads, easy deployment
- **ShadCN UI**: Accessible, customizable components that look professional out-of-the-box
- **Tailwind CSS**: Rapid styling, consistent design system, excellent for responsive design
- **Framer Motion**: Smooth animations without performance overhead

### Why This Structure?

The site structure mirrors the Velora repository (https://github.com/nbajpayee/Velora), which provides:
- Clean, proven page hierarchy (/, /features, /pricing, /demo, etc.)
- Modern component organization
- Scalable architecture for future growth

### Target Audience Considerations

Medical spa owners and healthcare administrators need:
- **Trust signals**: Prominent testimonials, certifications (HIPAA), professional design
- **ROI focus**: Pricing transparency, ROI calculator, specific metrics (40% booking increase)
- **Ease of understanding**: Clear value props, demo videos, no technical jargon
- **Mobile experience**: Many browse on phones between clients

## Key Features to Highlight

When customizing content, emphasize:

1. **100% Booking Reliability** (deterministic tool execution - unique selling point)
2. **24/7 Availability** (never miss a call = never lose revenue)
3. **Omnichannel Support** (voice + SMS + email in one timeline)
4. **AI Analytics** (satisfaction scoring, sentiment analysis, actionable insights)
5. **HIPAA Compliance** (critical for healthcare trust)
6. **Trusted by 200+ Spas** (social proof)

## SEO Keywords to Target

Primary:
- "AI receptionist for medical spas"
- "med spa automation software"
- "automated appointment booking medical spa"
- "AI phone answering service healthcare"

Secondary:
- "virtual receptionist aesthetic practice"
- "medical spa scheduling software"
- "AI call handling medical office"
- "automated patient communication"

Incorporate these naturally into page titles, H1s, meta descriptions, and body content.

## Success Metrics

Track these KPIs post-launch:

- **Traffic**: 5,000+ unique visitors/month (within 3 months)
- **Conversion**: 3-5% demo booking rate
- **Bounce Rate**: < 50%
- **Session Duration**: > 2 minutes
- **Pages/Session**: > 2.5
- **Lighthouse Score**: > 90 (all metrics)

## Maintenance & Iteration

After launch:

1. **Week 1-2**: Monitor analytics, fix critical bugs, optimize for mobile
2. **Month 1**: A/B test CTAs, headlines, pricing presentation
3. **Month 2-3**: Add blog content for SEO, case studies, video testimonials
4. **Quarter 1**: Iterate based on user feedback, expand integrations page

## Support

For questions about the development brief:
- Review `MARKETING_SITE_PROMPT.md` for detailed specs
- Check Eva AI's main documentation in `README.md` and `CLAUDE.md`
- Reference the Velora repository: https://github.com/nbajpayee/Velora

## Next Steps

1. ✅ Review `MARKETING_SITE_PROMPT.md` to understand the full scope
2. ✅ Copy the "Quick Start Prompt" section
3. ✅ Paste into Claude Sonnet 4.5 to generate the site
4. ⏳ Customize with real content (copy, images, videos)
5. ⏳ Test locally and iterate on design
6. ⏳ Deploy to production
7. ⏳ Set up analytics and monitoring
8. ⏳ Launch and promote!

---

**Note**: The generated site will be a starting point. Expect to spend 1-2 weeks customizing content, gathering assets (screenshots, videos, testimonials), and fine-tuning the design before public launch.
