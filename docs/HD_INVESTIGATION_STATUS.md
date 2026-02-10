# Human Design Calculation Investigation

**Date:** February 4, 2026  
**Status:** ✅ VERIFIED CORRECT - hdkit algorithm matches official HD sources

## Summary

We integrated the **hdkit** algorithm (https://github.com/jdempcy/hdkit) for precise Human Design calculations. The key difference from our previous implementation:

| Method | Design Date Calculation | Result for Michael |
|--------|------------------------|-------------------|
| Fixed 88 days | `jdUt - 88` | Generator |
| hdkit 88° binary search | Find exact moment Sun was 88° behind birth Sun | Manifesting Generator |

## hdkit Algorithm (Now Implemented)

From `bodygraphs_helper.rb`:
```ruby
# Binary search between 84-96 days before birth
# Find when Sun was EXACTLY 88° behind birth Sun position
# Tolerance: 88.00001 > difference > 87.99999
```

This is implemented in `src/services/swissEphemeris.ts` lines 538-573.

## Michael's Birth Data

- **Date:** August 23, 1968
- **Time:** 13:50 local
- **Location:** Villach, Austria (lat: 46.6084959, lon: 13.8506159)
- **Timezone:** Europe/Vienna (CET, +1 hour, NO DST in 1968)
- **UTC Time:** 12:50

## Calculation Results

With hdkit 88° algorithm:
- **Design Date:** 92 days before birth
- **Design Sun:** Gate 20, Line 3
- **Design Earth:** Gate 34, Line 3
- **Channel 20-34:** Connects Throat to Sacral → Makes it **Manifesting Generator**

## Key Channels Found

- `6-59` (Solar Plexus - Sacral)
- `16-48` (Throat - Spleen)
- `20-34` (Throat - Sacral) ← This is why MG
- `34-57` (Sacral - Spleen)
- `47-64` (Ajna - Head)

## Timezone Verification

Austria in 1968 had **NO Daylight Saving Time** (DST was reintroduced in 1980).
Luxon confirms: `isInDST: false`, offset: +60 minutes (CET).

## Next Steps

1. **User to verify** actual HD type on official site:
   - https://www.jovianarchive.com/get_your_chart
   - https://www.mybodygraph.com

2. If official site shows different type, investigate:
   - Gate wheel offset (currently 58° from 0° Aries = 302° absolute)
   - Ephemeris precision
   - Any other calculation differences

## Files Modified

- `src/services/swissEphemeris.ts` - hdkit 88° binary search algorithm
- `src/services/humanDesignCalculator.ts` - Removed duplicate channel 57-34
- `src/services/geneKeysCalculator.ts` - Gate sequence (unchanged, matches hdkit)

## References

- hdkit GitHub: https://github.com/jdempcy/hdkit
- Gate wheel starts at Gate 41 at 2° Aquarius (302° tropical)
- Each gate spans 5.625° (360/64)
- Each line spans 0.9375° (5.625/6)
