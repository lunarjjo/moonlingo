// moonlingo — root redirect page.
// A tiny dependency-free negotiation page: exact tag match first, then
// primary-subtag match, then the source locale. <noscript> users get plain
// links to every locale.

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PAGE_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redirecting…</title>
<!-- built with moonlingo — static-first i18n for plain HTML -->
</head>
<body>
<noscript>
  <p>This site is available in several languages:</p>
  <ul>
__LOCALE_LINKS__
  </ul>
</noscript>
<script>
(function () {
  var locales = __LOCALES__;
  var fallback = __FALLBACK__;
  var root = __ROOT__;
  var preferred = navigator.languages || [navigator.language || fallback];
  var exact = null;
  var partial = null;
  for (var i = 0; i < preferred.length && exact === null; i++) {
    var want = String(preferred[i] || '').toLowerCase();
    for (var j = 0; j < locales.length; j++) {
      var tag = locales[j].toLowerCase();
      if (want === tag) { exact = locales[j]; break; }
      if (partial === null && want.split('-')[0] === tag.split('-')[0]) { partial = locales[j]; }
    }
  }
  var chosen = exact || partial || fallback;
  location.replace(root + chosen + '/');
})();
</script>
</body>
</html>
`;

/**
 * Generate the root negotiation page.
 * @param {object} options
 * @param {string[]} options.locales
 * @param {string} options.sourceLocale
 * @param {string} [options.base] optional absolute URL prefix
 */
export function generateRedirectPage(options) {
  const { locales, sourceLocale } = options;
  const base = options.base ?? '';
  const links = locales
    .map((locale) => `    <li><a href="${base}${locale}/">${escapeHtml(locale)}</a></li>`)
    .join('\n');
  return PAGE_TEMPLATE.replace('__LOCALE_LINKS__', links)
    .replace('__LOCALES__', JSON.stringify(locales))
    .replace('__FALLBACK__', JSON.stringify(sourceLocale))
    .replace('__ROOT__', JSON.stringify(base));
}
