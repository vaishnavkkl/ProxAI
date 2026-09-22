# Local Android release

Run from the project directory with JDK 21 and the Android SDK installed:

```powershell
npm.cmd run android:release
```

This uses the local Gradle wrapper to build a signed APK and Android App Bundle for `arm64-v8a`. JavaScript and assets are bundled into the app; Metro and Expo cloud builds are not required to run it.

Outputs are in `releases/`, with SHA-256 checksums in `releases/SHA256SUMS.txt`.

Signing material is generated once and reused:

- `.local-signing/proxai-release.p12`: PKCS12 keystore, RSA 4096, alias `proxai-release`.
- `.local-signing/release.properties`: generated keystore and key passwords.

Back up both signing files securely. Keep them together and use the same key for future updates. The signing folder and release artifacts are excluded from Git. The build script refuses to replace a partially missing signing pair.

If the generated `android/` folder is recreated, this build script reapplies `scripts/release-signing.gradle` before building. Release signing never falls back to the debug key.

## Installing on a phone previously used for development

The release APK and the earlier debug APK have the same application ID but different signing keys. Android cannot install one as an update to the other (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Changing the version number or rebuilding does not fix a signing-key mismatch.

Back up any needed ProxAI data before removing the debug installation. Private Space, work profiles, or Dual Apps can retain the old package and data even after it disappears from the main profile. A complete removal deletes that app's remaining data across profiles; only do this after explicitly approving that data loss. Future releases signed with the saved release key can update the release installation normally.

For an exact installation error, connect an authorized USB-debugging device and run:

```powershell
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" install -r releases/ProxAI-1.0.0-arm64-v8a-release.apk
```

Play Protect warnings are separate from signing-key conflicts. This app declares `READ_SMS` for its optional local transaction import; [Google documents that sensitive permissions can block internet-sideloaded installations](https://developers.google.com/android/play-protect/warning-dev-guidance). A valid signature does not guarantee Play Protect acceptance. Use the relevant scan/review or distribution process; changing keys or disabling Play Protect does not fix an Android signing-key mismatch.

Optional architecture override:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1 -Architecture arm64-v8a
```
