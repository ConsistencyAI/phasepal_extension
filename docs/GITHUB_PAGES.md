# GitHub Pages

The setup and privacy pages are static files in `docs/`, published from `main`
with GitHub Pages' built-in branch publishing. There is no added CI workflow.

- Setup: https://consistencyai.github.io/phasepal_extension/
- Privacy: https://consistencyai.github.io/phasepal_extension/privacy/
- Support: https://consistencyai.github.io/phasepal_extension/#support

The source repository was authorized for public release on November 6, 2026.
GitHub Free supports Pages for public repositories. The separate documentation
repository proposal was cancelled; all pages and source stay in this repository.

The publishing source is `main` and `/docs`; `.nojekyll` serves the HTML and CSS
without a Jekyll theme. The site's pages load no JavaScript, remote fonts, analytics
or third-party embeds. See `privacy/index.html` for the website hosting disclosure.

For local preview, run from the repository root:

```bash
python -m http.server 8771 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:8771/` and `/privacy/`. Local preview does not verify
production hosting. After a page update reaches main, check GitHub's Pages build
and verify both production URLs return the actual updated content.

Repository administrators can inspect Pages with:

```bash
gh api repos/ConsistencyAI/phasepal_extension/pages
gh api repos/ConsistencyAI/phasepal_extension/pages/builds/latest
```

The user manages the `main` ruleset. This change does not modify branch protections.
