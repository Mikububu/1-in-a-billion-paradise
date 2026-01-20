# Quick PDF Reference - Instant Lookup

**Change ANY PDF property in ONE place → Updates ALL PDFs**

📁 **Main Config File:** `src/config/pdfConfig.ts`

---

## 🎨 Common Changes

### Change Body Text Font Size
```typescript
// Line 33
body: 8.5,  // ALL PDFs updated (was 9.5)
```
**User requested:** "Text is too big"  
**Solution:** Change ONE number → All PDFs shrink

---

### Change Footer Content ✅ TESTED
```typescript
// Lines 56-70
footer: {
  content: {
    website: 'http://1-in-a-billion.app/',
    publisher: {
      name: 'SwiftBuy Solutions LLC',
      address: 'Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.',
    },
    poweredBy: 'forbidden-yoga.com',
    creator: 'Michael Wogenburg',
  },
}
```
**What this controls:**
- Footer text on EVERY PDF
- Publisher info
- Website link
- Creator attribution

**Change website?** Edit `website: 'http://...'`  
**Change address?** Edit `publisher.address: '...'`  
**Hide footer entirely?** Set `show: false` on line 52

---

### Hide PDF Headers
```typescript
// Line 64
header: {
  show: false,  // Headers removed from ALL PDFs
}
```

---

### Change PDF Colors
```typescript
// Lines 40-45
colors: {
  primary: '#1a1a1a',      // Main text color
  secondary: '#666666',    // Secondary text
  accent: '#C4A484',       // Gold accent
  divider: '#E5E5E5',      // Lines/borders
}
```

---

### Adjust Spacing
```typescript
// Lines 50-54
spacing: {
  paragraphGap: 12,   // Space between paragraphs
  sectionGap: 24,     // Space between sections
  chapterGap: 36,     // Space at chapter start
  lineHeight: 1.5,    // Line spacing multiplier
}
```

---

### Change All Font Sizes
```typescript
// Lines 28-37
fonts: {
  title: 24,           // Main title
  chapterTitle: 18,    // Chapter headings
  sectionHeading: 14,  // Section headings
  subheading: 12,      // Subheadings
  body: 9.5,          // 👈 MOST IMPORTANT (body text)
  metadata: 9,         // Birth data, etc.
  caption: 8,          // Image captions
  footer: 8,           // Footer text
}
```

---

## 📋 System Names

📁 `src/config/systemConfig.ts`

### Add New System
```typescript
// Lines 20-60
new_system: {
  slug: 'new_system',
  displayName: 'New System Name',
  shortName: 'Short',
  description: 'Description here',
  icon: '✨',
}
```

---

## 🎯 Person Logic (person1/person2/overlay)

📁 `src/config/docTypeResolver.ts` (lines 50-90)

**Don't edit directly** unless changing core logic.  
See `docs/CENTRALIZATION_GUIDE.md` for details.

---

## 🧪 Test Example (Footer)

**Before centralization:**
- Footer text scattered in 3 different files
- Had to find each instance manually
- Easy to miss one → inconsistent footers

**After centralization:**
```typescript
// src/config/pdfConfig.ts line 60
website: 'http://NEW-SITE.com/',  // Changed website
```
✅ **Result:** ALL PDFs show new website instantly

---

## 📖 Full Documentation

- **Centralization Guide:** `docs/CENTRALIZATION_GUIDE.md`
- **Config Directory:** `src/config/README.md`
- **Critical Rules:** `docs/CRITICAL_RULES_CHECKLIST.md`

---

## 💡 Pro Tips

1. **Always use helpers instead of raw values:**
   ```typescript
   // ❌ Bad
   doc.fontSize(9.5)
   
   // ✅ Good
   doc.fontSize(fontSize('body'))
   ```

2. **Test config changes locally first:**
   ```bash
   npm run dev
   # Generate a test PDF
   # Check if footer looks correct
   ```

3. **Config changes are code changes:**
   - Commit them to git
   - Deploy to update production PDFs

---

**Last Updated:** 2026-01-20  
**Maintainer:** Michael / AI Agent
