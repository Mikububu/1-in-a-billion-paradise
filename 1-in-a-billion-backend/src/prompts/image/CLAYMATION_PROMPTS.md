# Claymation Portrait Generation - Complete Prompt

Single unified prompt sent directly to Google AI Studio for image-to-image transformation.

---

## Google AI Studio Image Generation

**Model:** `gemini-2.0-flash-exp-image-generation`  
**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent`

### Prompt Sent:

```
Transform this portrait into a professional claymation style (like Wallace & Gromit or Shaun the Sheep). Focus on tactile clay textures, visible fingerprints, and expressive clay-like features. White background.
```

### Full Request:

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Transform this portrait into a handcrafted claymation sculpture style. Matte clay texture with tactile feel, finger marks, and handmade imperfections. Soft natural lighting. Analog artisanal aesthetic. Pure white background. Head and shoulders, centered."
        },
        {
          "inline_data": {
            "mime_type": "image/jpeg",
            "data": "[BASE64_ENCODED_USER_PHOTO]"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "responseMimeType": "image/png"
  }
}
```

### Expected Response:

Base64-encoded PNG image of the claymation portrait.

---

## Notes

- Single unified prompt - photo + style sent directly to Google AI Studio
- Image-to-image transformation in one step
- Each generation is unique
- The same photo can produce different claymation variations each time
