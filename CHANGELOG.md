# Changelog

All notable changes to moonlingo are documented here.
The format follows Keep a Changelog; versioning follows SemVer.

## [0.1.0] - 2026-10-28

### Added

- `moonlingo init` — scaffold a config, a source dictionary and a demo page.
- `moonlingo build` — build one mirrored site per locale into `dist/<locale>/`,
  with `lang`/`dir` set on `<html>` and `hreflang` alternates injected per page.
- `moonlingo check` — CI-friendly dictionary consistency report (missing,
  empty, extra keys) with a non-zero exit code on problems.
- Markers: `data-i18n` (leaf text), `data-i18n-html` (raw HTML opt-in),
  `data-i18n-attr="attr:key;..."` (attributes, works on void elements).
- Right-to-left support: automatic `dir="rtl"` for Arabic, Hebrew, Persian,
  Urdu and other RTL-script locales.
- Root page browser-language negotiation (`root: "redirect"`) or a root copy
  of the source locale (`root: "source"`).
- Ambiguous input is never silently transformed: nested markup, unclosed tags,
  void-element content markers and missing keys are reported as warnings.
- Programmatic API (`build`, `check`, `init`, `transformHtml`, `isRtl`, ...).
- Zero runtime dependencies; Node.js >= 18 (built-in modules only).
- Example site in `examples/landing` built in English, Spanish and Arabic.
