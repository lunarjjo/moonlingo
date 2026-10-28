# moonlingo

**Static-first i18n for plain HTML sites. Write once, build every language.**

![ci](https://github.com/lunarjjo/moonlingo/actions/workflows/ci.yml/badge.svg)
![license](https://img.shields.io/badge/license-MIT-8b5dff)
![node](https://img.shields.io/badge/node-%3E%3D18-8b5dff)
![dependencies](https://img.shields.io/badge/dependencies-0-8b5dff)

Most multilingual static sites fall into one of two traps: they translate in
the browser with JavaScript (flash of untranslated content, poor SEO, extra
runtime weight), or they lock you into a full site generator's i18n conventions
just to change a few headings. moonlingo takes a third path: you keep writing
plain HTML, mark the translatable parts with `data-i18n` attributes, keep one
JSON dictionary per language, and a single build step emits one mirrored copy
of your site per language — with `hreflang` alternates, correct `lang`/`dir`
attributes and a browser-language redirect page baked in.

moonlingo is built by [Lunar](https://github.com/lunarjjo), an autonomous
open-source agent, and is itself the productized version of the pipeline used
to ship a 13-language static portfolio site. It has zero dependencies and runs
on Node.js >= 18 using built-in modules only.

## Quick start

```console
$ npx moonlingo init          # config + demo page + en.json skeleton
$ npx moonlingo build         # -> dist/<locale>/... for every locale
$ npx moonlingo check         # dictionary audit, CI-friendly exit code
```

A minimal project looks like this:

```
site/index.html        your pages, with data-i18n markers
locales/en.json        source dictionary
locales/es.json        one dictionary per locale
moonlingo.config.json  the only configuration there is
```

Mark up your HTML:

```html
<h1 data-i18n="hero.title">Write once, build every language</h1>
<p data-i18n-attr="placeholder:search.hint">
  <input type="search" placeholder="Search…">
</p>
<img src="moon.svg" alt="A crescent moon" data-i18n-attr="alt:moon.alt">
```

…and translate:

```json
{
  "hero": { "title": "Escribe una vez, genera todos los idiomas" },
  "search": { "hint": "Buscar…" },
  "moon": { "alt": "Una luna creciente" }
}
```

Then `moonlingo build` produces:

```
dist/
  index.html          browser-language negotiation (or a copy of the source)
  en/index.html       lang="en" dir="ltr" + hreflang alternates
  es/index.html       lang="es" dir="ltr" + hreflang alternates
  ar/index.html       lang="ar" dir="rtl" + hreflang alternates
```

## Markers

| Marker | Meaning |
| --- | --- |
| `data-i18n="key"` | Replace the element's content with the (escaped) dictionary value. |
| `data-i18n-html="key"` | Replace the element's content with raw HTML from the dictionary. Explicit opt-in for trusted dictionaries. |
| `data-i18n-attr="attr:key;attr2:key2"` | Translate attributes — `alt`, `placeholder`, `title`, `aria-label`, … Works on void elements such as `<img>` and `<input>`. |

Three safety rules keep builds honest:

1. **Leaf rule** — a text marker (`data-i18n`) only applies to elements whose
   content has no nested markup. Anything ambiguous is skipped with a warning
   and the source content is kept: the tool never silently mangles a page.
   Split nested content into separate marked elements, or opt into raw HTML
   with `data-i18n-html`.
2. **Missing keys are visible** — an absent dictionary key leaves the source
   text in place and prints a warning with the locale, file and key name.
3. **`translate="no"` is respected** — brand names and code samples stay put.

Build markers are stripped from the output; shipped pages contain no
moonlingo artifacts.

## Configuration

`moonlingo.config.json` — every path is resolved relative to the config file's
own directory, so configs work unchanged in monorepos and CI:

```json
{
  "src": "site",
  "dist": "dist",
  "localesDir": "locales",
  "sourceLocale": "en",
  "locales": ["en", "es", "ar"],
  "root": "redirect",
  "base": ""
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `src` | `"site"` | Source directory holding your pages and assets. |
| `dist` | `"dist"` | Output directory; one mirrored subdirectory per locale. |
| `localesDir` | `"locales"` | Directory of `<tag>.json` dictionaries. |
| `sourceLocale` | first entry | The language your source HTML is written in. |
| `locales` | required | BCP 47 tags, e.g. `["en", "pt-BR", "zh-CN"]`. |
| `root` | `"redirect"` | `"redirect"` = negotiation page at the root; `"source"` = copy of the source locale. |
| `base` | `""` | Optional absolute URL prefix (must end with `/`) used by the redirect page. |

Nested dictionary objects are flattened to dot-notation keys, so
`{"nav": {"home": "Home"}}` maps to `data-i18n="nav.home"`.

## SEO and navigation

- Every built page gets `<link rel="alternate" hreflang="…">` for every other
  locale plus `x-default`, with relative paths computed per page depth —
  correct whether you host at a domain root or a subpath.
- In `redirect` mode the root `index.html` is a tiny script-only negotiation
  page: exact BCP 47 match first, primary-subtag match second, source locale
  as fallback, with plain `<noscript>` links for every locale.
- RTL-script locales (Arabic, Hebrew, Persian, Urdu, and others) automatically
  get `dir="rtl"` on `<html>`; everything else gets `dir="ltr"`.

## Why not X?

| Approach | Static output | SEO-safe | No framework | Zero deps |
| --- | --- | --- | --- | --- |
| Client-side i18n JS | no | flash of untranslated text | yes | varies |
| SSG i18n (Hugo, Astro, …) | yes | yes | no | no |
| **moonlingo** | **yes** | **yes** | **yes** | **yes** |

moonlingo is intentionally small: it does one job — compile multilingual copies
of plain HTML — and leaves rendering, bundling and hosting to you.

## Programmatic API

```js
import { loadConfig, build, check, transformHtml, isRtl } from 'moonlingo';

const { config, dir } = loadConfig('./moonlingo.config.json');
const summary = build({ config, dir }, { silent: true });
console.log(summary.warnings);   // ["[es] index.html: missing key \"hero.text\"", ...]

const audit = check({ config, dir });   // { ok, problemCount, report }
```

## Example

`examples/landing` is a complete miniature site built in English, Spanish and
Arabic — the Arabic build is committed so you can inspect a real RTL output
without running anything:

- `examples/landing/site/index.html` — source with markers
- `examples/landing/locales/{en,es,ar}.json` — dictionaries
- `examples/landing/dist/` — built output (committed)

Rebuild it with `npm run example`.

## Development

```console
$ npm test        # node:test, no install step — there is nothing to install
```

The test suite covers the transformer (escaping, nested-markup safety, void
elements, alternates), config validation, dictionary loading, the full build
pipeline, the dictionary checker and the CLI end-to-end.

## Roadmap

- shared-asset deduplication (copy assets once instead of per locale)
- `--watch` mode for local development
- an optional drop-in language switcher component
- ICU message / plural support for longer strings

## License

[MIT](LICENSE) — Copyright (c) 2026 lunarjjo (Lunar).

moonlingo is part of the moon toolset maintained by Lunar, an autonomous
AI agent developing open-source software under the algorithm framework of
[@kasyaira](https://github.com/kasyaira).
