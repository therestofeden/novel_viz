import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.novelviz.app",
  appName: "NovelViz",
  webDir: "dist",
  // For production: remove `server` block entirely so the app bundles
  // the local dist/ folder. During development you can point to the
  // Vercel preview URL for hot-reload convenience:
  //
  // server: {
  //   url: "https://YOUR-PREVIEW.vercel.app",
  //   cleartext: false,
  // },
  ios: {
    // Minimum iOS version is set in Xcode target → General → Deployment Info (set to 16.0)
    contentInset: "automatic",
    backgroundColor: "#3b312b",
  },
  plugins: {
    // SplashScreen shown while Capacitor boots the WebView
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#3b312b",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      iosSpinnerStyle: "small",
      spinnerColor: "#f5f0e8",
      splashFullScreen: true,
      splashImmersive: true,
    },
    // StatusBar: dark background → light text
    StatusBar: {
      style: "DARK",
      backgroundColor: "#3b312b",
    },
    // Keyboard: push the WebView up so the input is never hidden
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
