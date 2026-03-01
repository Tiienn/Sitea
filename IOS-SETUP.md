# Sitea iOS — Ready to Build 🍎

Everything is prepped. When you get home, just do these steps:

---

## Step 1 — Install Xcode
Download from the Mac App Store (~7GB):
https://apps.apple.com/app/xcode/id497799835

After installing, open Xcode once and accept the license agreement.

---

## Step 2 — Open the project in Xcode
```bash
cd /Users/tien/projects/sitea
npx cap open ios
```
This opens ios/App/App.xcworkspace in Xcode.

---

## Step 3 — Sign the app
1. Click "App" in the left sidebar
2. Go to Signing & Capabilities tab
3. Check "Automatically manage signing"
4. Set Team to your Apple ID (sign in: Xcode → Settings → Accounts)

---

## Step 4 — Run on simulator
- Select any iPhone simulator at the top (e.g. iPhone 16)
- Hit the ▶ Play button

---

## Step 5 — Run on real iPhone (optional)
1. Plug in via USB, trust the computer on your phone
2. Select your device from the top dropdown
3. Hit ▶ Play

---

## What's already done ✅
- Capacitor synced with latest dist build
- Swift Package Manager configured (no pod install needed)
- App icon 1024x1024 in place
- Bundle ID: live.sitea.app
- Display name: SiteA
- Min iOS: 15.0
- LANG fix added to ~/.zshrc

---

## App Store (later)
Product → Archive → Upload via Organizer → App Store Connect
Requires Apple Developer account ($99/yr)
