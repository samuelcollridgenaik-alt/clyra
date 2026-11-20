# Android · installable APK

Clyra uses the same Express/MongoDB API as the web app. No Play Store account is required for sideloading. iOS packaging is deferred.

## Local demonstration APK

Prerequisites: Flutter 3.44.9, Android SDK, JDK 17+, Node.js 22 and the [local backend](LOCAL.md).

```sh
cd mobile
flutter pub get
cd ..
node scripts/release-android.mjs --local-demo
```

Output: `mobile/build/app/outputs/flutter-apk/app-release.apk`.

This is an optimized release-mode build **signed with the local Android development key**, not a production identity. It connects to `http://127.0.0.1:4001/api/v1` only. Connect a phone by USB, enable USB debugging and approve your computer on the phone:

```sh
adb devices
adb reverse tcp:4001 tcp:4001
adb install -r mobile/build/app/outputs/flutter-apk/app-release.apk
```

Keep `node scripts/demo.mjs start` running on the computer. Repeat `adb reverse` after reconnecting/rebooting. With multiple devices use `adb -s DEVICE_ID ...`. This APK does not work independently of the computer; no public backend has been configured. A signature conflict requires using the original signing key or an explicitly approved uninstall (which removes app data).

## Emulator development

```sh
cd mobile
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4001/api/v1
```

## Future standalone distribution

Host the API and MongoDB first. Choose an application ID and a persistent signing key; protect and back up that key to allow future updates. Copy `mobile/android/key.properties.example` to ignored `key.properties` and enter your own local keystore path and credentials. Never commit it or paste credentials into chat.

```sh
export CLYRA_ANDROID_APPLICATION_ID=YOUR_APPROVED_APPLICATION_ID
export API_BASE_URL=https://YOUR_API_HOST/api/v1
node scripts/release-android.mjs
```

This builds a signed APK only, after checking `/health/ready`. Public builds reject local/placeholder endpoints and debug signing aliases. Cleartext HTTP is disabled except debug/explicit local-demo builds. An optional `--appbundle` also creates an AAB if store distribution is requested later; it is not needed for the present sideload workflow.
