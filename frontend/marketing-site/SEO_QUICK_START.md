# SEO Quick Start Guide - Eva AI Marketing Site

**Time Required:** 2 hours
**Difficulty:** Easy
**Impact:** High - Enables tracking, indexing, and ranking

This guide gets you from zero to fully-tracked SEO in 2 hours.

---

## ⚡ **30-SECOND CHECKLIST**

Before you start, you need:
- [ ] Gmail account (for Google services)
- [ ] Access to DNS settings (for domain verification)
- [ ] Access to deploy this repo (Railway, Vercel, etc.)

---

## 🚀 **STEP 1: Environment Variables (10 minutes)**

### Copy and Configure `.env.local`

```bash
# In frontend/marketing-site/ directory
cp .env.example .env.local
```

### Edit `.env.local` with these REQUIRED values:

```bash
# REQUIRED
NEXT_PUBLIC_SITE_URL=https://getevaai.com
NEXT_PUBLIC_BACKEND_URL=https://api.getevaai.com

# Leave these empty for now - we'll fill them in next steps
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GOOGLE_VERIFICATION=
NEXT_PUBLIC_BING_VERIFICATION=
```

**⚠️ IMPORTANT:** Update `NEXT_PUBLIC_SITE_URL` to your actual production domain!

---

## 📊 **STEP 2: Google Analytics 4 (15 minutes)**

### Create GA4 Property

1. Go to [Google Analytics](https://analytics.google.com)
2. Click **Admin** (gear icon, bottom left)
3. Click **Create Property**
4. Fill in:
   - **Property name:** "Eva AI Marketing Site"
   - **Reporting time zone:** Your timezone
   - **Currency:** USD
5. Click **Next**
6. Fill in business details:
   - **Industry category:** Healthcare
   - **Business size:** Small (< 50)
7. Click **Create**
8. **Skip** the web stream setup (we'll do it manually)

### Get Measurement ID

1. In **Admin → Data Streams**
2. Click **Add stream → Web**
3. Enter:
   - **Website URL:** `https://getevaai.com`
   - **Stream name:** "Production"
4. Click **Create stream**
5. **Copy the Measurement ID** (format: `G-XXXXXXXXXX`)

### Add to Environment

```bash
# In .env.local
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # ← Paste your ID here
```

### Verify It Works

```bash
# Build and run locally
npm run build
npm run start

# Open in browser: http://localhost:3000
# Open Chrome DevTools → Network tab
# Filter: "google-analytics"
# You should see requests to analytics.google.com
```

✅ **Success:** If you see GA requests in Network tab, tracking works!

---

## 🔍 **STEP 3: Google Search Console (20 minutes)**

### Add Property

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click **Add Property**
3. Select **URL prefix**
4. Enter: `https://getevaai.com`
5. Click **Continue**

### Verify Ownership (Choose ONE method)

**Option A: DNS Verification (Recommended)**

1. GSC shows a TXT record like: `google-site-verification=abc123xyz`
2. Go to your DNS provider (Cloudflare, Namecheap, etc.)
3. Add TXT record:
   - **Name:** `@` (or leave blank)
   - **Value:** `google-site-verification=abc123xyz`
   - **TTL:** Automatic (or 3600)
4. Save DNS record
5. **Wait 5-10 minutes** for DNS propagation
6. Go back to GSC and click **Verify**

**Option B: HTML Meta Tag (Easier)**

1. GSC shows code like: `<meta name="google-site-verification" content="abc123" />`
2. Extract the content value: `abc123`
3. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_GOOGLE_VERIFICATION=abc123
   ```
4. Update `app/layout.tsx` to add this meta tag (see instructions below)
5. Deploy to production
6. Go back to GSC and click **Verify**

#### Adding HTML Meta Tag

Edit `frontend/marketing-site/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  // ... existing metadata ...
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
    // bing: process.env.NEXT_PUBLIC_BING_VERIFICATION, // Add later
  },
  // ...
};
```

Deploy and verify in GSC.

### Submit Sitemap

1. In Google Search Console
2. Click **Sitemaps** (left sidebar)
3. Enter: `sitemap.xml`
4. Click **Submit**

✅ **Success:** Sitemap shows "Success" status within 24 hours

---

## 🌐 **STEP 4: Bing Webmaster Tools (10 minutes)**

### Add Site

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Click **Add a site**
3. Enter: `https://getevaai.com`
4. Click **Add**

### Import from Google (Easy Way)

1. Click **Import from Google Search Console**
2. Authorize with same Google account
3. Select "Eva AI Marketing Site"
4. Click **Import**

✅ **Done!** Bing imports all settings from GSC.

### Submit Sitemap

1. Click **Sitemaps** (left menu)
2. Enter: `https://getevaai.com/sitemap.xml`
3. Click **Submit**

---

## 🎨 **STEP 5: Create OG Image (30 minutes)**

### Design Requirements

- **Size:** 1200 x 630 pixels
- **Format:** PNG or JPEG
- **Content:**
  - Eva AI logo
  - Tagline: "HIPAA-Compliant AI Receptionist"
  - Clean, professional design
  - Readable text at small sizes

### Tools (Choose One)

