// moonlingo — targeted HTML transformer (zero-dependency).
//
// Design contract:
//   1. Transformations are strictly attribute-targeted (`data-i18n*` markers).
//   2. Anything ambiguous (nested markup under a text marker, unclosed tags,
//      missing keys, void elements) is reported as a warning and left
//      untouched — this tool never corrupts a page silently.
//   3. Build markers are stripped from the output; pages stay clean.

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// An open tag: name + body where quoted values may contain anything
// (including ">") and unquoted text may not contain ">".
const OPEN_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

// A nested element, closing tag or comment inside element content.
const NESTED_RE = /<[a-zA-Z!/]/;

const DATA_I18N_ATTR = 'data-i18n-attr';
const DATA_I18N_HTML = 'data-i18n-html';
const DATA_I18N = 'data-i18n';

export function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Parse the attribute region of an open tag into an ordered list.
 * Each entry keeps its raw source text so untouched attributes are
 * re-rendered byte-identically.
 */
function parseAttrs(body) {
  const attrs = [];
  const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    let value = null;
    if (m[2] !== undefined) {
      value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
    }
    attrs.push({ name: m[1], value, raw: m[0], changed: false });
  }
  return attrs;
}

function findAttr(attrs, name) {
  const lower = name.toLowerCase();
  return attrs.find((a) => a.name.toLowerCase() === lower);
}

function setAttr(attrs, name, value) {
  const existing = findAttr(attrs, name);
  if (existing) {
    existing.value = value;
    existing.changed = true;
  } else {
    attrs.push({ name, value, raw: '', changed: true });
  }
}

function renderAttrs(attrs) {
  return attrs
    .map((a) => (a.changed ? `${a.name}="${a.value}"` : a.raw))
    .join(' ');
}

function hasMarker(body, name) {
  return new RegExp(`(?:^|\\s)${name}=`).test(body);
}

/**
 * Pass A — translate attributes declared via data-i18n-attr="attr:key;...".
 * Works for void elements too (<img alt=...>, <input placeholder=...>).
 */
function passAttrs(html, dict, warnings) {
  OPEN_TAG_RE.lastIndex = 0;
  let out = '';
  let last = 0;
  let touched = false;
  let m;
  while ((m = OPEN_TAG_RE.exec(html)) !== null) {
    const body = m[2];
    if (!hasMarker(body, DATA_I18N_ATTR)) continue;

    const attrs = parseAttrs(body);
    const marker = findAttr(attrs, DATA_I18N_ATTR);
    const pairs = String(marker?.value ?? '')
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean);

    for (const pair of pairs) {
      const colon = pair.indexOf(':');
      if (colon === -1) {
        warnings.push(`${DATA_I18N_ATTR}: malformed pair "${pair}" (expected attr:key)`);
        continue;
      }
      const attrName = pair.slice(0, colon).trim();
      const key = pair.slice(colon + 1).trim();
      if (attrName.length === 0 || key.length === 0) {
        warnings.push(`${DATA_I18N_ATTR}: malformed pair "${pair}" (expected attr:key)`);
        continue;
      }
      if (!(key in dict)) {
        warnings.push(`${DATA_I18N_ATTR}: missing key "${key}" (attribute ${attrName})`);
        continue;
      }
      setAttr(attrs, attrName, escapeAttr(dict[key]));
    }

    const kept = attrs.filter((a) => a.name.toLowerCase() !== DATA_I18N_ATTR);
    const selfClose = /\/\s*$/.test(body) ? '/' : '';
    const rebuilt = `<${m[1]}${kept.length > 0 ? ' ' + renderAttrs(kept) : ''}${selfClose}>`;
    out += html.slice(last, m.index) + rebuilt;
    last = m.index + m[0].length;
    touched = true;
  }
  return touched ? out + html.slice(last) : html;
}

/**
 * Pass B — replace element content for data-i18n / data-i18n-html markers.
 * Elements with nested markup are skipped with a warning (split them, or
 * opt in with data-i18n-html). translate="no" elements are respected.
 */
