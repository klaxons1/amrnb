# audioc2

Pure JavaScript AMR-NB codec, hand-ported line-by-line from
[opencore-amr](https://sourceforge.net/projects/opencore-amr/) 0.1.6.
No WebAssembly, no native dependencies, no build step.

**Status: decoder complete and bit-exact.** Output is verified byte-identical
to the reference C implementation across all 8 modes (MR475…MR122), DTX/SID
comfort-noise frames, and bad-frame (BFI) error concealment. The encoder is
planned (Phase 2).

- Zero dependencies, ESM, Node ≥ 18 (also works in browsers/bundlers)
- ~500× realtime decoding on a modern machine (V8)
- Drop-in replacement for the emscripten-compiled `amrnb.js` decoder interface

## Usage

High-level:

```js
import { AmrNbDecoder } from 'audioc2';
import fs from 'node:fs';

const amr = fs.readFileSync('voice.amr');     // IETF storage format
const pcm = new AmrNbDecoder().decodeAll(amr); // Int16Array, 8 kHz mono
```

Low-level (mirrors opencore-amr's `wrapper.cpp` / the emscripten module):

```js
import {
  Decoder_Interface_init, Decoder_Interface_Decode, FRAME_SIZE,
} from 'audioc2';

const state = Decoder_Interface_init();
const pcm = new Int16Array(160);
// frame: Uint8Array of one frame, ToC byte first; bfi: 0 or 1
Decoder_Interface_Decode(state, frame, pcm, 0);
```

CLI:

```sh
node cli/amrnb-dec.js in.amr out.wav
```

## How it was ported (and how it stays correct)

Every function is transcribed line by line from the opencore-amr C sources,
preserving the 16/32-bit saturating fixed-point semantics exactly
(`src/common/basicop.js` documents the conventions). Lookup tables are
machine-extracted from the C sources by `tools/extract-tables.mjs`.

Verification (see `test/`):

- `basicop.test.js` — every fixed-point primitive compared against a
  natively compiled vector generator (2.8M cases incl. saturation edges).
- `decode.test.js` — frame-by-frame bit-exact comparison against golden
  output produced by the reference codec for all modes, DTX and BFI.
- `tools/native/` — builds the reference C decoder for golden cross-checks
  and divergence bisection (requires gcc and the opencore-amr 0.1.6 sources;
  not needed to run the library).

Regenerate fixtures/tables: `npm run gen-reference`, `npm run gen-tables`
(both need the opencore-amr 0.1.6 source tree / reference module, see the
paths in `tools/`).

## License

Apache-2.0, same as opencore-amr, of which this is a derivative work
(original code (C) 1998-2010 PacketVideo, portions derived from 3GPP
TS 26.073 reference C code, (C) 2004 3GPP Organizational Partners).
