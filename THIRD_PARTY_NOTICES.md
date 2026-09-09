# Third-party software

Drift Audio's own code and artwork are under the MIT license in `LICENSE`.

## SoundTouchJS 2.1.1

The unmodified `extension/vendor/soundtouch-processor.js` and its source map
come from **@soundtouchjs/audio-worklet 2.1.1**, published by Steve 'Cutter'
Blades. The bundle includes SoundTouchJS core, worklet-base and the Lanczos
interpolation strategy. These files are licensed under **Mozilla Public
License 2.0**, not the repository's MIT license.

- Upstream: https://github.com/cutterbl/SoundTouchJS
- Package: https://www.npmjs.com/package/@soundtouchjs/audio-worklet/v/2.1.1
- Exact upstream notice: `extension/vendor/SOUNDTOUCH-LICENSE`
- Full license: `extension/vendor/MPL-2.0.txt`
- Corresponding source: `extension/vendor/soundtouch-processor.js.map` contains
  the complete original TypeScript files in `sourcesContent`, with their names
  in `sources`. The sources can be extracted with ordinary JSON tooling.
- The npm lockfile pins the dependency archive and its integrity hash.
- No changes have been made to these upstream files. You may replace the
  worklet file in the unpacked extension with your own compatible build.

The new interface, media controller, reverb generator and icon were authored
for this project. No proprietary extension code, graphics, impulse recordings,
web fonts or remote runtime scripts are included.
