# PDF Style Guide - 1 in a Billion

## Final Approved Layout (January 2026)

### Page Setup
- **Size**: A4 (595.28 x 841.89 points)
- **Margins**: 
  - Top: 120pt
  - Bottom: 120pt
  - Left: 100pt
  - Right: 100pt

### Typography
- **Font**: EB Garamond (serif)
- **Title**: 18pt, centered
- **Timestamp**: 10pt, centered (below title)
- **Body text**: 11pt, justified (block)
- **Appendix**: 10pt, left-aligned
- **Page numbers**: 10pt, centered at bottom

### Structure

#### First Page
1. **Title** - Centered, 18pt Garamond
   - Format: "System Name - Person Name"
   - Example: "Vedic Astrology (Jyotish) - Akasha"

2. **Timestamp** - Centered, 10pt Garamond
   - Format: "Month Day, Year"
   - Example: "January 20, 2026"

3. **Portrait Image** - Full content width with rounded corners
   - Width: Same as text width (page width - left margin - right margin)
   - Corner radius: 20pt
   - Spacing: 20pt above, 20pt below
   - Shows couple image if available, otherwise solo portrait

4. **Body Text** - Justified, 11pt Garamond
   - Reading content flows naturally with page breaks

#### Subsequent Pages
- Body text continues (justified, 11pt)
- No header repetition
- Page numbers at bottom center

#### Last Page
- Body text ends
- **Appendix** (left-aligned, 10pt):
  ```
  1-in-a-billion.app

  Published by:
  SwiftBuy Solutions LLC
  Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.

  powered by: forbidden-yoga.com
  Program idea and concept: Michael Wogenburg
  ```

### Page Numbers
- Appear on every page
- Centered at bottom (60pt from page bottom)
- 10pt Garamond

### Image Handling
- Portrait/couple images fetched from Supabase storage
- Couple image takes priority over solo portrait
- Rendered with rounded corners (20pt radius)
- Clipped to rounded rectangle shape
- Full content width

### Code Reference
The PDF generator is located at:
```
1-in-a-billion-backend/src/services/pdf/pdfGenerator.ts
```

### Key Settings Summary
```typescript
// Page
size: 'A4'
margins: { top: 120, bottom: 120, left: 100, right: 100 }

// Fonts
title: 'Garamond', 18pt, centered
timestamp: 'Garamond', 10pt, centered
body: 'Garamond', 11pt, justified
appendix: 'Garamond', 10pt, left
pageNumber: 'Garamond', 10pt, centered

// Image
width: page.width - 200 (full content width)
cornerRadius: 20pt
spacing: 20pt above and below
```
