# Performance Optimization Guide - Eva AI Marketing Site

**Purpose:** Achieve 90+ scores on all Core Web Vitals and Lighthouse metrics
**Target:** < 2.5s LCP, < 100ms FID, < 0.1 CLS
**Priority:** High (SEO ranking factor since 2021)

---

## 📊 **Current Status (Before Optimization)**

Run Lighthouse audit to establish baseline:

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit on production
lighthouse https://getevaai.com --output html --output-path ./lighthouse-report.html

# Or use Chrome DevTools
# 1. Open https://getevaai.com in Chrome
# 2. F12 → Lighthouse tab → Analyze page load
```

**Baseline Metrics to Record:**
- Performance score: ___/100
- First Contentful Paint (FCP): ___ seconds
- Largest Contentful Paint (LCP): ___ seconds
- Total Blocking Time (TBT): ___ milliseconds
- Cumulative Layout Shift (CLS): ___ score
- Speed Index: ___ seconds

---

## 🎯 **Optimization Roadmap**

### **Phase 1: Critical Fixes (Week 1) - Target: 70+ Performance Score**

#### **1.1 Image Optimization** ✅ PARTIALLY COMPLETE

**Status:** Next.js image config optimized with AVIF/WebP support

**Remaining Tasks:**
- [ ] Convert all PNG/JPG images to WebP format
- [ ] Create AVIF fallbacks for modern browsers
- [ ] Optimize SVG icons (remove unused paths)
- [ ] Add proper `width` and `height` attributes to all images
- [ ] Implement lazy loading for below-the-fold images

**How to convert images to WebP:**

```bash
# Install WebP tools
brew install webp  # macOS
sudo apt install webp  # Linux

# Convert single image
cwebp input.png -q 80 -o output.webp

# Batch convert all images in public/
find public -name "*.png" -o -name "*.jpg" | while read img; do
  cwebp "$img" -q 85 -o "${img%.*}.webp"
done
```

**Next.js Image component usage:**

```typescript
// BEFORE (non-optimized)
<img src="/hero-bg.png" alt="Hero background" />

// AFTER (optimized)
import Image from "next/image";

<Image
  src="/hero-bg.webp"
  alt="Hero background"
  width={1920}
  height={1080}
  priority  // For above-the-fold images
  placeholder="blur"  // Optional: show blur while loading
  blurDataURL="data:image/svg+xml;base64,..." // Tiny base64 blur
/>

// For below-the-fold images
<Image
  src="/testimonial-avatar.webp"
  alt="Customer testimonial"
  width={80}
  height={80}
  loading="lazy"  // Lazy load when scrolled into view
/>
```

**Expected Impact:** LCP improves by 30-40%, CLS reduced

---

#### **1.2 Font Optimization**

**Current Issue:** Custom fonts block rendering (Flash of Unstyled Text)

**Solution:** Use Next.js Font Optimization

```typescript
// app/layout.tsx
import { Inter, Poppins } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',  // Use fallback font until custom font loads
  variable: '--font-inter',
});

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Update Tailwind config:**

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        heading: ['var(--font-poppins)'],
      },
    },
  },
};
```

**Expected Impact:** FCP improves by 0.5-1.0 seconds

---

#### **1.3 Remove Unused CSS/JS**

**Audit current bundle size:**

```bash
npm run build

# Check bundle sizes in output
# Look for large chunks (> 200kb gzipped)
```

**Techniques:**

1. **Code splitting:**
   - Use dynamic imports for heavy components
   - Example: Calendly embed only loads when "Book Demo" section visible

```typescript
// BEFORE (loads Calendly on every page)
import { CalendlyEmbed } from "@/components/sections/CalendlyEmbed";

// AFTER (loads only when needed)
import dynamic from 'next/dynamic';

const CalendlyEmbed = dynamic(
  () => import('@/components/sections/CalendlyEmbed'),
  { ssr: false, loading: () => <div>Loading booking widget...</div> }
);
```

2. **Remove unused dependencies:**

```bash
# Audit dependencies
npx depcheck

# Remove unused packages
npm uninstall <package-name>
```

3. **Tree-shake Lucide icons:**

```typescript
// BEFORE (imports entire icon library - 500kb+)
import * as Icons from "lucide-react";