function passContent(html, dict, warnings) {
  OPEN_TAG_RE.lastIndex = 0;
  let out = '';
  let last = 0;
  let touched = false;
  let m;
  while ((m = OPEN_TAG_RE.exec(html)) !== null) {
    const body = m[2];
    const marker = new RegExp(`(?:^|\\s)(${DATA_I18N}|${DATA_I18N_HTML})="([^"]*)"`, 'i').exec(body);
    if (!marker) continue;

    const isHtmlMarker = marker[1].toLowerCase() === DATA_I18N_HTML;
    const key = marker[2];
    const tag = m[1].toLowerCase();

    let inner = null;
    let closeEnd = -1;
    let closeText = '';
    if (VOID_ELEMENTS.has(tag)) {
      warnings.push(`${DATA_I18N} on void element <${tag}> ignored (use ${DATA_I18N_ATTR})`);
    } else {
      const closeRe = new RegExp(`</\\s*${tag}\\s*>`, 'gi');
      closeRe.lastIndex = m.index + m[0].length;
      const close = closeRe.exec(html);
      if (!close) {
        warnings.push(`<${tag} ${DATA_I18N}="${key}"> has no closing tag — skipped`);
      } else {
        closeText = close[0];
        inner = html.slice(m.index + m[0].length, close.index);
        closeEnd = close.index + close[0].length;
      }
    }

    if (inner !== null) {
      const translateNo = /(?:^|\s)translate\s*=\s*("no"|'no')/i.test(body);
      const nested = NESTED_RE.test(inner);
      if (!(key in dict)) {
        warnings.push(`missing key "${key}" in <${tag}> — content kept`);
      } else if (translateNo) {
        // author opted out; keep original content
      } else if (nested && !isHtmlMarker) {
        warnings.push(
          `<${tag} ${DATA_I18N}="${key}"> contains nested markup — skipped ` +
            `(split into separate marked elements or use ${DATA_I18N_HTML})`,
        );
      } else {
        const replacement = isHtmlMarker ? String(dict[key]) : escapeText(dict[key]);
        out += html.slice(last, m.index) + m[0] + replacement + closeText;
        last = closeEnd;
        touched = true;
        continue;
      }
    }
  }
  return touched ? out + html.slice(last) : html;
}

/**
 * Pass C — set lang and dir on the <html> tag.
 */
function passHtmlTag(html, locale, dir, warnings) {
  const m = /<html\b([^>]*)>/i.exec(html);
  if (!m) {
    warnings.push('no <html> tag found — lang/dir not set');
    return html;
  }
  const attrs = parseAttrs(m[1]);
  setAttr(attrs, 'lang', locale);
  setAttr(attrs, 'dir', dir);
  const rebuilt = `<html${attrs.length > 0 ? ' ' + renderAttrs(attrs) : ''}>`;
  return html.slice(0, m.index) + rebuilt + html.slice(m.index + m[0].length);
}

/**
 * Pass D — inject <link rel="alternate" hreflang=...> alternates.
 */
function passAlternates(html, alternates, warnings) {
  if (!alternates || alternates.length === 0) return html;
  const links = alternates
    .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${escapeAttr(a.href)}">`)
    .join('\n  ');
  let m = /<\/head\s*>/i.exec(html);
  if (m) return html.slice(0, m.index) + links + '\n' + html.slice(m.index);
  m = /<head\b[^>]*>/i.exec(html);
  if (m) {
    const at = m.index + m[0].length;
    return html.slice(0, at) + '\n  ' + links + html.slice(at);
  }
  warnings.push('no <head> found — hreflang links not injected');
  return html;
}

const STRIP_VALUED = /\s+data-i18n(?:-attr|-html)?="[^"]*"/g;
const STRIP_BARE = /\s+data-i18n(?:-attr|-html)?(?=[\s>])/g;

/**
 * Transform one HTML document for one locale.
 * @param {string} html source document
 * @param {Record<string, string>} dict flattened dictionary for this locale
 * @param {object} options
 * @param {string} options.locale language tag (set on <html lang>)
 * @param {'rtl'|'ltr'} options.dir text direction (set on <html dir>)
 * @param {Array<{hreflang: string, href: string}>} [options.alternates]
 * @returns {{ html: string, warnings: string[] }}
 */
export function transformHtml(html, dict, options) {
  const warnings = [];
  let result = passAttrs(html, dict, warnings);
  result = passContent(result, dict, warnings);
  result = passHtmlTag(result, options.locale, options.dir, warnings);
  result = passAlternates(result, options.alternates, warnings);
  result = result.replace(STRIP_VALUED, '').replace(STRIP_BARE, '');
  return { html: result, warnings };
}
