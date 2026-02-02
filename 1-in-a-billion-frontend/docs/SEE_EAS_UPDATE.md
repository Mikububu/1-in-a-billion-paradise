# How to see the EAS OTA update

## Why you don’t see it in the simulator (normal)

- When you run the app from **Metro** (e.g. `npx expo start` and open the dev client), the app loads the **local bundle from Metro**, not from EAS. So you will **never** see an EAS OTA in that case.
- EAS updates are used when the app runs **without Metro** (standalone build) and checks the updates server.

## 1. See the update in the simulator (dev build)

Use the **Extensions** tab in your development build:

1. Open your **dev build** on the simulator (not Expo Go).
2. Open the **developer menu** (in iOS Simulator: **Cmd + D**; or shake the device).
3. Tap **Extensions** (or “Open Extensions”).
4. Tap **Login** and sign in with your Expo account (the one that owns the project).
5. After login, an **EAS Update** section appears with published updates.
6. Tap **Open** next to the update:  
   `fix: Products Not Available + Your Readings copy (Option C)`  
   (or the latest update on branch **main**).

The app will load that OTA so you can verify the fixes.

## 2. See the update on the EAS dashboard

1. Go to **https://expo.dev** and sign in (account: **michaelpw**).
2. Open **Projects** → **in-a-billion** (or “In A Billion”).
3. Open the **Updates** tab (not Builds).
4. You should see branch **main** and the update with message:  
   `fix: Products Not Available + Your Readings copy (Option C)`.

Direct link (replace if your project ID differs):  
https://expo.dev/accounts/michaelpw/projects/in-a-billion/updates

## 3. Open this exact update via URL (dev build)

In the dev build’s launcher, under **“Enter URL Manually”**, paste:

```
oneinabillion://expo-development-client/?url=https://u.expo.dev/eced09a0-1038-41f6-a46c-1ec085690182/group/5c677354-cb91-4237-9291-42203ba99b85
```

Then open that URL (e.g. from Notes or Safari). It should open the app and load this update.

## 4. When do real users get the update?

- **Production builds** (installed from the App Store / Play Store or from EAS Build) use the **main** branch by default.
- When the user opens the app (and is not running Metro), it checks for updates (`checkAutomatically: "ON_LOAD"`) and downloads the latest OTA for **main**.
- So the next time they open the app, they get this update.

## Summary

| Where | How to see the update |
|-------|------------------------|
| **Simulator (dev build)** | Dev menu → Extensions → Login → Open the update on **main** |
| **Simulator (same update via URL)** | Open the `oneinabillion://expo-development-client/?url=...` link above |
| **EAS Dashboard** | expo.dev → Projects → in-a-billion → **Updates** tab |
| **Real users** | Automatic on next app open (production builds on main) |