// AFTER (imports only used icons - 5kb)
import { Phone, Calendar, MessageSquare } from "lucide-react";
```

**Expected Impact:** TBT reduced by 200-500ms

---

#### **1.4 Defer Non-Critical JavaScript**

**Current Issue:** Analytics scripts block initial render

**Solution:** Load analytics after page interactive

```typescript
// components/analytics/GoogleAnalytics.tsx
export default function GoogleAnalytics() {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"  // ✅ Load after page interactive
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`/* GA initialization code */`}
      </Script>
    </>
  );
}
```

**Script loading strategies:**
- `beforeInteractive`: Load before page hydrates (use for critical scripts only)
- `afterInteractive`: ✅ Load after page interactive (analytics, tracking)
- `lazyOnload`: Load during browser idle time (chat widgets, social embeds)

**Expected Impact:** TBT reduced by 100-200ms

---

### **Phase 2: Advanced Optimizations (Week 2) - Target: 85+ Performance Score**

#### **2.1 Implement Lazy Loading for Components**

**Technique:** Load below-the-fold sections only when scrolled into view

```typescript
// hooks/useIntersectionObserver.ts
import { useEffect, useRef, useState } from 'react';

export function useIntersectionObserver(options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [options]);

  return { ref, isVisible };
}
```

**Usage:**

```typescript
// components/sections/TestimonialsSection.tsx
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export default function TestimonialsSection() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section ref={ref} className="section-spacing">
      {isVisible ? (
        <div>
          {/* Render heavy testimonials component */}
          <TestimonialsCarousel />
        </div>
      ) : (
        <div style={{ minHeight: '400px' }}>
          {/* Placeholder to prevent layout shift */}
        </div>
      )}
    </section>
  );
}
```

**Expected Impact:** LCP improves (less JS to parse on initial load)

---

#### **2.2 Optimize Framer Motion Animations**

**Current Issue:** Framer Motion adds 80kb to bundle

**Solution:** Use CSS animations for simple transitions, Framer only for complex interactions

```typescript
// BEFORE (Framer Motion for simple fade-in - 80kb overhead)
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  <h1>Title</h1>
</motion.div>

// AFTER (CSS animations - 0kb overhead)
// globals.css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.5s ease-out forwards;
}

// Component
<div className="fade-in-up">
  <h1>Title</h1>
</div>
```

**When to use Framer Motion:**
- Complex scroll-triggered animations
- Interactive drag/swipe gestures
- Advanced spring physics

**When to use CSS:**
- Simple fade/slide transitions
- Hover effects
- Loading spinners

**Expected Impact:** Reduce bundle size by 60-80kb

---

#### **2.3 Preconnect to External Domains**

**Current Issue:** DNS lookups for Google Fonts, Analytics add 200-500ms latency

**Solution:** Add `<link rel="preconnect">` to layout

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://assets.calendly.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Difference between `preconnect` and `dns-prefetch`:**
- `preconnect`: Establishes full connection (DNS + TCP + TLS) - Use for critical resources
- `dns-prefetch`: Only resolves DNS - Use for less critical resources

**Expected Impact:** FCP improves by 100-300ms

---

#### **2.4 Add Resource Hints**

```typescript
// app/layout.tsx
<head>
  {/* Prefetch next page user likely to visit */}
  <link rel="prefetch" href="/features" />
  <link rel="prefetch" href="/pricing" />

  {/* Preload critical assets */}
  <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
  <link rel="preload" href="/hero-bg.webp" as="image" />
</head>
```

**Expected Impact:** Perceived performance improves (faster subsequent navigations)

---

### **Phase 3: Advanced Techniques (Week 3) - Target: 95+ Performance Score**

#### **3.1 Static Site Generation (SSG) for All Pages**

**Current Status:** Check if pages are using SSG or SSR

```bash
# Build and check output
npm run build

# Look for page types:
# ○ (Static)   - Pre-rendered at build time
# ƒ (Dynamic)  - Rendered on-demand (slower)
```

**Make all pages static:**

```typescript
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  // Pre-render all blog post pages at build time
  const posts = await getBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}
```

**Expected Impact:** TTFB < 100ms (pages served from CDN)

---

#### **3.2 Implement Service Worker for Offline Caching**

**Use next-pwa for offline support:**

```bash
npm install next-pwa
```

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  // ... existing config
});
```

**Expected Impact:** Instant repeat visits (cached assets)

---

#### **3.3 Optimize Third-Party Scripts**

**Calendly optimization:**

```typescript
// Instead of loading Calendly globally, load on-demand
const [calendlyLoaded, setCalendlyLoaded] = useState(false);

const loadCalendly = () => {
  if (!calendlyLoaded) {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);
    setCalendlyLoaded(true);
  }
};

return (
  <button onClick={loadCalendly}>
    Book a Demo
  </button>
);
```

