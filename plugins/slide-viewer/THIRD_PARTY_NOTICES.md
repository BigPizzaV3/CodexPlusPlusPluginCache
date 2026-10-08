# Additional third-party notices

These notices cover the identified CSV, DICOM, XML, compression and embedded-runtime components and the HDF5 reader patch in Slide Viewer 0.1.56. They supplement notices retained in bundled code and the separate OpenJPEG/PDF.js license files under `dist/vendor/openjpeg-wasm/`.

The license and notice blocks below reproduce the identified source text without wording changes; CRLF line endings are normalized to LF. The saxes npm package omits its license file; its text comes from the upstream v6.0.0 release.

Whole-artifact source and notice verification is a separate release gate. An npm wrapper's declared license does not establish the license of every prebundled or compiled dependency. This document provides neither publication approval nor a legal conclusion.

## Shipped-runtime license policy

The build checks contributing modules, inline workers, copied runtime files and decoded embedded WebAssembly, rather than treating the development dependency tree as the shipped inventory. Its permitted SPDX identifiers are MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, Zlib and CC0-1.0, plus the exact `Apache-2.0 WITH LLVM-exception` pair. An `OR` expression may select a permitted alternative; every term in a selected `AND` expression must be permitted and have notice coverage. Other exceptions, missing or unknown declarations and excluded packages fail the build. The separately reviewed jsfive 0.4.2 public-domain declaration is accepted only with its exact source and notice hashes and inherited BSD notice; this is not a general `LicenseRef` allowance.

`dist/shipped-licenses.json` records the exact contributing inputs, selected licenses, artifact reviews and notice hashes. `dist/THIRD_PARTY_LICENSES.txt` contains the collected full notices. The build provenance binds these reports to the runtime files, and portable-bundle verification checks them again after copying. Source-only audit records and patches are not part of the license-qualified portable payload.

## zstddec 0.2.0: embedded Zstandard runtimes

The unchanged modern and streaming JavaScript modules contain two embedded WebAssembly decoders. Both existing payloads were reproduced byte-for-byte from Zstandard 1.5.7 revision `f8745da6ff1ad1e7bab384bd1f9d742439278e99` with pinned Emscripten 4.0.10. Separate instrumented builds also reproduce those bytes, binding the source/header and linked-runtime audit to the shipped binaries. This does not claim that the compiler executable itself was bootstrapped from source.

The selected native components include Zstandard and its vendored xxHash under their BSD-3-Clause alternatives, Emscripten and musl code under MIT, the original dlmalloc allocator and WASI declaration header under CC0-1.0, and the retained LLVM runtime/header components under Apache-2.0 with the LLVM exception. The headerless Emscripten stack assembly conservatively retains both root MIT and directory Apache/LLVM notices; this is not an assertion of an exclusive per-file grant or an optional legacy-MIT license. The JavaScript wrapper and its streaming-example attribution are recorded separately.

The source records, exact payload hashes and native build receipts live under `runtime/zstddec/`. Each outer JavaScript review binds every decoded native payload's size, hash and complete component inventory. The installed JSON report records these bindings, and the installed text report retains all corresponding notices. No replacement Zstandard binary or development SDK is shipped.

## hdf5-indexed-reader 1.0.1

