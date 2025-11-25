# Eva AI Design System
**Version 2.0** | Last Updated: November 2025

---

## Brand Identity

**Essence**: AI Clinical Lux — Modern, warm-tech identity for AI med-spa software.
**Tone**: Professional, trustworthy, calming, sophisticated, intelligent.
**Voice**: Clear, confident, supportive, cutting-edge.

---

## Color System: "AI Clinical Lux"

A unified, modern palette blending clinical trust with AI vitality.

### Primary (Core Brand Colors)
*Main brand colors for logo, CTA buttons, gradients, hero sections.*

**Primary 1: Hybrid Azure-Cyan**
`#0EA5E9`
- Signals AI precision, trust, and modernity.
- Usage: Primary actions, active states.

**Primary 2: Teal-Tech Glow**
`#14B8A6`
- Adds vibrancy without skewing too "wellness-y".
- Usage: Brand gradients, vitality indicators.

### Secondary (UI, Highlights, Depth)
*Brings depth and hierarchy for secondary actions, data viz, icons.*

**Secondary 1: Deep Clinical Blue**
`#0369A1`
- Balances bright primaries with a trustworthy base.
- Usage: Headings, authoritative UI elements.

**Secondary 2: Emerald Tech**
`#0D9488`
- Pairs with teal-hybrid primary.
- Usage: Gradient transitions, depth.

### Accent (Energy & Feedback)
*Use sparingly for microinteractions, success states, subtle embellishments.*

**Accent 1: Sky Blue Pulse**
`#38BDF8`
- Usage: Motion, gradients, glow effects.

**Accent 2: Aqua Electric**
`#22D3EE`
- Bridges the blue–teal spectrum.
- Usage: Distinctive AI signature glow.

**Accent 3: Soft Aqua Glow**
`#A5F3FC`
- Usage: Soft backgrounds, cards, clinical UI clarity.

### Neutrals (Foundation)
*Blend of cool, modern tech neutrals + clinical whites.*

**Neutral 1: Ultra Black / Navy Hybrid**
`#0F172A`
- Usage: Dark mode primary, high-contrast text.

**Neutral 2: Steel Blue Gray**
`#1E293B`
- Usage: Muted backgrounds, shadows, secondary text.

### Backgrounds (Clean, Clinical, Breathable)
*App backgrounds, cards, surfaces.*

**Background 1: Soft Cloud White**
`#F8FAFC`
- Usage: Main app background — clinical but not sterile.

**Background 2: Mint White**
`#F0FDFA`
- Usage: Subtle teal-infused white for sections needing personality.

**Background 3: Pure White**
`#FFFFFF`
- Usage: High-contrast hero sections, cards, print.

### Recommended Gradients
1. **AI Clinical Glow**: `#0EA5E9` → `#14B8A6`
2. **Aqua Pulse**: `#38BDF8` → `#22D3EE`
3. **Deep Tech Calm**: `#0369A1` → `#0D9488`

---

## Semantic Colors

**Success**: `#10B981` (Emerald 500)
- Use for: Success messages, completed states, positive metrics.

**Warning**: `#F59E0B` (Amber 500)
- Use for: Warning messages, attention needed, caution states.

**Error**: `#EF4444` (Red 500)
- Use for: Error messages, destructive actions, critical alerts.

---

## Typography

### Font Families
```css
--font-sans: "Inter", system-ui, -apple-system, sans-serif;
--font-display: "DM Sans", "Inter", sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", Consolas, monospace;
```

### Type Scale
| Name | Size | Weight | Usage |
|------|------|--------|-------|
| Display XL | 60px | 700 | Hero headlines |
| Display LG | 48px | 700 | Section headlines |
| H1 | 36px | 700 | Page headings |
| H2 | 24px | 600 | Section headings |
| H3 | 18px | 600 | Card titles |
| Body | 14px | 400 | Default text |
| Caption | 12px | 500 | Labels |

---

## Spacing System
Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| 1 | 4px | Tight |
| 2 | 8px | Small |
| 4 | 16px | Medium (Base) |
| 6 | 24px | Large |
| 8 | 32px | X-Large |
| 12 | 48px | Section Gap |

---

## Component Guidelines

### Buttons
- **Primary**: Gradient 1 ("AI Clinical Glow") or Primary 1 Solid.
- **Secondary**: White bg with Neutral 2 border.
- **Radius**: `8px` (rounded-md) or `12px` (rounded-lg) for larger actions.

### Cards
- **Bg**: Pure White (`#FFFFFF`) or Soft Cloud White (`#F8FAFC`).
- **Border**: Zinc 200 or Soft Aqua Glow (`#A5F3FC`) for emphasis.
- **Shadow**: Soft, diffused shadows using Navy Hybrid at low opacity.
- **Glass**: Used for overlays and floating panels.

### Stat Cards
- **Active/Trend**: Use "Aqua Electric" or "Teal-Tech Glow" for positive trends.
- **Sparklines**: Gradient 2 ("Aqua Pulse").

---

## Usage Guidelines

### Implementation Note
To implement this system:
1.  **Tailwind Configuration**: Map these hex codes to Tailwind color variables (e.g., `primary`, `secondary`, `accent`).
2.  **Globals.css**: Update CSS variables to reflect these specific hex values converted to OKLCH or RGB for Tailwind v4 compatibility.

### Consistency Rules
1.  **Gradients**: Use "AI Clinical Glow" for the most prominent calls to action (CTAs).
2.  **Text Contrast**: Use "Ultra Black" (`#0F172A`) for main headings on light backgrounds.
3.  **Backgrounds**: Default to "Soft Cloud White" (`#F8FAFC`) for the main app canvas to maintain the "Clinical Lux" feel.