**Expected Impact:** TBT reduced by 200ms

---

## 🚀 **Implementation Checklist**

### **Week 1: Quick Wins**
- [ ] Convert hero images to WebP (public/hero-bg.png → .webp)
- [ ] Add `width` and `height` to all Image components
- [ ] Implement font optimization (next/font)
- [ ] Defer analytics scripts (strategy="afterInteractive")
- [ ] Remove unused dependencies (npx depcheck)
- [ ] Tree-shake icon imports
- [ ] Run Lighthouse audit → Record baseline scores

### **Week 2: Component Optimizations**
- [ ] Create useIntersectionObserver hook
- [ ] Lazy load Testimonials section
- [ ] Lazy load Calendly widget
- [ ] Replace simple Framer Motion animations with CSS
- [ ] Add preconnect tags to layout
- [ ] Dynamic import for ROI Calculator component
- [ ] Run Lighthouse audit → Compare to baseline

### **Week 3: Advanced Techniques**
- [ ] Verify all pages are SSG (npm run build)
- [ ] Add generateStaticParams for blog posts
- [ ] Implement next-pwa for offline caching
- [ ] Optimize Calendly loading strategy
- [ ] Add critical CSS inlining
- [ ] Run final Lighthouse audit → Target 95+ score

---

## 📈 **Monitoring & Ongoing Optimization**

### **Tools to Use**

1. **Lighthouse CI** (Automated audits on every deploy)
   ```bash
   npm install -g @lhci/cli

   # .lighthouserc.json
   {
     "ci": {
       "assert": {
         "preset": "lighthouse:recommended",
         "assertions": {
           "categories:performance": ["error", {"minScore": 0.9}],
           "categories:accessibility": ["error", {"minScore": 0.9}]
         }
       }
     }
   }
   ```

2. **Google PageSpeed Insights API** (Weekly monitoring)
   - Monitor Core Web Vitals from real user data
   - Track field data (75th percentile of real users)

3. **Vercel Analytics** (If deployed on Vercel)
   - Real user monitoring (RUM)
   - Track actual LCP, FCP, CLS from visitors

### **Performance Budget**

Set performance budgets to prevent regressions:

```json
// .lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "resource-summary:script:size": ["error", {"maxNumericValue": 200000}],
        "resource-summary:image:size": ["error", {"maxNumericValue": 500000}],
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]
      }
    }
  }
}
```

---

## 🎯 **Target Metrics (Post-Optimization)**

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Performance Score | ___/100 | 95+/100 | Lighthouse |
| LCP | ___ s | < 2.5s | Image optimization, lazy loading |
| FID | ___ ms | < 100ms | Code splitting, defer scripts |
| CLS | ___ | < 0.1 | Explicit dimensions, font optimization |
| TBT | ___ ms | < 200ms | Remove blocking scripts |
| Speed Index | ___ s | < 3.5s | Critical CSS, preload fonts |

---

## 🆘 **Common Issues & Fixes**

### **Issue: LCP is slow (> 3s)**
**Causes:**
- Large hero image not optimized
- Hero image loaded below-the-fold content first
- Slow server response time

**Fixes:**
1. Convert hero image to WebP (reduce size by 50-70%)
2. Add `priority` to hero Image component
3. Use CDN for image hosting (Vercel automatically does this)
4. Preload hero image: `<link rel="preload" href="/hero.webp" as="image" />`

---

### **Issue: CLS is high (> 0.1)**
**Causes:**
- Images without width/height attributes
- Fonts causing layout shift
- Dynamic content inserted after load

**Fixes:**
1. Add explicit `width` and `height` to ALL images
2. Use `font-display: swap` in font declarations
3. Reserve space for dynamic content with min-height placeholders

---

### **Issue: TBT is high (> 300ms)**
**Causes:**
- Too much JavaScript execution on main thread
- Framer Motion blocking render
- Third-party scripts (analytics, Calendly)

**Fixes:**
1. Code-split heavy components
2. Defer non-critical scripts (strategy="afterInteractive")
3. Use Web Workers for expensive calculations
4. Lazy load Framer Motion animations

---

## 📚 **Resources**

- [Web.dev Core Web Vitals Guide](https://web.dev/vitals/)
- [Next.js Performance Optimization](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Google Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse)
- [Vercel Speed Insights](https://vercel.com/docs/speed-insights)

---

**Last Updated:** January 23, 2025
**Next Review:** February 23, 2025 (after Phase 3 completion)
