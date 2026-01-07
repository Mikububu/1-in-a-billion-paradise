# OAuth Setup Check - Google & Apple Sign-In

## ✅ Current Implementation Status

### Frontend Implementation
- ✅ **Google Sign-In**: Implemented using `supabase.auth.signInWithOAuth()`
- ✅ **Apple Sign-In**: Implemented using `expo-apple-authentication` + `signInWithIdToken()`
- ✅ **Deep Link Handling**: OAuth callbacks handled via `oneinabillion://auth/callback`
- ✅ **UI Components**: Google and Apple buttons present in SignInScreen
- ✅ **Dependencies**: All required packages installed

### Required Packages (✅ Installed)
- ✅ `expo-apple-authentication` (~8.0.8)
- ✅ `expo-web-browser` (~15.0.10)
- ✅ `expo-auth-session` (~7.0.10)
- ✅ `@supabase/supabase-js` (^2.45.0)

### App Configuration
- ✅ **URL Scheme**: `oneinabillion://` configured in `app.json`
- ✅ **Redirect URI**: `oneinabillion://auth/callback`

## ⚠️ Required Supabase Dashboard Configuration

### 1. Enable OAuth Providers

**Go to: Supabase Dashboard → Authentication → Providers**

#### Google OAuth
- ✅ Enable "Google" provider
- Configure:
  - **Client ID**: From Google Cloud Console
  - **Client Secret**: From Google Cloud Console
  - **Authorized Redirect URLs**: 
    - `https://[your-project-ref].supabase.co/auth/v1/callback`
    - `oneinabillion://auth/callback` (for mobile)

#### Apple OAuth
- ✅ Enable "Apple" provider
- Configure:
  - **Services ID**: From Apple Developer Portal
  - **Team ID**: From Apple Developer Account
  - **Key ID**: From Apple Developer Portal
  - **Private Key**: Upload .p8 file from Apple Developer Portal
  - **Authorized Redirect URLs**:
    - `https://[your-project-ref].supabase.co/auth/v1/callback`
    - `oneinabillion://auth/callback` (for mobile)

### 2. Configure Redirect URLs

**Go to: Supabase Dashboard → Authentication → URL Configuration**

**Site URL:**
```
oneinabillion://auth
```

**Redirect URLs (add all):**
```
oneinabillion://auth/callback
oneinabillion://auth/confirm
oneinabillion://auth/reset-password
https://[your-project-ref].supabase.co/auth/v1/callback
```

## 🔧 Google Cloud Console Setup

### 1. Create OAuth 2.0 Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/Select a project
3. Enable "Google+ API"
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth client ID**
6. Application type: **Web application**
7. Authorized redirect URIs:
   - `https://[your-project-ref].supabase.co/auth/v1/callback`
8. Copy **Client ID** and **Client Secret**
9. Add to Supabase Dashboard → Authentication → Providers → Google

### 2. iOS Configuration (if needed)
- Create **iOS** OAuth client
- Bundle ID: `com.oneinabillion.app` (from app.json)
- Add to Google Cloud Console

## 🍎 Apple Developer Setup

### 1. Create Services ID
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. **Certificates, Identifiers & Profiles**
3. **Identifiers → Services IDs**
4. Create new Services ID
5. Enable "Sign in with Apple"
6. Configure:
   - **Primary App ID**: Your app's bundle ID
   - **Website URLs**:
     - Primary: `https://[your-project-ref].supabase.co`
     - Return URLs: `https://[your-project-ref].supabase.co/auth/v1/callback`
7. Save **Services ID** (e.g., `com.yourcompany.yourapp.service`)

### 2. Create Key
1. **Keys → Create a new key**
2. Enable "Sign in with Apple"
3. Download `.p8` key file (only once!)
4. Note **Key ID**

### 3. Add to Supabase
- **Services ID**: From step 1
- **Team ID**: From Apple Developer account
- **Key ID**: From step 2
- **Private Key**: Upload `.p8` file content

## 📱 iOS App Configuration

### app.json Configuration
Current bundle identifier:
```json
"bundleIdentifier": "com.oneinabillion.app"
```

### Required: Add Apple Sign-In Capability
Add to `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.oneinabillion.app",
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": ["oneinabillion"]
          }
        ]
      }
    },
    "plugins": [
      "expo-apple-authentication"
    ]
  }
}
```

## 🔍 Code Flow Verification

### Google Sign-In Flow
1. User taps "Continue with Google"
2. `handleGoogleSignIn()` called
3. `supabase.auth.signInWithOAuth({ provider: 'google' })` 
4. Opens browser with Google OAuth
5. User authorizes
6. Redirects to `oneinabillion://auth/callback`
7. Deep link handler processes tokens
8. `supabase.auth.setSession()` sets session
9. User signed in ✅

### Apple Sign-In Flow
1. User taps "Continue with Apple"
2. `handleAppleSignIn()` called
3. `AppleAuthentication.signInAsync()` gets credential
4. `handleSupabaseExchange(identityToken, 'apple')`
5. `supabase.auth.signInWithIdToken({ provider: 'apple', token })`
6. Supabase validates token
7. User signed in ✅

## ⚠️ Potential Issues

### 1. Profile Creation After OAuth
**Check**: Does profile get created automatically after OAuth sign-in?

**Location**: Look for `onAuthStateChange` listener or profile creation logic after OAuth.

**Action**: Verify `library_people` record is created for OAuth users.

### 2. Email Collection
- **Google**: Usually provides email
- **Apple**: May hide email (uses relay email)
- **Action**: Handle case where email might be missing

### 3. First-Time OAuth Users
- **Check**: Does onboarding flow trigger for new OAuth users?
- **Action**: Verify navigation after OAuth sign-in

## ✅ Testing Checklist

- [ ] Google OAuth configured in Supabase Dashboard
- [ ] Apple OAuth configured in Supabase Dashboard
- [ ] Redirect URLs added to Supabase
- [ ] Google Cloud Console credentials created
- [ ] Apple Developer Services ID created
- [ ] Apple Developer Key created and uploaded
- [ ] Test Google sign-in on device
- [ ] Test Apple sign-in on device (iOS only)
- [ ] Verify profile creation after OAuth
- [ ] Verify deep link handling works
- [ ] Test on both iOS and Android (Google only)

## 📝 Next Steps

1. **Configure Supabase Dashboard**:
   - Enable Google provider
   - Enable Apple provider
   - Add redirect URLs

2. **Set up Google Cloud Console**:
   - Create OAuth credentials
   - Add to Supabase

3. **Set up Apple Developer**:
   - Create Services ID
   - Create Key
   - Add to Supabase

4. **Test**:
   - Test Google sign-in
   - Test Apple sign-in (iOS only)
   - Verify profile creation

## 🔗 Related Files

- Frontend Sign-In: `1-in-a-billion-frontend/src/screens/auth/SignInScreen.tsx`
- OAuth Helpers: `1-in-a-billion-frontend/src/services/supabase.ts`
- App Config: `1-in-a-billion-frontend/app.json`

