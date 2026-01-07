# Assets Setup Guide

## Current Status

All asset references have been commented out or made optional so the app can start without them.

## Assets Folder Structure

The assets folder exists at:
```
Paradise/1-in-a-billion-frontend/assets/
├── videos/
├── images/
│   └── cities/
├── systems/
├── audio/
│   ├── voices/
│   └── intros/
└── sounds/
```

## Required Assets

### Videos
- `assets/videos/couple-laughing.mp4` - RelationshipScreen
- `assets/videos/signin-background.mp4` - AccountScreen  
- `assets/videos/mouth.mp4` - LanguagesScreen
- `assets/videos/hello_i_love_you.mp4` - NextStepScreen

### Images
- `assets/images/signin-poster.jpg` - AccountScreen (already fixed in SignInScreen)
- `assets/images/couple-poster.jpg` - RelationshipScreen
- `assets/images/woman-happy.png` - IntroScreen
- `assets/images/5_systems.png` - HookSequenceScreen
- `assets/images/hello_i_love_you_poster.png` - NextStepScreen
- `assets/images/cities/hongkong.png` - BirthInfoScreen
- `assets/images/cities/villach.png` - BirthInfoScreen
- `assets/images/cities/vienna.png` - BirthInfoScreen
- `assets/images/cities/newyork.png` - BirthInfoScreen
- `assets/systems/human-design.png` - FullReadingScreen

### Audio
- `assets/audio/voices/Anabella.wav` - Voice samples
- `assets/audio/voices/Dorothy.wav` - Voice samples
- `assets/audio/voices/Ludwig.wav` - Voice samples
- `assets/audio/voices/Mike.mp3` - Voice samples
- `assets/audio/intros/intro_western.mp3` - AudioPlayerScreen
- `assets/audio/intros/intro_vedic.mp3` - AudioPlayerScreen
- `assets/audio/intros/intro_human_design.mp3` - AudioPlayerScreen
- `assets/audio/intros/intro_gene_keys.mp3` - AudioPlayerScreen
- `assets/audio/intros/intro_kabbalah.mp3` - AudioPlayerScreen
- `assets/sounds/tibetan-singing-bowl.mp3` - AudioPlayerScreen

## How to Add Assets

1. **Copy from reference folder** (if available):
   ```bash
   cd "/Users/michaelperinwogenburg/Desktop/big challenge"
   # If assets exist in "1-in-a-billion-all 2/1-in-a-billion-frontend/assets"
   cp -r "1-in-a-billion-all 2/1-in-a-billion-frontend/assets/"* "Paradise/1-in-a-billion-frontend/assets/"
   ```

2. **Or add manually**:
   - Place files in the correct subdirectories
   - Ensure file names match exactly (case-sensitive)

3. **Uncomment code**:
   - Once assets are added, uncomment the `require()` statements
   - Remove placeholder `<View>` backgrounds

## Files Modified (Assets Commented Out)

- ✅ `src/screens/auth/SignInScreen.tsx` - signin-poster.jpg, signin-background.mp4
- ✅ `src/screens/onboarding/RelationshipScreen.tsx` - couple-laughing.mp4, couple-poster.jpg
- ✅ `src/screens/onboarding/AccountScreen.tsx` - signin-poster.jpg, signin-background.mp4
- ✅ `src/screens/onboarding/LanguagesScreen.tsx` - mouth.mp4
- ✅ `src/screens/onboarding/IntroScreen.tsx` - woman-happy.png
- ✅ `src/screens/onboarding/BirthInfoScreen.tsx` - city images
- ✅ `src/screens/onboarding/HookSequenceScreen.tsx` - 5_systems.png
- ✅ `src/screens/home/NextStepScreen.tsx` - hello_i_love_you.mp4, poster
- ✅ `src/screens/home/FullReadingScreen.tsx` - human-design.png
- ✅ `src/screens/home/AudioPlayerScreen.tsx` - singing bowl, intro audio
- ✅ `src/config/readingConfig.ts` - voice samples

## Notes

- All asset references are now optional/commented out
- App will start without assets (using placeholder backgrounds)
- Add assets and uncomment code when ready
- Paths are relative from each file's location

