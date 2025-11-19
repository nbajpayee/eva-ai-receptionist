# Eva AI Marketing Website

A premium Next.js 14 marketing website for Eva AI, the intelligent AI receptionist platform for medical spas and aesthetic practices.

## Overview

This is a production-ready marketing site built with:
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (custom design system)
- **Framer Motion** (scroll animations)
- **React Hook Form + Zod** (form validation)

## Features

- ✅ **7 Core Pages**: Home, Features, Pricing, Voice Demo, Integrations, About, Contact
- ✅ **Responsive Design**: Mobile-first, optimized for all screen sizes
- ✅ **Accessibility**: WCAG 2.1 AA compliant (semantic HTML, ARIA labels, keyboard navigation)
- ✅ **SEO Optimized**: Meta tags, Open Graph, Twitter Cards, structured data
- ✅ **Smooth Animations**: Scroll-triggered fade-in effects with Framer Motion
- ✅ **Interactive Components**: ROI Calculator, FAQ accordion, pricing comparison
- ✅ **Performance**: Optimized images, lazy loading, code splitting

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- (Optional) Git for version control

### Installation

1. Navigate to the marketing site directory:
```bash
cd /home/user/eva-ai-receptionist/frontend/marketing-site
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
marketing-site/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Homepage
│   ├── features/page.tsx         # Features page
│   ├── pricing/page.tsx          # Pricing page
│   ├── voice-demo/page.tsx       # Interactive voice demo
│   ├── integrations/page.tsx     # Integrations showcase
│   ├── about/page.tsx            # Company story
│   ├── contact/page.tsx          # Contact form & demo booking
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   └── globals.css               # Global styles & CSS variables
│
├── components/
│   ├── sections/                 # Page sections
│   │   ├── Hero.tsx              # Homepage hero with CTA
│   │   ├── ProblemSection.tsx    # Pain points
│   │   ├── SolutionSection.tsx   # How Eva works
│   │   ├── FeaturesSection.tsx   # Feature grid
│   │   ├── TestimonialsSection.tsx # Customer testimonials
│   │   ├── PricingTeaser.tsx     # Pricing preview
│   │   ├── CTASection.tsx        # Call-to-action
│   │   └── ROICalculator.tsx     # Interactive ROI calculator
│   │
│   ├── layout/                   # Persistent layout components
│   │   ├── Header.tsx            # Sticky navigation
│   │   └── Footer.tsx            # Footer with links
│   │
│   ├── animations/               # Reusable animation wrappers
│   │   └── FadeInUp.tsx          # Scroll-triggered fade-in
│   │
│   └── ui/                       # UI components (future ShadCN additions)
│
├── lib/
│   ├── constants.ts              # Site config, nav items, pricing, FAQs
│   └── utils.ts                  # Helper functions (cn, formatCurrency)
│
├── public/
│   ├── images/                   # Logo, testimonials, etc.
│   ├── videos/                   # Demo videos
│   └── mockups/                  # Dashboard screenshots
│
└── Configuration files
    ├── tailwind.config.ts        # Design system (colors, typography)
    ├── next.config.js            # Next.js settings
    ├── tsconfig.json             # TypeScript config
    └── package.json              # Dependencies
```

## Customization Guide

### 1. Update Site Configuration

Edit `lib/constants.ts` to customize:

```typescript
export const SITE_CONFIG = {
  name: "Eva AI",
  description: "Your marketing description",
  url: "https://yourdomain.com",
  contact: {
    email: "youremail@domain.com",
    phone: "(555) XXX-XXXX",
  },
  // ... social links, etc.
}
```

### 2. Customize Design System

Edit `tailwind.config.ts` to change colors, fonts, spacing:

```typescript
theme: {
  extend: {
    colors: {
      primary: {
        500: "#0ea5e9", // Change primary color
        // ...
      },
    },
    fontFamily: {
      sans: ["Your Font", "sans-serif"],
    },
  },
}
```

### 3. Replace Placeholder Content

- **Testimonials**: Update `lib/constants.ts` with real client quotes and photos
- **Images**: Add actual dashboard screenshots to `public/mockups/`
- **Videos**: Replace demo video placeholders in Hero and Voice Demo pages
- **Logos**: Add client logos for social proof section

### 4. Connect Contact Form

The contact form at `/contact` is currently static. To make it functional:

**Option A: Use a form service (e.g., Formspree, Basin, Netlify Forms)**

```tsx
// In app/contact/page.tsx
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
  {/* ... existing form fields ... */}
</form>
```

**Option B: Connect to Eva AI backend**

Create an API route in `app/api/contact/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Forward to your FastAPI backend
  const response = await fetch("http://localhost:8000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await response.json());
}
```

Then update the form to use this endpoint.

### 5. Enable Voice Demo

The Voice Demo page (`/voice-demo`) is currently a placeholder. To enable the actual voice interface:

