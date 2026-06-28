# NovelViz — iOS Build & App Store Submission Guide

All commands run in your Mac terminal inside `Novel Weaver/`.

---

## Prerequisites

- [ ] macOS Sequoia (or later)
- [ ] Xcode 16+ installed from the Mac App Store
- [ ] Xcode Command Line Tools: `xcode-select --install`
- [ ] Node 20+ (`node -v`)
- [ ] Apple Developer Program membership ($99/year) — https://developer.apple.com/programs/

---

## Step 1 — Install dependencies

```bash
cd "Novel Weaver"

# Install Capacitor core, CLI, and iOS platform
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
```

---

## Step 2 — Build the web app

```bash
npm run build
```

This produces the `dist/` folder that Capacitor bundles into the native app.

---

## Step 3 — Add the iOS platform (first time only)

```bash
npx cap add ios
```

This generates the `ios/` Xcode project folder.

---

## Step 4 — Copy iOS icons

Copy everything from `ios-icons/` into the Xcode assets:

```bash
cp ios-icons/Icon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/
# For all sizes:
cp ios-icons/*.png ios/App/App/Assets.xcassets/AppIcon.appiconset/
```

Then open `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` and make sure
each filename is referenced. Xcode will show the icons grid — fill any blank slots
using the files in `ios-icons/`.

---

## Step 5 — Sync web content into the native project

Run this every time you rebuild the web app:

```bash
npx cap sync ios
```

---

## Step 6 — Open in Xcode

```bash
npx cap open ios
```

---

## Step 7 — Configure signing in Xcode

1. Select the `App` target in the left sidebar.
2. Go to **Signing & Capabilities** tab.
3. Check **Automatically manage signing**.
4. Set **Team** to your Apple Developer account.
5. Bundle Identifier: `com.novelviz.app`
   - You may need to change this if it's taken — pick anything you own.

---

## Step 8 — Set version & build number

Still in the `App` target, **General** tab:

- **Version**: `1.0.0`
- **Build**: `1`
- **Deployment Target**: iOS 16.0

---

## Step 9 — Test on Simulator

Select an iPhone 16 Pro simulator and press **▶ Run** (⌘R).

Run through the full flow:
- Sign in
- Analyse a book
- Save to shelf
- Open Anti-Shelf recommendations
- Compare two books

Also test on an iPad simulator (iPad Pro 13-inch M4).

---

## Step 10 — Capture screenshots

With Simulator open at the correct device:
- **Device → Screenshot** (⌘S) — saved to Desktop
- Capture all 6 scenes listed in `APP_STORE_SUBMISSION.md`
- Repeat for each required device size (iPhone 6.9", 6.1", iPad Pro 13")

---

## Step 11 — Archive for distribution

1. Select **Any iOS Device (arm64)** as the build destination (top of Xcode).
2. **Product → Archive** (⌘⇧A)
3. Xcode Organizer opens when it finishes.
4. Click **Distribute App → App Store Connect → Upload**.
5. Follow the wizard — keep all defaults, click through.

---

## Step 12 — App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Under **My Apps**, click **+** → **New App**
3. Fill in the fields from `APP_STORE_SUBMISSION.md`
4. Upload screenshots
5. Paste the description, keywords, URLs, and review notes
6. Under **Build**, select the build you just uploaded
7. Click **Submit for Review**

Apple typically reviews in 24–48 hours for first submissions.

---

## Common gotchas

| Problem | Fix |
|---|---|
| `cap sync` fails | Run `npm run build` first |
| "No provisioning profile" | Enable automatic signing, confirm your Team is set |
| Blank icon slots in Assets | Drag the correct PNG from `ios-icons/` into each slot |
| App crashes on launch | Check Xcode console — usually a missing `WKWebView` permission or CORS from Supabase |
| `NSAppTransportSecurity` error | Add `NSAllowsArbitraryLoads` (not needed — all our endpoints are HTTPS) |
| Capacitor can't reach Supabase | Ensure `capacitor.config.ts` has no `server.url` in production build |

---

## After approval

- Bump **Build** number (not version) for every subsequent upload: 2, 3, 4…
- Version changes (1.0.1, 1.1.0) require a new App Store review submission
- Run `npm run build && npx cap sync ios` before every archive

---

## Useful commands cheat-sheet

```bash
# Full rebuild + sync
npm run build && npx cap sync ios

# Open Xcode
npx cap open ios

# Update Capacitor plugins
npm update @capacitor/core @capacitor/ios @capacitor/splash-screen
npx cap sync ios
```
