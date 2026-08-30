import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tarteel.quran",
  appName: "ترتيل",
  webDir: "www",
  android: {
    allowMixedContent: false,
  },
};

export default config;
