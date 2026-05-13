# NW.js Wrapper

This directory owns the desktop wrapping mechanics for JSHack. The browser app remains canonical; NW.js is only a containment/distribution shell around `index.html`.

## Stage the App

```sh
deno task wrap:nwjs
```

This writes `dist/nwjs/app/` with:

- the existing browser entry files
- `src/`
- `assets/`
- an NW.js `package.json`

Run that staged app with a local NW.js runtime:

```sh
/path/to/nw dist/nwjs/app
```

## Stage with an Unpacked Runtime

Download and unpack the NW.js runtime for the target platform yourself, then run:

```sh
deno task wrap:nwjs --runtime /path/to/nwjs-runtime
```

The task copies the runtime into `dist/nwjs/runtime/` and places the app in `dist/nwjs/runtime/package.nw/`, which is the platform-specific folder you distribute.

For macOS runtimes, the task detects the `.app` bundle and places the app at:

```text
runtime/JSHack.app/Contents/Resources/app.nw/
```

For Windows runtimes, the task creates a `jshack.exe` launcher beside `nw.exe`.

Current release archive naming:

```text
dist/jshack-nwjs-v<version>-linux-x64.tar.gz
dist/jshack-nwjs-v<version>-win-x64.zip
dist/jshack-nwjs-v<version>-osx-arm64.zip
```

## Boundaries

- Do not import NW.js APIs from `src/rules/`, `src/bridge/`, `src/display/`, or `src/main/`.
- Keep desktop-only files in `packaging/nwjs/`.
- Keep `index.html` runnable in a normal browser.
- Do not add a build step for local game development.
