# Drift Audio

A local Chrome extension for slowed audio, independent pitch adjustment,
stereo reverb and bass. No account, subscription or network audio service.

## Install

1. Download or clone the current version of this repository.
2. Open `chrome://extensions` in Chrome 116 or later.
3. Enable Developer mode, choose **Load unpacked**, and select the
   **`extension` directory**, rather than the repository root.
4. Refresh any media tabs that were open before installation.
5. Play audio on a website, open **Drift Audio** from Chrome's extensions menu,
   then choose **Start on this tab**.

The committed `extension/` directory is ready to load; Node.js is only needed
to develop or rebuild it. Disable other audio-processing extensions before use.

## Controls

| Control | Range / behavior |
| --- | --- |
| Playback speed | 0.25× to 2×, with 0.01 precision |
| Original pitch | Keep the media's pitch when adjusting speed |
| Pitch shift | −12 to +12 semitones, independent of playback speed |
| Reverb | Dry to wet stereo convolution |
| Room tail | 0.3 to 8 seconds |
| Bass | Low shelf boost, 0 to +18 dB |
| Output | 0 to 150%, with soft peak clipping above 0.9 full scale |
| Presets | Four starting sounds, up to 100 saved presets and a custom default |

For classic slowed + reverb, leave pitch preservation unchecked, choose a
speed below 1× and add reverb. For pitch adjustment alone, set speed to 1×
and move Pitch shift. Speed and pitch remain separate controls.

**Stop processing** releases tab capture and restores each media element's
previous playback speed and pitch-preservation setting. Processing continues
when the popup closes. One tab is processed at a time; reopening the popup
shows whether the active session belongs to another tab. Stop that session
before starting on a different tab.

## Privacy and compatibility

Audio passes from Chrome tab capture into a local offscreen Web Audio graph.
Settings and presets remain in `chrome.storage.local`. Nothing is uploaded.
The content script runs on HTTP(S) pages, including frames, to control HTML
audio/video playback and discover dynamically inserted players. Tab capture
is started only by the user from the popup.

Chrome internal pages, the Chrome Web Store and protected content may reject
capture or script access. Some sites use custom Web Audio players or closed
shadow roots instead of accessible HTML media: reverb and pitch can apply to
capturable output, but the extension cannot change those players' speed.
Pitch shifting adds buffering latency and extreme settings can produce
audible artifacts. A site that continuously overrides playback settings may
conflict with the speed controller. Refresh a tab if its player predates the
extension installation. Existing presets from a different extension are not
imported.

## Develop and verify

```sh
npm ci
npm run check
npm audit
node tests/serve.mjs
```

Open http://localhost:8765/tests/browser.html in Chrome and run the offline
audio checks. They measure frequency, continuity, dry level, reverb decay,
bass and silence at 44.1/48 kHz. The linked panel preview uses a test double
for Chrome APIs; it checks UI behavior, not actual tab capture. Node tests
cover settings, media restoration and extension session lifecycle.

For an end-to-end check with the unpacked extension, play an HTML audio/video
file on a normal webpage, start capture, change speed and pitch separately,
adjust reverb, close/reopen the popup, save/load a preset, stop, and verify
original playback is restored. Also test tab closure and page navigation.

## Source and licenses

This version replaces the previous implementation and visual assets with a
new codebase and identity. The former implementation and releases are not
part of this version. After the repository history cleanup, use a fresh clone;
merging an old clone can reintroduce removed material.

Our code and artwork: MIT. The unmodified SoundTouchJS worklet: MPL-2.0,
with its corresponding source and notices included. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
