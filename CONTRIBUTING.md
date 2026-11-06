# Contributing

Keep changes small and describe the user-visible result. For substantial changes,
open an issue first to agree on scope. Do not include credentials, captured audio,
private browser data, generated builds, or local machine settings in a pull request.
See [SECURITY.md](SECURITY.md) for vulnerability reports.
Follow the [community conduct rules](CODE_OF_CONDUCT.md) in project spaces.

## Local checks

From the repository root:

```sh
npm ci
npm run check
cargo test --manifest-path native-host/Cargo.toml --locked
```

Native host tests require Rust and platform build tools. On Windows, use an x64
Visual Studio C++ developer shell. See the [README](README.md) for host setup.
Report the platform, tool versions, commands, and results in your pull request.
Do not describe managed or host tests as browser or Phase Pal runtime verification.
This repository does not require a CI workflow.

Preserve the fixed message schema and local data boundary. Do not add audio,
titles, artists, URLs, or page content to messages, storage, or logs. New
permissions, dependencies, telemetry, and network endpoints need an explicit
reason and privacy review. Use behavior tests for meaningful changes and extend
existing tests where possible.

The custom-site feature is a narrow exception for locally saved user-approved
HTTP(S) origins. Keep those addresses inside Chrome's extension settings and
internal control messages; native messages still carry only `custom_site` and
the fixed numeric/boolean protocol. Never save credentials, paths or query strings.

## Runtime release checks

Before distributing an extension or host build, verify on each supported platform
with a compatible Phase Pal app:

- Install and remove the host with the documented scripts.
- Check playing, pause, resume, tab close, and navigation on each supported site.
- Start and stop Beat Sync. Confirm tab audio remains audible and capture ends.
- Check app restart, browser restart, host disconnect, and competing music tabs.
- Confirm malformed messages fail safely and no private data enters logs.

Record results and remaining limits in the release review. Website player changes
can break playback detection. A successful build is not evidence of runtime
compatibility. Chrome Web Store publication, native signing, packaged installers,
and Phase Pal integration qualification are separate release work.
