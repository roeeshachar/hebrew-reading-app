# iPhone app (Capacitor)

The same web app, packed into a real iOS app. Nothing is loaded from the internet:
pictures, recordings and code are inside the app, so it also works offline.

Native parts (all under `ios/App/App/`):
- `SpeechPlugin.swift` – Apple speech recognition for the read-aloud game (the web view has none).
- `AppDelegate.swift` – audio session "playback": clips play even when the silent switch is on.
- `Info.plist` – portrait only, microphone and speech-recognition texts (Hebrew).

## Build and install (on a Mac with Xcode 16+)
```
git pull && npm ci
npm run ios:open        # copies the web app into the project and opens Xcode
```
In Xcode: select the `App` target → Signing & Capabilities → choose your Apple ID team →
plug in the iPhone (turn on Developer Mode in Settings → Privacy & Security) → press Run.
With a free Apple ID the install lasts 7 days; a paid developer account ($99/year) makes it
last a year and allows TestFlight / the App Store.

After changing anything in `src/`, `audio/`, `assets/` run `npm run ios:sync` (or `ios:open`) again.
The GitHub workflow "iOS build" checks that the project compiles for the simulator.
