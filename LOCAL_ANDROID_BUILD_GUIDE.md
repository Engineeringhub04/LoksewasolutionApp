# Local Android APK Build Guide (Windows) — LoksewaSolutionApp

EAS cloud bina, aafnai computer ma APK banauney tarika. Ekchoti setup garepachhi
bar-bar chhito build huncha — quota/queue kehi chaindaina.

Target phone: **itel Vision 3** (Unisoc SC9863A — arm64-v8a + armeabi-v7a dubai
support garcha, so default build comfortable install huncha).
Redmi 12 ko `eas.json` config jastai chha — kehi delete gareko chhaina.

---

## PHASE 0 — Pahila k-k chha check garne

PowerShell / CMD kholera yi command haru ekek garera chalaunus:

```powershell
java -version
```
- JDK bhaeko chha bhane version dekhaucha (`openjdk version "17..."` jasto).
- `17` dekhinu ramro. `21` pani hunchha. `11` ya tyo bhanda kam bhaye naya JDK 17 install garnu parcha.
- "not recognized" aayo bhane JDK chhaina → PHASE 1.

```powershell
echo %JAVA_HOME%
```
- JDK ko path dekhaucha (jastai `C:\Program Files\Eclipse Adoptium\jdk-17...`).
- Khali aayo bhane env var set garnu parcha → PHASE 3.

```powershell
echo %ANDROID_HOME%
```
- Android SDK ko path dekhaucha (jastai `C:\Users\Lenovo\AppData\Local\Android\Sdk`).
- Khali aayo bhane Android SDK chhaina ya env var set chhaina → PHASE 2.

```powershell
adb --version
```
- Android platform-tools bhaeko chha bhane version dekhaucha.
- "not recognized" → Android SDK/platform-tools chhaina → PHASE 2.

**Sabai theek dekhiyo (java 17 + ANDROID_HOME + adb) bhane sidhai PHASE 4 ma jaanu.**

---

## PHASE 1 — JDK 17 install (java chhaina bhane matra)

Expo SDK 54 / React Native 0.81 lai **JDK 17** chahincha (naya/purano haina, 17).

**Sabbhanda simple — winget le (Windows 10/11 ma built-in):**

```powershell
winget install EclipseAdoptium.Temurin.17.JDK
```

Sakiyepachhi terminal **band garera naya kholnus** (env var refresh huna), ani:

```powershell
java -version
```
`openjdk version "17..."` aaunu paryo.

> winget chhaina bhane: https://adoptium.net/temurin/releases/?version=17 bata
> Windows x64 `.msi` download garera install garnus.

---

## PHASE 2 — Android SDK install (adb/ANDROID_HOME chhaina bhane)

**Sabbhanda simple tarika: Android Studio install garne** (yesle SDK +
platform-tools + build-tools sabai automatically halcha).

1. https://developer.android.com/studio bata Android Studio download garnus.
2. Install garda "Standard" setup rojnus — yesle SDK auto install garcha.
3. Pahilo choti khuldaa **SDK Manager** (More Actions → SDK Manager) ma jaanus, ani yi tick garnus:
   - **Android SDK Platform** (latest — jastai Android 15 / API 35)
   - **Android SDK Build-Tools**
   - **Android SDK Platform-Tools**
   - **Android SDK Command-line Tools (latest)**
4. Apply garera download hunदिनुस।

SDK sadhai yaha install huncha:
```
C:\Users\Lenovo\AppData\Local\Android\Sdk
```

> Android Studio nachahine (halka rakhne) bhaye "Command line tools only"
> pani chha, tara pahilo choti Android Studio nai सजिलो — sabai afai milcha.

---

## PHASE 3 — Environment variables set garne (ekchoti matra)

Windows Search ma "environment variables" khojnus → **Edit the system environment
variables** → **Environment Variables** button.

**User variables** ma yi thapnus/check garnus:

| Variable | Value (aafno path anusar) |
|---|---|
| `JAVA_HOME` | `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot` |
| `ANDROID_HOME` | `C:\Users\Lenovo\AppData\Local\Android\Sdk` |

