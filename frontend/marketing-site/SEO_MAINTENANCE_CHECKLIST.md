# SEO Maintenance Checklist for Eva AI Marketing Site

**Purpose:** Ensure ongoing SEO health and continuous improvement
**Frequency:** Daily, Weekly, Monthly, Quarterly reviews
**Owner:** Marketing/SEO Team

---

## 🔴 **DAILY (5 minutes)**

### Monitoring
- [ ] Check Google Search Console for critical errors (crawl errors, security issues)
- [ ] Verify site is accessible (https://getevaai.com loads)
- [ ] Check Google Analytics for unusual traffic drops (> 20% decrease)

### Quick Checks
```bash
# Site is online
curl -I https://getevaai.com

# Sitemap is accessible
curl https://getevaai.com/sitemap.xml | grep "<url>"
```

**If any errors:** Investigate immediately - could be hosting, DNS, or code issues

---

## 🟡 **WEEKLY (30 minutes)**

### Content Publishing
- [ ] Publish 1 new blog post (minimum 1,500 words)
  - Target keywords from research
  - Include 3-5 internal links to product pages
  - Add 2-3 images with optimized alt text
  - Share on social media after publishing

### Analytics Review
- [ ] Review Google Analytics organic traffic trends
- [ ] Check top 10 landing pages performance
- [ ] Review conversion rates (demo bookings, contact forms)
- [ ] Identify top performing blog posts

### Search Console Check
- [ ] Review new search queries ranking
- [ ] Check average position changes
- [ ] Fix any new crawl errors
- [ ] Monitor mobile usability issues

### Link Building
- [ ] Respond to 3-5 HARO queries ([Help A Reporter Out](https://www.helpareporter.com/))
- [ ] Reach out to 2-3 industry blogs for guest posting
- [ ] Check for new backlinks via Google Search Console

**Template for Weekly Report:**
```
Week of [Date]:
- Blog posts published: [Number]
- Organic sessions: [Number] (% change)
- New keywords ranking: [Number]
- Demo bookings from organic: [Number]
- New backlinks: [Number]
```

---

## 🟢 **MONTHLY (2 hours)**

### Performance Audit
- [ ] Run Lighthouse audit on 5 key pages:
  ```bash
  npm run build && npm run start
  # Run Lighthouse in Chrome DevTools on:
  # - Homepage, Features, Pricing, Blog, Top Blog Post
  ```
- [ ] Check Core Web Vitals in Search Console
- [ ] Review page speed trends (target: < 3s load time)

### Content Review
- [ ] Update 1-2 old blog posts with fresh information
- [ ] Add new internal links to recent posts
- [ ] Check for broken links (use [Broken Link Checker](https://www.brokenlinkcheck.com/))
- [ ] Review and update FAQ schema if new questions emerge

### Keyword Research
- [ ] Identify 5-10 new keyword opportunities
- [ ] Analyze competitor content for gaps
- [ ] Create content calendar for next month
- [ ] Update keyword tracking spreadsheet

### Technical SEO
- [ ] Verify all pages are indexed (Google Search Console)
- [ ] Check robots.txt is correct
- [ ] Validate structured data: [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Review sitemap for accuracy
- [ ] Check canonical URLs are correct

### Analytics Deep Dive
- [ ] Export top 50 search queries
- [ ] Analyze bounce rate by landing page
- [ ] Review user flow through site
- [ ] Check mobile vs desktop performance
- [ ] Identify underperforming pages for optimization

**Template for Monthly Report:**
```markdown
## Monthly SEO Report - [Month Year]

### Traffic
- Organic sessions: [Number] (+/- X% vs last month)
- Organic demo bookings: [Number] (+/- X%)
- Pages per session: [Number]
- Avg session duration: [Time]

### Rankings
- Keywords in top 10: [Number] (+/- X)
- Keywords in top 20: [Number] (+/- X)
- Featured snippets: [Number]

### Content
- Blog posts published: [Number]
- Total blog posts: [Number]
- Average blog post views: [Number]

### Links
- New backlinks: [Number]
- Total backlinks: [Number]
- Referring domains: [Number]
- Domain Authority: [Number] (+/- X)

### Technical
- Indexed pages: [Number]
- Crawl errors: [Number]
- Core Web Vitals pass rate: [XX%]
- Mobile usability errors: [Number]

### Next Month Goals
- Target keywords: [List 3-5]
- Content topics: [List 3-5]
- Backlink targets: [Number]
```

---

## 🔵 **QUARTERLY (1 day)**

### Comprehensive Audit
- [ ] Full technical SEO audit with Screaming Frog
- [ ] Competitor analysis (rankings, backlinks, content)
- [ ] Keyword opportunity assessment
- [ ] Content performance deep dive
- [ ] Backlink quality audit
- [ ] Schema markup validation
- [ ] Site architecture review

### Strategy Review
- [ ] Analyze what worked vs. what didn't
- [ ] Adjust keyword strategy based on data
- [ ] Review and update buyer personas
- [ ] Identify new content opportunities
- [ ] Plan next quarter's content calendar

### Major Updates
- [ ] Update all outdated blog posts (> 6 months old)
- [ ] Refresh homepage copy based on performance
- [ ] Optimize top 10 landing pages
- [ ] Review and improve meta descriptions
- [ ] Update OG images if needed

### Link Building Campaign
- [ ] Create new linkable asset (guide, infographic, study)
- [ ] Outreach to 50+ relevant sites
- [ ] Follow up on previous outreach
- [ ] Analyze competitor backlinks for opportunities

### Tools & Automation
- [ ] Review and optimize Google Ads (if running)
- [ ] Set up new Google Analytics goals
- [ ] Create new Google Data Studio reports
- [ ] Update rank tracking keywords

**Quarterly Goals Template:**
```markdown
## Q[X] [Year] SEO Goals

### Traffic Goals
- Organic sessions: [Target number]
- YoY growth: [XX%]
- Demo bookings: [Target number]

### Ranking Goals
- [Keyword 1]: Top 10
- [Keyword 2]: Top 10
- [Keyword 3]: Top 20

### Content Goals
- Publish [X] blog posts
- Update [X] old posts
- Create [X] pillar pages

### Link Building Goals
- Acquire [X] backlinks
- Increase DA to [X]
- Get featured in [X] publications
```

---

## 🟣 **AD-HOC: When Launching New Features/Pages**

### New Page Launch Checklist
- [ ] Page title optimized (50-60 chars)
- [ ] Meta description compelling (150-160 chars)
- [ ] H1 tag includes primary keyword
- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] Images have descriptive alt text
- [ ] Internal links added from 3+ existing pages
- [ ] Canonical URL set correctly
- [ ] Open Graph tags configured
- [ ] Structured data added (if applicable)
- [ ] Mobile responsive verified
- [ ] Page speed < 3s verified
- [ ] Added to sitemap (auto-generated)
- [ ] Submitted to Search Console for indexing

### New Blog Post Checklist
- [ ] Keyword research completed
- [ ] Content outline created
- [ ] 1,500+ words written
- [ ] 3-5 internal links to product pages
- [ ] 2-3 external links to authoritative sources
- [ ] Images optimized (WebP, proper alt text)
- [ ] Meta description written
- [ ] Article schema added
- [ ] Social media preview verified
- [ ] Published and shared on social
- [ ] Submitted to Search Console

---

## 🔧 **TOOLS REQUIRED**

### Free Tools
- ✅ [Google Search Console](https://search.google.com/search-console) - Crawl errors, rankings
- ✅ [Google Analytics 4](https://analytics.google.com) - Traffic analysis
- ✅ [Google PageSpeed Insights](https://pagespeed.web.dev/) - Performance
- ✅ [Google Rich Results Test](https://search.google.com/test/rich-results) - Schema validation
- ✅ [Broken Link Checker](https://www.brokenlinkcheck.com/) - Find broken links
- ✅ [HARO](https://www.helpareporter.com/) - PR opportunities

### Paid Tools (Recommended)
- 💰 [Ahrefs](https://ahrefs.com) or [SEMrush](https://semrush.com) - $99-199/month
  - Keyword research, competitor analysis, backlink monitoring
- 💰 [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/) - $259/year
  - Comprehensive technical audits

### Optional Tools
- [Microsoft Clarity](https://clarity.microsoft.com) - Free heatmaps
- [Hotjar](https://www.hotjar.com/) - User behavior tracking
- [Ubersuggest](https://neilpatel.com/ubersuggest/) - Keyword research

---

## 🚨 **CRITICAL ALERTS**

### Set Up Alerts for These Issues:
1. **Site Down** - UptimeRobot or Pingdom
   - Alert if site is unreachable > 5 minutes

2. **Traffic Drop > 20%** - Google Analytics
   - Email alert for sudden traffic drops

3. **Crawl Errors** - Google Search Console
   - Email notifications for new errors

4. **Manual Actions** - Google Search Console
   - Immediate alert for penalties

5. **Core Web Vitals Failing** - Search Console
   - Alert if LCP, FID, or CLS fail thresholds

---

## 📊 **KPIs TO TRACK**

### Primary Metrics
| Metric | Current | 3 Mo Goal | 6 Mo Goal | 12 Mo Goal |
|--------|---------|-----------|-----------|------------|
| Organic Sessions | [X] | 1,500 | 5,000 | 15,000 |
| Keywords in Top 10 | [X] | 5 | 15 | 30 |
| Demo Bookings | [X] | 10 | 30 | 100 |
| Backlinks | [X] | 15 | 40 | 100 |
| Domain Authority | [X] | 15 | 25 | 35 |

### Secondary Metrics
- Bounce rate (target: < 60%)
- Pages per session (target: > 2.5)
- Avg session duration (target: > 2 min)
- Organic CTR (target: > 3%)
- Featured snippets (target: 5+)

---

## 💡 **OPTIMIZATION PRIORITIES**

### Always Prioritize (80/20 Rule):

**High Impact, Low Effort:**
1. Fix crawl errors immediately
2. Optimize existing top-performing content
3. Add internal links to new content
4. Update meta descriptions on high-traffic pages
5. Fix broken links

**High Impact, Medium Effort:**
1. Write new blog posts targeting buyer keywords
2. Earn backlinks from industry sites
3. Optimize Core Web Vitals
4. Create new pillar pages
5. Update old content (> 1 year)

**High Impact, High Effort:**
1. Comprehensive site redesign
2. Create 10+ pillar content pieces
3. Large-scale link building campaign
4. Launch multilingual versions
5. Build custom SEO tools

**Low Priority (Unless Specific Issue):**
1. Tweaking meta keywords (not a ranking factor)
2. Over-optimizing for one keyword
3. Minor text changes on low-traffic pages
4. Obsessing over exact keyword density

---

## ✅ **MONTHLY CHECKLIST (COPY THIS)**

```
[ ] Week 1: Publish blog post, HARO responses, GSC check
[ ] Week 2: Publish blog post, guest post outreach, analytics review
[ ] Week 3: Publish blog post, update old content, broken link check
[ ] Week 4: Publish blog post, Lighthouse audit, monthly report

Analytics:
[ ] Organic sessions: ____
[ ] Demo bookings: ____
[ ] Top keywords: ____
[ ] New backlinks: ____

Actions for Next Month:
1. ____
2. ____
3. ____
```

---

## 📞 **WHO TO CONTACT**

| Issue | Contact | Action |
|-------|---------|--------|
| Site down | DevOps/Hosting | Check Railway/Vercel status |
| Crawl errors | Developer | Review recent code changes |
| Content questions | Content team | Review content calendar |
| Analytics issues | Marketing | Verify GA4 configuration |
| Manual penalty | SEO specialist | Submit reconsideration request |

---

## 📚 **RESOURCES**

- [SEO Optimization Report](/SEO_OPTIMIZATION_REPORT.md) - Full implementation details
- [SEO Self-Assessment](/SEO_SELF_ASSESSMENT.md) - Grading and gaps
- [Google Search Console Help](https://support.google.com/webmasters)
- [Google Analytics Help](https://support.google.com/analytics)
- [Moz SEO Guide](https://moz.com/beginners-guide-to-seo)

---

**Last Updated:** January 23, 2025
**Next Review:** April 23, 2025
