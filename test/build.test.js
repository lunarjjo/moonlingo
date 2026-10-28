import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from '../src/build.js';
import { validateConfig } from '../src/config.js';

const EN = {
  title: 'My site',
  'hero.title': 'Welcome home',
  'hero.text': 'This is my little corner of the web.',
  'photo.alt': 'A photo of the moon',
};
const ES = {
  title: 'Mi sitio',
  'hero.title': 'Bienvenido a casa',
  // hero.text intentionally missing -> warning expected
  'photo.alt': 'Una foto de la luna',
};
const AR = {
  title: 'موقعي',
  'hero.title': 'أهلاً بك في البيت',
  'hero.text': 'هذه ركني الصغير على الشبكة.',
  'photo.alt': 'صورة للقمر',
};

function makeProject(root = 'redirect', at) {
  const dir = at ?? mkdtempSync(join(tmpdir(), 'moonlingo-build-'));
  mkdirSync(join(dir, 'site', 'css'), { recursive: true });
  mkdirSync(join(dir, 'site', 'docs'), { recursive: true });
  mkdirSync(join(dir, 'locales'), { recursive: true });

  writeFileSync(
    join(dir, 'site', 'index.html'),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title data-i18n="title">My site</title>
</head>
<body>
  <h1 data-i18n="hero.title">Welcome home</h1>
  <p data-i18n="hero.text">This is my little corner of the web.</p>
  <img src="css/moon.png" alt="A photo of the moon" data-i18n-attr="alt:photo.alt">
</body>
</html>
`,
  );
  writeFileSync(
    join(dir, 'site', 'docs', 'guide.html'),
    '<!doctype html>\n<html lang="en">\n<head><title>guide</title></head>\n<body><p data-i18n="hero.text">text</p></body>\n</html>\n',
  );
  writeFileSync(join(dir, 'site', 'css', 'style.css'), 'body { margin: 0; }\n');
  writeFileSync(join(dir, 'locales', 'en.json'), JSON.stringify(EN));
  writeFileSync(join(dir, 'locales', 'es.json'), JSON.stringify(ES));
  writeFileSync(join(dir, 'locales', 'ar.json'), JSON.stringify(AR));

  const config = validateConfig({ locales: ['en', 'es', 'ar'], root });
  return { ctx: { config, dir }, dir };
}

test('build: writes one mirrored site per locale with redirect root', () => {
  const { ctx, dir } = makeProject();
  try {
    const summary = build(ctx, { silent: true });

    assert.deepEqual(summary.locales, ['en', 'es', 'ar']);
    assert.deepEqual(summary.rtlLocales, ['ar']);
    assert.equal(summary.pages, 2);
    assert.equal(summary.pagesWritten, 6);
    assert.equal(summary.assets, 1); // style.css
    assert.equal(summary.assetsCopied, 3);
    assert.ok(summary.warnings.some((w) => w.includes('[es] index.html: missing key "hero.text"')));

    // english page
    const en = readFileSync(join(dir, 'dist', 'en', 'index.html'), 'utf8');
    assert.ok(en.includes('<title>My site</title>'));
    assert.ok(en.includes('<h1>Welcome home</h1>'));
    assert.ok(en.includes('alt="A photo of the moon"'));
    assert.ok(en.includes('<html lang="en" dir="ltr">'));
    assert.ok(!en.includes('data-i18n'));

    // hreflang alternates (depth 0 -> no ../ prefix)
    assert.ok(en.includes('<link rel="alternate" hreflang="es" href="es/index.html">'));
    assert.ok(en.includes('<link rel="alternate" hreflang="x-default" href="en/index.html">'));

    // spanish page keeps source text for the missing key
    const es = readFileSync(join(dir, 'dist', 'es', 'index.html'), 'utf8');
    assert.ok(es.includes('<h1>Bienvenido a casa</h1>'));
    assert.ok(es.includes('This is my little corner of the web.'));

    // arabic page flips direction
    const ar = readFileSync(join(dir, 'dist', 'ar', 'index.html'), 'utf8');
    assert.ok(ar.includes('<html lang="ar" dir="rtl">'));
    assert.ok(ar.includes('أهلاً بك في البيت'));

    // nested page gets ../ prefixes in alternates and mirrored output
    const guide = readFileSync(join(dir, 'dist', 'es', 'docs', 'guide.html'), 'utf8');
    assert.ok(guide.includes('hreflang="ar" href="../ar/docs/guide.html"'));
    assert.ok(guide.includes('hreflang="x-default" href="../en/docs/guide.html"'));

    // assets are copied into every locale directory
    for (const locale of ['en', 'es', 'ar']) {
      assert.ok(existsSync(join(dir, 'dist', locale, 'css', 'style.css')));
    }

    // root redirect page negotiates languages
    const root = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
    assert.ok(root.includes('location.replace'));
    assert.ok(root.includes('"en","es","ar"'));
    assert.ok(root.includes('href="es/"'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('build: root=source copies the source locale to the root instead', () => {
  const { ctx, dir } = makeProject('source');
  try {
    const summary = build(ctx, { silent: true });
    const rootPage = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
    const enPage = readFileSync(join(dir, 'dist', 'en', 'index.html'), 'utf8');
    assert.equal(rootPage, enPage);
    assert.ok(!rootPage.includes('location.replace'));
    assert.equal(summary.pagesWritten, 8); // 6 locale pages + 2 root copies
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('build: resolves every path relative to the config directory', () => {
  // fixture lives two levels below the temp root; cwd is never consulted
  const parent = mkdtempSync(join(tmpdir(), 'moonlingo-nested-'));
  const nested = join(parent, 'proj', 'deep');
  mkdirSync(nested, { recursive: true });
  try {
    const { ctx } = makeProject('redirect', nested);
    const summary = build({ config: ctx.config, dir: nested }, { silent: true });
    assert.equal(summary.pagesWritten, 6);
    assert.ok(existsSync(join(nested, 'dist', 'en', 'index.html')));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('build: rejects a missing source directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moonlingo-miss-'));
  try {
    const config = validateConfig({ locales: ['en'] });
    assert.throws(() => build({ config, dir }, { silent: true }), /ENOENT|not a directory|no such/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