**Option A: Canva (Easiest)**
1. Go to [Canva](https://canva.com)
2. Search template: "Facebook Post" (1200x630)
3. Customize with Eva AI branding
4. Download as PNG

**Option B: Figma (Professional)**
1. Create 1200x630 artboard
2. Add Eva AI branding
3. Export as PNG @ 2x resolution

**Option C: Use Existing**
- Use the Eva AI logo + simple background
- Add text overlay with tagline

### Add to Project

```bash
# Save image as:
frontend/marketing-site/public/og-image.png

# Verify in constants.ts:
ogImage: "https://getevaai.com/og-image.png"
```

### Test Social Sharing

1. Deploy to production
2. Test on:
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - [Facebook Debugger](https://developers.facebook.com/tools/debug/)
   - [LinkedIn Inspector](https://www.linkedin.com/post-inspector/)

✅ **Success:** Image shows correctly on all platforms

---

## 📈 **STEP 6: Verify Everything Works (15 minutes)**

### Checklist

```bash
# 1. Analytics Tracking
□ Open site in incognito
□ Go to GA4 Realtime report
□ Verify you see 1 active user

# 2. Search Console
□ Check "URL Inspection" tool
□ Enter: https://getevaai.com
□ Should show "URL is on Google"

# 3. Sitemap
□ Visit: https://getevaai.com/sitemap.xml
□ Should see XML with all pages

# 4. Robots.txt
□ Visit: https://getevaai.com/robots.txt
□ Should see sitemap URL

# 5. Structured Data
□ Visit: https://search.google.com/test/rich-results
□ Enter: https://getevaai.com
□ Should detect Organization, Product, FAQs

# 6. Meta Tags
□ View page source
□ Verify <title>, <meta description>, <meta og:image>

# 7. Mobile Friendly
□ Visit: https://search.google.com/test/mobile-friendly
□ Enter: https://getevaai.com
□ Should pass mobile test
```

✅ **All green?** You're done with setup!

---

## 📝 **STEP 7: First Week Actions**

### Day 1-2: Content
- [ ] Write first blog post (2,000 words)
- [ ] Target keyword: "AI receptionist for medical spas"
- [ ] Publish to `/blog/ai-receptionist-for-medical-spas`

### Day 3-4: Link Building
- [ ] Submit to 5 directories:
  - [Capterra](https://capterra.com)
  - [G2](https://g2.com)
  - [Software Advice](https://softwareadvice.com)
  - [GetApp](https://getapp.com)
  - [HealthIT.gov](https://healthit.gov) (directory)

### Day 5: Social Sharing
- [ ] Share blog post on LinkedIn
- [ ] Share on Twitter
- [ ] Email to medical spa industry contacts

### Day 6-7: Monitor
- [ ] Check Google Search Console for indexing
- [ ] Review Google Analytics traffic
- [ ] Respond to any crawl errors

---

## 🎯 **Success Metrics (First 30 Days)**

| Metric | Target | How to Check |
|--------|--------|--------------|
| Pages indexed | 10+ | Google Search Console → Coverage |
| Organic sessions | 50+ | Google Analytics → Acquisition |
| Backlinks | 5+ | Google Search Console → Links |
| Blog posts | 4+ | Blog page count |
| Keywords tracking | 10+ | Manual tracker or Ahrefs |

---

## 🚨 **Common Issues**

### "Analytics not tracking"
**Check:**
- Is `NEXT_PUBLIC_GA_MEASUREMENT_ID` set?
- Did you deploy after adding it?
- Check browser console for errors
- Disable ad blockers

**Fix:**
```bash
# Verify env var is loaded
console.log(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
# Should output: G-XXXXXXXXXX
```

### "Search Console not verifying"
**Check:**
- DNS propagation (wait 1 hour)
- Meta tag is in `<head>` (view page source)
- Deployed to correct domain

**Fix:**
```bash
# Test DNS propagation
dig TXT getevaai.com

# Should show google-site-verification TXT record
```

### "Sitemap not found"
**Check:**
- Visit directly: https://getevaai.com/sitemap.xml
- Should return XML, not 404

**Fix:**
```bash
# Rebuild and deploy
npm run build
# Verify sitemap.xml exists in .next/server/app/
```

### "Structured data not detected"
**Check:**
- View page source
- Search for "application/ld+json"
- Should find Organization, Product schemas

**Fix:**
```bash
# Verify schemas are rendering
curl https://getevaai.com | grep "ld+json"
```

---

## 📚 **Next Steps**

After completing this quick start:

1. **Read:** [SEO_OPTIMIZATION_REPORT.md](/SEO_OPTIMIZATION_REPORT.md)
2. **Follow:** [SEO_MAINTENANCE_CHECKLIST.md](/SEO_MAINTENANCE_CHECKLIST.md)
3. **Review:** [SEO_SELF_ASSESSMENT.md](/SEO_SELF_ASSESSMENT.md)

---

## 🆘 **Need Help?**

**Common Resources:**
- [Google Search Console Help](https://support.google.com/webmasters)
- [Google Analytics Help](https://support.google.com/analytics)
- [Next.js Metadata Docs](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)

**Check These First:**
1. Environment variables loaded? (`console.log` them)
2. Deployed to production? (not just local)
3. Waited 24 hours? (indexing takes time)

---

**Estimated Time:** 2 hours total
**Difficulty:** ⭐⭐☆☆☆ (Easy)
**Impact:** ⭐⭐⭐⭐⭐ (Critical)

✅ **Completion means:** Site is tracked, indexed, and ready to rank!