[Upstream repository](https://github.com/jrobinso/hdf5-indexed-reader). The following license is retained from the pinned npm package's `LICENSE` file. The source tree carries `patches/hdf5-indexed-reader@1.0.1.patch`, which is applied during dependency installation and is not included in the runtime bundle. It awaits the decoded compact link before indexing its tuple and replaces the gist-credited concatenation helper with a first-party chunk-copy implementation. The credited helper's code and its call are replaced; no license is inferred for that external gist. The patch does not enable automatic embedded-index loading, change the package version or modify the unused Node entrypoints. Its exact bytes are pinned by the package-local lockfile. Generated-HDF5/default-MCP regressions cover the reader's read and export behavior.

```text
MIT License

Copyright (c) Jim Robinson 2023

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### jsfive 0.4.2: embedded HDF5 reader

The HDF5 reader incorporates the frozen jrobinso/jsfive fork at [`233fa7988920fa788c567a725d813f48f2109c30`](https://github.com/jrobinso/jsfive/tree/233fa7988920fa788c567a725d813f48f2109c30). The following is its exact 174-byte public-domain declaration and inherited pyfive attribution. The original file has no final newline. This declaration is not used to relabel inherited pyfive code as public-domain; the BSD-3-Clause text is retained immediately below.

```text
jsfive is in the public domain.

It is based in large part on the pyfive library
https://github.com/jjhelmus/pyfive
Copyright (c) 2016 Jonathan J. Helmus
All rights reserved.
```

### pyfive: inherited jsfive BSD notice

The original jsfive import already credits pyfive. Its exact translation-input commit is unrecorded in the inspected source and history. The following [BSD-3-Clause notice](https://github.com/jjhelmus/pyfive/blob/5f1c6ffcda5dcabdb8b0af94718c38fef719274b/LICENSE.txt) is byte-identical from its 2016 introduction through the latest pre-port snapshot; the v0.1.0 reference is a license-history comparison, not a claim about the bundled pyfive version. Both this inherited notice and jsfive's own declaration apply to the reviewed frozen component.

```text
Copyright (c) 2016 Jonathan J. Helmus
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
       notice, this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above
       copyright notice, this list of conditions and the following
       disclaimer in the documentation and/or other materials provided
       with the distribution.

    * Neither the name of the developers nor the names of any
       contributors may be used to endorse or promote products derived
       from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### esbuild 0.14.2: emitted HDF5 runtime helpers

The frozen jsfive lockfile pins esbuild 0.14.2. Its emitted property-definition helpers remain in the HDF5 reader, so the [exact MIT notice](https://github.com/evanw/esbuild/blob/v0.14.2/LICENSE.md) is retained here. This identifies generated JavaScript helper code, not shipment of the esbuild executable or an independently attested historical build environment.

```text
MIT License

Copyright (c) 2020 Evan Wallace

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## csv-parse 6.1.0

[Upstream source](https://github.com/adaltas/node-csv).

```text
The MIT License (MIT)

Copyright (c) 2010 Adaltas

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## dicom-parser 1.8.21

The installed production bundle comes from the pinned npm package. All 30 original project modules in its source map were byte-verified against [release source `eee6b9631d561200d5ea2ee0c9572392fd0dff26`](https://github.com/cornerstonejs/dicomParser/tree/eee6b9631d561200d5ea2ee0c9572392fd0dff26/src). The source-only `patches/dicom-parser@1.8.21.patch` replaces only the Stack Overflow-attributed month-length helper with first-party UTC-calendar logic and removes the now-stale source-map trailer. It is not included in the runtime bundle. This avoids a copyrightability assumption about the old short helper; it does not change the remaining parser, its public exports, or the `main`/`module` entrypoints.

Patched runtime SHA-256: `a18aee64950c15580c3d49bbc24090403b6b41e96ea159860e953acad279fcdc`. Apart from the replaced 126-byte helper and removed 43-byte trailer, all 31,978 remaining production bytes are unchanged. The new helper uses `setUTCFullYear` so years 0-99 retain their literal values. The readable development bundle and its hot-reload runtime are not selected. The official package's existing banner and exported version report 1.8.12 despite npm package version 1.8.21; those values are preserved, not presented as a fresh upstream build.

Webpack 4.46.0 and Babel helpers 7.17.0 emitted runtime code is covered by the separate notices below. These versions are pinned in the upstream lockfile and their helper sources were checked; the historical build execution was not independently reproduced. Node's external `zlib` and the optional host-provided `pako` interface are not embedded implementations in this parser artifact. The following is the [exact upstream MIT license](https://github.com/cornerstonejs/dicomParser/blob/eee6b9631d561200d5ea2ee0c9572392fd0dff26/LICENSE); its original file has no final newline.

```text
The MIT License (MIT)

Copyright (c) 2014 Chris Hafey (chafey@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## saxes 6.0.0

[Upstream source](https://raw.githubusercontent.com/lddubeau/saxes/v6.0.0/LICENSE).

```text
The ISC License

Copyright (c) Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

====

The following license is the one that governed sax, from which saxes
was forked. Isaac Schlueter is not *directly* involved with saxes so
don't go bugging him for saxes issues.

The ISC License

Copyright (c) Isaac Z. Schlueter and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

====

`String.fromCodePoint` by Mathias Bynens is no longer used, but it can
still be found in old commits. It was once used according to terms of
MIT License, as follows:

    Copyright Mathias Bynens <https://mathiasbynens.be/>

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## xmlchars 2.2.0

[Upstream source](https://github.com/lddubeau/xmlchars).

```text
Copyright Louis-Dominique Dubeau and contributors to xmlchars

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## dcmjs 0.49.2

License text: the installed package's `License.txt`.

[Upstream source](https://github.com/dcmjs-org/dcmjs).

```text

The MIT License (MIT)

Copyright (c) 2017 Steve Pieper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### dcmjs bundled dependencies

The release build does not copy dcmjs's opaque full prebundle. `scripts/dcmjs-runtime.mjs` reads the published `build/dcmjs.es.js.map` with SHA-256 `d1dcdc5ee5f536cfc2f0159083b4a673671b67bb412e0ec151bae5be99dfebde` and admits only 23 reviewed original source modules: 21 dcmjs modules plus loglevel 1.9.2 and pako 2.1.0. The dcmjs modules were individually compared byte-for-byte with npm release gitHead [`67b2ce6d2d8a806c39335e2a0374bea2ee7900e7`](https://github.com/dcmjs-org/dcmjs/tree/67b2ce6d2d8a806c39335e2a0374bea2ee7900e7); the two embedded dependency files match those exact published package versions.

The selected implementation retains the DICOM data reader/writer and dictionary, SR coding/content/templates, color conversion and RLE codec. It does not include dcmjs's adapters, orientation utilities, CC-attributed `nearlyEqual`, embedded gl-matrix, ndarray or lodash sources. Their attributions are not removed from retained code: those source modules are excluded entirely. Pako's MIT license and Zlib source notice appear in their own section below. The build exports hash-bound source-map indices and notice evidence for the modules actually retained in the emitted artifact.

#### loglevel 1.9.2

License text: the installed package's `LICENSE-MIT`. [Upstream source](https://github.com/pimterry/loglevel).

```text
Copyright (c) 2013 Tim Perry

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
```

## pako 2.1.0

The same verbatim MIT and Zlib notices below cover pako 2.1.0 used directly and in the selected dcmjs sources, and pako 2.0.4 embedded through the frozen jsfive reader. The latter version is identified by the frozen prebundle and lockfile; its release source is [`0398fad238edc29df44f78e338cbcfd5ee2657d3`](https://github.com/nodeca/pako/tree/0398fad238edc29df44f78e338cbcfd5ee2657d3). Both license texts were compared byte-for-byte across these versions.

License text: the installed package's `LICENSE`. Its package metadata declares `(MIT AND Zlib)`; the JavaScript port's MIT notice does not replace the zlib source notice that follows.

[Upstream source](https://github.com/nodeca/pako).

```text
(The MIT License)

Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### pako zlib source notice

Verbatim header from the installed `lib/zlib/deflate.js`; it is also retained in `dist/pako.esm.mjs` and the published dcmjs bundle.

```text
// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.
```

## core-js 3.45.1: PDF.js legacy image decoder

The reviewed derivative of the `pdfjs-dist 5.4.296` legacy image decoder retains core-js 3.45.1; the original decoder's runtime metadata records that version and source. Original decoder input SHA-256: `10ed16c74a64da50192d1b3d3aa45596e1bf8be36ebe5d0158cb1a8703c9055c`. The decoder build receipt and `dist/shipped-licenses.json` bind the rebuilt artifact and its complete component inventory. This notice covers the unchanged embedded core-js JavaScript, not a separately shipped package or the native decoder's separate source closure.

Verbatim [upstream v3.45.1 LICENSE](https://github.com/zloirock/core-js/blob/v3.45.1/LICENSE), SHA-256 `83ed88fba5135357a011243ac1d518ddd3f0a2815ff0faabdd2fd7a85ba4aa98`:

```text
Copyright (c) 2014-2025 Denis Pushkarev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## webpack 5.101.3: PDF.js runtime helpers

The copied PDF.js legacy decoder contains webpack-generated JavaScript helpers. PDF.js release source [`f56dc86014bb00c5a239680df53d2010e9aad0f8`](https://github.com/mozilla/pdf.js/tree/f56dc86014bb00c5a239680df53d2010e9aad0f8) pins webpack 5.101.3. This is the exact [upstream MIT notice](https://github.com/webpack/webpack/blob/v5.101.3/LICENSE), not a claim that the webpack build tool is shipped.

The identical notice also covers the emitted webpack 4.46.0 production module-loader, UMD and external-module helpers in the DICOM parser. Its [immutable upstream source](https://github.com/webpack/webpack/tree/444e59f8a427f94f0064cae6765e5a3c4b78596d/lib) and pinned package notice were checked; the development/HMR runtime is not used.

```text
Copyright JS Foundation and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## PDF.js 5.4.296: QCMS JavaScript glue

The copied legacy decoder contains QCMS JavaScript glue. Its `wasm/LICENSE_PDFJS_QCMS` notice from the exact pdfjs-dist 5.4.296 package is reproduced below; it is a BSD-2-Clause notice. The QCMS WASM binary is not copied into the plugin. This notice does not establish any uninspected native-runtime closure.

```text
Copyright (c) 2025, Mozilla Foundation

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## PDF.js 5.4.296: CCITT decoder attribution

The following attribution is retained verbatim from the [pinned PDF.js CCITT decoder source](https://github.com/mozilla/pdf.js/blob/f56dc86014bb00c5a239680df53d2010e9aad0f8/src/core/ccitt.js), also verified against source-map entry 193. The complete Apache License 2.0 remains at `dist/vendor/openjpeg-wasm/LICENSE`.

```text
/* Copyright 1996-2003 Glyph & Cog, LLC
 *
 * The CCITT stream implementation contained in this file is a JavaScript port
 * of XPDF's implementation, made available under the Apache 2.0 open source
 * license.
 */
```

## lerc 3.0.0: GeoTIFF JavaScript decoder

GeoTIFF 3.0.5 uses the self-contained JavaScript decoder `LercDecode.js` from lerc 3.0.0. Its installed 89,279 bytes match both the integrity-verified npm tarball and the [upstream v3.0 source](https://github.com/Esri/lerc/blob/33910e56d2d46e402b6233492eabb6c4fe0b3c5e/OtherLanguages/js/LercDecode.js) exactly (SHA-256 `20a115a2ff426372eac84e062c520d1abdc650618ce4dcca402868c36241f99c`). The unminified source is the package's `main` and `browser` entry; this component does not embed a native binary, WASM payload or third-party prebundle. This statement covers the LERC decoder, not separate GeoTIFF codecs.

The npm package omits its license files. The following complete [upstream Apache-2.0 LICENSE](https://github.com/Esri/lerc/blob/33910e56d2d46e402b6233492eabb6c4fe0b3c5e/LICENSE) preserves all wording and indentation. Normalization removes trailing horizontal whitespace and ensures a final LF; no other content is changed. Upstream raw SHA-256: `77a8b761727c75e2167b15bfdf61b2c0bcf8792271228bebe80779106ad00671` (9,198 bytes, no final newline). Retained SHA-256: `b5726bddcd8e94536717d7e125a366f163d0b20818b63cd452fd69b0d59bc598` (9,155 bytes).

```text
Apache License - 2.0

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

"License" shall mean the terms and conditions for use, reproduction, and distribution as defined by Sections 1 through 9 of this document.

"Licensor" shall mean the copyright owner or entity authorized by the copyright owner that is granting the License.

"Legal Entity" shall mean the union of the acting entity and all other entities that control, are controlled by, or are under common control
with that entity. For the purposes of this definition, "control" means (i) the power, direct or indirect, to cause the direction or management
of such entity, whether by contract or otherwise, or (ii) ownership of fifty percent (50%) or more of the outstanding shares, or (iii) beneficial
ownership of such entity.

"You" (or "Your") shall mean an individual or Legal Entity exercising permissions granted by this License.

"Source" form shall mean the preferred form for making modifications, including but not limited to software source code, documentation source,
and configuration files.

"Object" form shall mean any form resulting from mechanical transformation or translation of a Source form, including but not limited to
compiled object code, generated documentation, and conversions to other media types.

"Work" shall mean the work of authorship, whether in Source or Object form, made available under the License, as indicated by a copyright notice
that is included in or attached to the work (an example is provided in the Appendix below).

"Derivative Works" shall mean any work, whether in Source or Object form, that is based on (or derived from) the Work and for which the
editorial revisions, annotations, elaborations, or other modifications represent, as a whole, an original work of authorship. For the purposes
of this License, Derivative Works shall not include works that remain separable from, or merely link (or bind by name) to the interfaces of,
the Work and Derivative Works thereof.

"Contribution" shall mean any work of authorship, including the original version of the Work and any modifications or additions to that Work
or Derivative Works thereof, that is intentionally submitted to Licensor for inclusion in the Work by the copyright owner or by an individual
or Legal Entity authorized to submit on behalf of the copyright owner. For the purposes of this definition, "submitted" means any form of
electronic, verbal, or written communication sent to the Licensor or its representatives, including but not limited to communication on
electronic mailing lists, source code control systems, and issue tracking systems that are managed by, or on behalf of, the Licensor for
the purpose of discussing and improving the Work, but excluding communication that is conspicuously marked or otherwise designated in writing
by the copyright owner as "Not a Contribution."

"Contributor" shall mean Licensor and any individual or Legal Entity on behalf of whom a Contribution has been received by Licensor and
subsequently incorporated within the Work.

2. Grant of Copyright License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual,
worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare Derivative Works of, publicly display,
publicly perform, sublicense, and distribute the Work and such Derivative Works in Source or Object form.

3. Grant of Patent License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide,
non-exclusive, no-charge, royalty-free, irrevocable (except as stated in this section) patent license to make, have made, use, offer to sell,
sell, import, and otherwise transfer the Work, where such license applies only to those patent claims licensable by such Contributor that are
necessarily infringed by their Contribution(s) alone or by combination of their Contribution(s) with the Work to which such Contribution(s) was
submitted. If You institute patent litigation against any entity (including a cross-claim or counterclaim in a lawsuit) alleging that the Work
or a Contribution incorporated within the Work constitutes direct or contributory patent infringement, then any patent licenses granted to You
under this License for that Work shall terminate as of the date such litigation is filed.

4. Redistribution. You may reproduce and distribute copies of the Work or Derivative Works thereof in any medium, with or without modifications,
and in Source or Object form, provided that You meet the following conditions:

    1. You must give any other recipients of the Work or Derivative Works a copy of this License; and

    2. You must cause any modified files to carry prominent notices stating that You changed the files; and

    3. You must retain, in the Source form of any Derivative Works that You distribute, all copyright, patent, trademark, and attribution notices
    from the Source form of the Work, excluding those notices that do not pertain to any part of the Derivative Works; and

    4. If the Work includes a "NOTICE" text file as part of its distribution, then any Derivative Works that You distribute must include a
    readable copy of the attribution notices contained within such NOTICE file, excluding those notices that do not pertain to any part of the
    Derivative Works, in at least one of the following places: within a NOTICE text file distributed as part of the Derivative Works; within the
    Source form or documentation, if provided along with the Derivative Works; or, within a display generated by the Derivative Works, if and wherever
    such third-party notices normally appear. The contents of the NOTICE file are for informational purposes only and do not modify the License.
    You may add Your own attribution notices within Derivative Works that You distribute, alongside or as an addendum to the NOTICE text from the Work,
    provided that such additional attribution notices cannot be construed as modifying the License. You may add Your own copyright statement to
    Your modifications and may provide additional or different license terms and conditions for use, reproduction, or distribution of Your
    modifications, or for any such Derivative Works as a whole, provided Your use, reproduction, and distribution of the Work otherwise complies with
    the conditions stated in this License.

5. Submission of Contributions. Unless You explicitly state otherwise, any Contribution intentionally submitted for inclusion in the Work by You
to the Licensor shall be under the terms and conditions of this License, without any additional terms or conditions. Notwithstanding the above,
nothing herein shall supersede or modify the terms of any separate license agreement you may have executed with Licensor regarding such Contributions.

6. Trademarks. This License does not grant permission to use the trade names, trademarks, service marks, or product names of the Licensor, except
as required for reasonable and customary use in describing the origin of the Work and reproducing the content of the NOTICE file.

7. Disclaimer of Warranty. Unless required by applicable law or agreed to in writing, Licensor provides the Work (and each Contributor provides
its Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied, including, without limitation,
any warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A PARTICULAR PURPOSE. You are solely responsible for
determining the appropriateness of using or redistributing the Work and assume any risks associated with Your exercise of permissions under
this License.

8. Limitation of Liability. In no event and under no legal theory, whether in tort (including negligence), contract, or otherwise, unless required
by applicable law (such as deliberate and grossly negligent acts) or agreed to in writing, shall any Contributor be liable to You for damages,
including any direct, indirect, special, incidental, or consequential damages of any character arising as a result of this License or out of the
use or inability to use the Work (including but not limited to damages for loss of goodwill, work stoppage, computer failure or malfunction, or
any and all other commercial damages or losses), even if such Contributor has been advised of the possibility of such damages.

9. Accepting Warranty or Additional Liability. While redistributing the Work or Derivative Works thereof, You may choose to offer, and charge a
fee for, acceptance of support, warranty, indemnity, or other liability obligations and/or rights consistent with this License. However, in accepting
such obligations, You may act only on Your own behalf and on Your sole responsibility, not on behalf of any other Contributor, and only if You agree
to indemnify, defend, and hold each Contributor harmless for any liability incurred by, or claims asserted against, such Contributor by reason of your
accepting any such warranty or additional liability.

END OF TERMS AND CONDITIONS
```

### lerc 3.0.0: upstream NOTICE

The complete [upstream NOTICE](https://github.com/Esri/lerc/blob/33910e56d2d46e402b6233492eabb6c4fe0b3c5e/NOTICE) is retained, including the patent attribution and Apache patent-license statement. Only CRLF-to-LF line endings, trailing horizontal whitespace and final LF are normalized; wording and leading indentation are unchanged. Upstream raw SHA-256: `1aafa4a1157927c8a745b0856356ef32161563b4e253d02a6d3ee891dae4c21f` (679 bytes). Retained SHA-256: `dec77a45efad63cb8d1792eb6793fd5038fb9a6672d19f3e7cf3288ef543680a` (656 bytes).

```text

LERC
Copyright 2015-2018 Esri

This software embodiment is an implementation of

United States Patent 9,002,126, Limited Error Raster Compression (LERC).
Assignee: Esri.
Assignors/Inventors: Maurer, Thomas (Redlands, CA); Gao, Peng (Redlands, CA); Becker, Peter (Redlands, CA).

The right to practice this patent is hereby granted under the Apache V2.0 License Agreement,
Clause 3 - Grant of Patent License.

The license is available at
http://github.com/Esri/lerc/

For additional information, contact:

Environmental Systems Research Institute, Inc.
Attn: Contracts and Legal Department
380 New York Street
Redlands, CA 92373
E-mail: contracts@esri.com
```

### lerc 3.0.0: decoder source attribution

This attribution block is copied verbatim from the [same immutable decoder source](https://github.com/Esri/lerc/blob/33910e56d2d46e402b6233492eabb6c4fe0b3c5e/OtherLanguages/js/LercDecode.js) (lines 2-25). Its SHA-256 is `16004fe8f158abf9ed2a8b01374ccafe3c5afe2422f76ba36da06299a023f5b6`.

```text
/*
Copyright 2015-2021 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license and additional notices are located with the
source distribution at:

http://github.com/Esri/lerc/

Contributors:  Johannes Schmid, (LERC v1)
               Chayanika Khatua, (LERC v1)
               Wenxue Ju (LERC v1, v2.x)
*/
```

## @babel/helpers 7.17.0: DICOM parser class helpers

The production DICOM parser contains the emitted `classCallCheck`, `createClass` and local `defineProperties` helpers (two occurrences of each). Their implementation was checked against [the pinned Babel helper source](https://github.com/babel/babel/blob/38c23cded40af3ccc8d2c39dbe165e9b446e55a3/packages/babel-helpers/src/helpers.ts). No `toPrimitive`, `toPropertyKey` or regenerator runtime is included by this helper closure. The following MIT notice is byte-identical in the integrity-verified helpers 7.17.0 package and [immutable upstream LICENSE](https://github.com/babel/babel/blob/38c23cded40af3ccc8d2c39dbe165e9b446e55a3/LICENSE).

```text
MIT License

Copyright (c) 2014-present Sebastian McKenzie and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
