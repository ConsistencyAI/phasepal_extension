# Security reporting

This project is in development. There is no published support period or security
response time commitment.

Do not put vulnerability details, credentials, audio, or private browser data in
public issues or pull requests. Email [hello@consistencyai.net](mailto:hello@consistencyai.net)
for private security reports. If GitHub shows **Security > Report a vulnerability**
for this repository, you can also use that private channel. Its availability
depends on the repository settings.

Include the affected commit/version, platform, required setup, impact, and minimal
reproduction steps in the private report. Remove tokens and personal data.

## Scope and limits

The extension captures tab audio only after the popup action. Audio analysis runs
locally. The native host validates a fixed protocol and connects to Phase Pal on
loopback with a token read from the app's runtime descriptor. The installer allows
one extension ID. These controls do not protect against a compromised local user
account, browser, or Phase Pal process.

The host depends on Phase Pal to create and protect its runtime descriptor and
validate its handshake. That application is outside this repository. Do not share
the descriptor or its session token. Do not treat the public manifest key as a
secret. See [the privacy document](docs/PRIVACY.md) for data flow and permissions.
