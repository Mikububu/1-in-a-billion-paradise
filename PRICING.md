# Pricing Configuration

## 🎯 Single Variable Pricing

**All prices are derived from ONE variable: `NUCLEAR_PRICE`**

Location: `1-in-a-billion-frontend/src/config/products.ts`

```typescript
export const NUCLEAR_PRICE = 108; // Change ONLY this to adjust all prices
```

---

## 📊 Pricing Logic

### The Math

```
Nuclear Package = 16 API calls (10 individual + 5 overlay + 1 verdict)
Nuclear is sold at 50% off

$108 = 16 × single_price × 0.50
$108 = 8 × single_price
single_price = $108 / 8 = $13.50 (rounded to $14)
```

### Product Calculations

| Product | API Calls | Formula | Price |
|---------|-----------|---------|-------|
| **single_system** | 1 | `base_price` | $14 |
| **complete_reading** | 5 | `5 × base × 50%` | $34 |
| **compatibility_overlay** | 3 | `3 × base` (no discount) | $41 |
| **nuclear_package** | 16 | `16 × base × 50%` | $108 |

### Discounts

- **50% off** for bundles: `complete_reading` and `nuclear_package`
- **No discount** for single purchases: `single_system` and `compatibility_overlay`

---

## 📦 Product Specifications

### Content Per API Call
- **Audio**: 13 minutes
- **Pages**: 5 pages  
- **Words**: 2,000 words

### Full Product Details

| Product | API Calls | Pages | Audio | Full Price | Discounted | Savings |
|---------|-----------|-------|-------|------------|------------|---------|
| single_system | 1 | 5 | 13 min | $14 | $14 | - |
| complete_reading | 5 | 25 | 1h 5m | $70 | **$34** | $36 |
| compatibility_overlay | 3 | 15 | 39 min | $41 | $41 | - |

---

## ✅ Overlay vs Nuclear Verdict (Product Contract)

### **compatibility_overlay (synastry job)**
- **Docs**: 3 (per selected system)
  - Person 1
  - Person 2
  - Overlay (synastry)
- **Final Verdict**: **NO** (verdict is cross-system synthesis, not part of single-system overlay)

### **nuclear_package (nuclear_v2 job)**
- **Docs**: 16 total
  - 5 systems × (Person 1 + Person 2 + Overlay) = 15
  - + **1 Final Verdict** (synthesizes across all 5 systems)
| nuclear_package | 16 | 100 | 3h 28m | $224 | **$108** | $116 |

---

## 🔄 How to Change Prices

### Example: Increase Nuclear to $150

1. Open `1-in-a-billion-frontend/src/config/products.ts`
2. Change: `export const NUCLEAR_PRICE = 150;`
3. All prices auto-update:

| Product | Old Price | New Price |
|---------|-----------|-----------|
| single_system | $14 | $19 |
| complete_reading | $34 | $47 |
| compatibility_overlay | $41 | $56 |
| nuclear_package | $108 | $150 |

### Example: Decrease Nuclear to $80

| Product | Old Price | New Price |
|---------|-----------|-----------|
| single_system | $14 | $10 |
| complete_reading | $34 | $25 |
| compatibility_overlay | $41 | $30 |
| nuclear_package | $108 | $80 |

---

## 📱 Where Prices Are Displayed

All screens automatically pull from `products.ts`:

- `SystemSelectionScreen.tsx` (Screen 22) - Product cards with prices
- `SystemExplainerScreen.tsx` (Screen 24) - CTA button with price
- `PurchaseScreen.tsx` - Purchase flow
- `TermsOfServiceScreen.tsx` - Legal terms (static, update manually)
- `ExtendedReadingScreen.tsx` - Legacy reading screen

---

## ⚠️ Manual Updates Required

When changing `NUCLEAR_PRICE`, also update:

1. **TermsOfServiceScreen.tsx** - Update the "Available Products" section
2. **App Store** - Update in-app purchase prices in App Store Connect

---

## 🧮 Quick Reference Formula

```
NUCLEAR_PRICE = X

single_price      = X / 8
complete_price    = X / 8 × 5 × 0.5  = X × 0.3125
overlay_price     = X / 8 × 3        = X × 0.375
nuclear_price     = X
```

| If NUCLEAR = | Single | Complete | Overlay | Nuclear |
|--------------|--------|----------|---------|---------|
| $80 | $10 | $25 | $30 | $80 |
| $100 | $13 | $31 | $38 | $100 |
| $108 | $14 | $34 | $41 | $108 |
| $120 | $15 | $38 | $45 | $120 |
| $150 | $19 | $47 | $56 | $150 |
| $200 | $25 | $63 | $75 | $200 |
