# Tarteel Offline-Ready Delivery

This ZIP contains the modified Tarteel project source and Android Capacitor wrapper.

Excluded generated/local-only directories:
- `.git`
- `node_modules`
- `dist`
- `android-wrapper/www`
- Android Gradle build/cache directories
- Previously generated debug APK

After extracting:

```bash
pnpm install --frozen-lockfile
pnpm mobile:build
cd android-wrapper
npm ci
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon
```

For GitHub Actions, push the project to a repository and run:
`Actions -> Build Tarteel Android APK -> Run workflow`.

The workflow builds the web app before syncing Capacitor and uploads a debug APK artifact.