1. Copy the voice client code from `frontend/app.js` (the legacy voice interface)
2. Create a React component that:
   - Connects to WebSocket at `/ws/voice/{session_id}`
   - Handles audio streaming
   - Displays real-time transcript
3. Replace the placeholder in `app/voice-demo/page.tsx`

Example integration:

```tsx
import VoiceClient from "@/components/VoiceClient";

export default function VoiceDemoPage() {
  return (
    <VoiceClient backendUrl="ws://localhost:8000/ws/voice" />
  );
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Vercel will auto-detect Next.js and configure build settings
4. Set environment variables (if needed):
   - `NEXT_PUBLIC_BACKEND_URL` (if backend is on different domain)
5. Deploy!

Your site will be live at `https://your-project.vercel.app`

### Netlify

1. Push to GitHub
2. Go to [netlify.com](https://netlify.com) and create new site from Git
3. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
4. Deploy

### Custom Server (VPS/AWS/GCP)

1. Build the production bundle:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

3. Use a process manager (PM2) to keep it running:
```bash
npm install -g pm2
pm2 start npm --name "eva-marketing" -- start
pm2 save
pm2 startup
```

4. Configure a reverse proxy (Nginx) to forward traffic to port 3000.

## Environment Variables

Create a `.env.local` file for environment-specific settings:

```env
# Optional: Override backend URL (default: http://localhost:8000)
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Optional: Calendly for demo booking
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/yourcompany/demo
```

## SEO Optimization

### Update Metadata

Each page has a `metadata` export. Update these for better SEO:

```typescript
export const metadata: Metadata = {
  title: "Your Page Title",
  description: "Your page description (155 characters max)",
  keywords: ["keyword1", "keyword2", ...],
};
```

### Add Structured Data

For better search results, add JSON-LD structured data to key pages. Example for the homepage:

```tsx
// In app/page.tsx
export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Eva AI",
    "applicationCategory": "BusinessApplication",
    "offers": {
      "@type": "Offer",
      "price": "299",
      "priceCurrency": "USD",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* ... rest of page ... */}
    </>
  );
}
```

## Performance Optimization

### Image Optimization

Always use Next.js `<Image>` component for automatic optimization:

```tsx
import Image from "next/image";

<Image
  src="/mockups/dashboard.png"
  alt="Eva AI Dashboard"
  width={1200}
  height={800}
  priority // For above-the-fold images
/>
```

### Code Splitting

Next.js automatically code-splits by route. For additional splitting:

```tsx
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(() => import("@/components/HeavyComponent"), {
  loading: () => <p>Loading...</p>,
});
```

### Lighthouse Audit

Run Lighthouse in Chrome DevTools (Target: 90+ score):
- Performance
- Accessibility
- Best Practices
- SEO

## Accessibility Checklist

- ✅ Semantic HTML (`<header>`, `<nav>`, `<main>`, `<footer>`, `<article>`)
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation (test with Tab key)
- ✅ Color contrast ratios (4.5:1 for body text, 3:1 for large text)
- ✅ Alt text on all images
- ✅ Form labels and error messages
- ✅ Focus indicators on buttons/links

## Browser Support

- ✅ Chrome/Edge (last 2 versions)
- ✅ Firefox (last 2 versions)
- ✅ Safari (last 2 versions)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## Troubleshooting

### Issue: Tailwind styles not applying

**Solution**: Make sure `tailwind.config.ts` includes all relevant paths:
```typescript
content: [
  "./app/**/*.{js,ts,jsx,tsx,mdx}",
  "./components/**/*.{js,ts,jsx,tsx,mdx}",
],
```

### Issue: Fonts not loading

**Solution**: Ensure fonts are imported in `app/layout.tsx` and CSS variables are set.

### Issue: Build errors with Framer Motion

**Solution**: Ensure all motion components have `"use client"` directive at the top of the file.

### Issue: 404 on deployed site (Vercel/Netlify)

**Solution**: Ensure your hosting provider supports Next.js App Router. Add a `vercel.json` or `netlify.toml` if needed.

## Next Steps

1. **Content Review**: Replace all placeholder copy with final marketing copy
2. **Image Assets**: Add professional screenshots, testimonials photos, and logos
3. **Demo Video**: Record and add a 60-90 second demo video for hero section
4. **Analytics**: Set up Google Analytics 4 or Plausible
5. **SEO**: Submit sitemap to Google Search Console
6. **A/B Testing**: Test different headlines, CTAs, and pricing presentation
7. **Blog**: Add content marketing articles for SEO
8. **Careers**: Add a careers page if hiring

## Support

For questions or issues:
- **Documentation**: See full brief in `/MARKETING_SITE_PROMPT.md`
- **Backend Integration**: See main project README in `/README.md`
- **GitHub Issues**: Report bugs or request features

## License

Proprietary - Eva AI

---

Built with ❤️ for Eva AI
