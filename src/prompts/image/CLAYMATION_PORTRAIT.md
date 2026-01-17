# CLAYMATION PORTRAIT TRANSFORMATION

## Purpose
Transform user portrait photographs into handcrafted analog claymation sculptures for privacy-preserving profile images in the matching system.

## OpenAI DALL-E 3 / GPT-4o Vision Prompt

### Image Transformation Prompt

```
Transform the input portrait photograph into a handcrafted analog claymation and collage sculpture aesthetic.

The subject must appear as a physically sculpted clay figure with realistic human proportions and a serious contemplative presence.

All surfaces should be matte and tactile, showing:
- Finger marks
- Rough material edges
- Slight asymmetry
- Handcrafted imperfections

Use soft directional lighting that creates warm natural shadows and emphasizes physical depth and texture.

The overall look must feel fully analog and handmade using the visual language of:
- Clay
- Carved plaster
- Linoleum collage
- Aged paper

AVOID:
- Any digital smoothness
- Gloss
- Airbrushing
- Typography
- Symbols
- Text
- Borders
- Stamps
- Graphic elements

The image should feel like a photographed physical sculpture rather than a digital illustration, grounded in a philosophical artisanal and material driven aesthetic.

Maintain the subject's:
- Facial structure
- Expression
- General appearance
- Hair style and color
- Distinctive features

But render everything as if hand-sculpted from clay and photographed in a studio.
```

## Technical Implementation

### API: OpenAI Image Edit / DALL-E 3

**Endpoint**: `POST https://api.openai.com/v1/images/edits` (for image-to-image)
or use GPT-4o Vision to describe + DALL-E 3 to generate

### Recommended Approach: Two-Step Process

1. **Step 1: Analyze with GPT-4o Vision**
   - Send the original photo
   - Get a detailed description of the person's features
   - Extract: face shape, hair, expression, distinctive features

2. **Step 2: Generate with DALL-E 3**
   - Use the description + claymation prompt
   - Generate a 1024x1024 claymation portrait

### Output Specifications

- **Size**: 1024x1024 pixels (square)
- **Format**: PNG
- **Quality**: HD
- **Style**: Natural (no vivid enhancement)

## Privacy Benefits

1. **Not a real photo** - Protects user privacy
2. **Artistic interpretation** - Unique and memorable
3. **Consistent aesthetic** - All profiles look cohesive
4. **Recognizable but protected** - Captures essence without exposing identity

## Cost Estimate

- GPT-4o Vision analysis: ~$0.01-0.02 per image
- DALL-E 3 generation: ~$0.04-0.08 per image (HD)
- **Total**: ~$0.05-0.10 per claymation portrait

## Storage

Claymation portraits stored in:
- **Bucket**: `profile-images`
- **Path**: `{user_id}/claymation.png`
- **Also stored in**: `library_people.claymation_url`