Ani `Path` variable ma (Edit → New garera) yi 3 line thapnus:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%JAVA_HOME%\bin
```

OK garera **sabai terminal band garnus, naya kholnus** (env var refresh huna).
Confirm:
```powershell
java -version
adb --version
echo %ANDROID_HOME%
```
Tinai le sahi output diyo bhane setup pura.

---

## PHASE 4 — Project ma android/ folder banaune (prebuild)

Hamro project "managed" ho — `android/` folder chhaina. Ekchoti generate garne:

```powershell
cd D:\kishan\LoksewasolutionApp
npx expo prebuild --platform android
```

- Yesle `android/` folder banaucha (app.json ko icon, splash, package name sabai
  yehi bata aaucha).
- **Yehi step le native config — window background, adaptive icon safe-zone,
  splash — sabai apply garcha.** Expo Go ma na-dekhine white-flash fix yaha
  bata effect ma aaucha.
- Bhavisya ma app.json ya native plugin change gare pachhi `npx expo prebuild
  --platform android --clean` feri chalaunu (folder regenerate huncha).

---

## PHASE 5 — APK build garne

```powershell
cd D:\kishan\LoksewasolutionApp\android
.\gradlew assembleRelease
```

- Pahilo build ~10-20 min lagcha (Gradle le sab download garcha). Pachhi chhito.
- Sakiyepachhi APK yaha aaucha:
```
D:\kishan\LoksewasolutionApp\android\app\build\outputs\apk\release\app-release.apk
```

> **Debug build (chhito, signing jhanjhat bina, testing lai theek):**
> ```powershell
> .\gradlew assembleDebug
> ```
> APK: `android\app\build\outputs\apk\debug\app-debug.apk`
> Testing phase ma yo सजिलो — release signing key ko jhanjhat chaindaina.

### itel Vision 3 lai chhoto APK (optional)

Default build sabai ABI (arm64-v8a, armeabi-v7a, x86, x86_64) halcha — thulo
huncha tara jun phone ma pani chalcha. itel + Redmi dubai lai matra chahine 2
ARM ABI rakhna, `android\gradle.properties` ma yo line khojnus/badalnus:

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a
```

Yesle x86 hataucha (emulator matra chahine), APK chhoto huncha, itel + Redmi
dubai ma chalcha. (Note: `expo prebuild --clean` pachhi yo line feri set garnu parcha.)

---

## PHASE 6 — itel Vision 3 ma install garne

**Tarika A — USB cable le (adb):**
1. itel ma Settings → About phone → "Build number" 7 choti tap garera
   Developer options kholnus.
2. Developer options → **USB debugging** on garnus.
3. USB le computer ma jodnus (phone ma "Allow USB debugging?" aaye Allow).
4. Terminal ma:
   ```powershell
   adb devices
   ```
   Phone list ma aayo bhane:
   ```powershell
   adb install -r "D:\kishan\LoksewasolutionApp\android\app\build\outputs\apk\release\app-release.apk"
   ```
   (`-r` = pahileko app maathi update install)

**Tarika B — file sarera:**
- `app-release.apk` (ya `app-debug.apk`) file itel ma pathaunus (USB copy /
  WhatsApp / Google Drive).
- itel ma file tap garera install (Settings ma "Install from unknown sources"
  allow garnu parne huna sakcha).

---

## Bhavisya ma feri build garda (setup sakiyepachhi)

Ekchoti sab install bhaye pachhi, code change garepachhi khali:

```powershell
cd D:\kishan\LoksewasolutionApp\android
.\gradlew assembleDebug
```

Ani PHASE 6 le install. Prebuild feri chalaunu **pardaina** — app.json / native
config badleko bela matra `npx expo prebuild --platform android --clean`.

---

## Quick reference — sab command ek thau

```powershell
# Check
java -version
adb --version
echo %ANDROID_HOME%

# One-time (chhaina bhane)
winget install EclipseAdoptium.Temurin.17.JDK
# + Android Studio install + env vars (PHASE 3)

# Build
cd D:\kishan\LoksewasolutionApp
npx expo prebuild --platform android
cd android
.\gradlew assembleDebug        # ya assembleRelease

# Install (USB debugging on)
adb install -r "app\build\outputs\apk\debug\app-debug.apk"
```
