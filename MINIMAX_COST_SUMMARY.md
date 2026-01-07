# MiniMax Music Generation - Cost Summary

## Pricing

**Cost per 3-minute song: ~$0.0825**

- **1 credit = 1 song** (regardless of length)
- **120 credits = $9.90**
- **Credits do not expire**
- **Commercial use rights included**

## Cost Breakdown

### Per Song
- **Lyrics Generation (DeepSeek)**: ~$0.001-0.01 (minimal, text generation)
- **Song Generation (MiniMax)**: ~$0.0825 (1 credit)
- **Storage (Supabase)**: ~$0.0001 (negligible)
- **Total per song**: ~**$0.08-0.09**

### Monthly Estimates

**Low Volume (10 songs/month)**
- Cost: ~$0.83/month
- Very affordable for testing

**Medium Volume (100 songs/month)**
- Cost: ~$8.25/month
- Still very reasonable

**High Volume (1000 songs/month)**
- Cost: ~$82.50/month
- Bulk pricing may be available

## ROI Analysis

### User Value
- Personalized song based on deep soul reading
- Unique, emotional, intimate experience
- Shareable, downloadable
- High perceived value

### Pricing Strategy
- Can charge $5-20 per deep reading (includes song)
- Song cost is ~$0.08
- **High margin feature** that differentiates the product

## Recommendations

1. **Start with all users** (test phase)
   - Low cost allows testing without restrictions
   - Gather feedback on quality and value

2. **Move to paid-only** (production)
   - Only generate for users who purchase deep readings
   - Add `isPaidUser` check in job creation

3. **Monitor usage**
   - Track song generation costs
   - Set monthly budget limits if needed
   - Alert if costs exceed threshold

4. **Optimize if needed**
   - Cache lyrics for similar readings
   - Batch process songs during off-peak hours
   - Consider shorter songs (2 minutes) to reduce cost

## Cost Control

### Current Implementation
- Song generation only for `nuclear_v2` jobs
- Can be disabled with `includeSong: false`
- Worker processes one song at a time (rate limiting)

### Future Enhancements
- Add paid user check before creating song task
- Add cost tracking in database
- Add admin dashboard for cost monitoring
- Set per-user or per-month limits

## Conclusion

**MiniMax music generation is extremely cost-effective at ~$0.08 per song.**

This is a high-value, low-cost feature that can significantly differentiate the product and justify premium pricing for deep readings.

