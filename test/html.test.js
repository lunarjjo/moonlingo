import { test } from 'node:test';
import assert from 'node:assert/strict';

import { transformHtml } from '../src/html.js';

const DICT = {
  title: 'Hello world',
  'hero.title': 'A & B <always> "win"',
  'hero.text': 'Salam dunia',
  'photo.alt': 'A crescent moon "tonight"',
  'search.placeholder': 'Type here…',
};

function transform(source, options = {}) {
  return transformHtml(source, DICT, {
    locale: 'en',
    dir: 'ltr',
    alternates: [],
    ...options,
  });
}

test('html: replaces leaf element text and strips the marker', () => {
  const { html, warnings } = transform('<html><head></head><body><h1 data-i18n="hero.text">Source</h1></body></html>');
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('<h1>Salam dunia</h1>'));
  assert.ok(!html.includes('data-i18n'));
});

test('html: escapes text values', () => {
  const { html } = transform('<html><body><p data-i18n="hero.title">x</p></body></html>');
  // escapeText escapes &, <, > — double quotes stay readable in text nodes
  assert.ok(html.includes('A &amp; B &lt;always&gt; "win"'));
});

test('html: translates attributes and adds missing ones', () => {
  const source = '<html><body>' +
    '<img src="m.png" data-i18n-attr="alt:photo.alt">' +
    '<input data-i18n-attr="placeholder:search.placeholder">' +
    '</body></html>';
  const { html, warnings } = transform(source);
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('alt="A crescent moon &quot;tonight&quot;"'));
  assert.ok(html.includes('placeholder="Type here…"'));
  assert.ok(!html.includes('data-i18n-attr'));
});

test('html: supports several attribute pairs at once', () => {
  const { html, warnings } = transform(
    '<html><body><img data-i18n-attr="alt:photo.alt;title:title"></body></html>',
  );
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('alt="A crescent moon &quot;tonight&quot;"'));
  assert.ok(html.includes('title="Hello world"'));
});

test('html: missing attribute key keeps the element and warns', () => {
  const { html, warnings } = transform(
    '<html><body><img src="m.png" alt="keep" data-i18n-attr="alt:nope"></body></html>',
  );
  assert.ok(warnings.some((w) => w.includes('missing key "nope"')));
  assert.ok(html.includes('alt="keep"'));
});

test('html: malformed attr pair warns', () => {
  const { warnings } = transform('<html><body><img data-i18n-attr="altnocolon"></body></html>');
  assert.ok(warnings.some((w) => w.includes('malformed pair')));
});

test('html: nested markup under a text marker is skipped with a warning', () => {
  const source = '<html><body><p data-i18n="hero.text">keep <em>this</em></p></body></html>';
  const { html, warnings } = transform(source);
  assert.ok(warnings.some((w) => w.includes('nested markup')));
  assert.ok(html.includes('keep <em>this</em>'));
  assert.ok(!html.includes('data-i18n'));
});

test('html: data-i18n-html injects raw html on opt-in', () => {
  const dict = { rich: 'Hello <strong>world</strong>' };
  const { html, warnings } = transformHtml(
    '<html><body><p data-i18n-html="rich">old</p></body></html>',
    dict,
    { locale: 'en', dir: 'ltr' },
  );
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('Hello <strong>world</strong>'));
});

test('html: missing content key keeps original text and warns', () => {
  const { html, warnings } = transform('<html><body><p data-i18n="ghost">original</p></body></html>');
  assert.ok(warnings.some((w) => w.includes('missing key "ghost"')));
  assert.ok(html.includes('original'));
});

test('html: translate="no" is respected', () => {
  const { html, warnings } = transform(
    '<html><body><p translate="no" data-i18n="hero.text">Brand</p></body></html>',
  );
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('Brand'));
});

test('html: void elements warn on content markers but keep attributes working', () => {
  const { warnings } = transform('<html><body><br data-i18n="hero.text"></body></html>');
  assert.ok(warnings.some((w) => w.includes('void element')));
});

test('html: unclosed elements warn and stay untouched', () => {
  const { html, warnings } = transform('<html><body><p data-i18n="hero.text">open</body></html>');
  assert.ok(warnings.some((w) => w.includes('no closing tag')));
  assert.ok(html.includes('open'));
});

test('html: sets lang and dir on the html tag', () => {
  const { html } = transform('<html lang="en"><body></body></html>', { locale: 'ar', dir: 'rtl' });
  assert.ok(html.includes('<html lang="ar" dir="rtl">'));
});

test('html: adds lang/dir when missing', () => {
  const { html } = transform('<html><body></body></html>', { locale: 'pt-BR', dir: 'ltr' });
  assert.ok(html.includes('<html lang="pt-BR" dir="ltr">'));
});

test('html: injects hreflang alternates into head', () => {
  const { html, warnings } = transform(
    '<html><head><title>t</title></head><body></body></html>',
    {
      alternates: [
        { hreflang: 'en', href: 'en/index.html' },
        { hreflang: 'ar', href: 'ar/index.html' },
        { hreflang: 'x-default', href: 'en/index.html' },
      ],
    },
  );
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('<link rel="alternate" hreflang="en" href="en/index.html">'));
  assert.ok(html.includes('<link rel="alternate" hreflang="x-default" href="en/index.html">'));
  assert.ok(html.indexOf('</head>') > html.indexOf('hreflang="ar"'));
});

test('html: missing head warns and skips alternates', () => {
  const { html, warnings } = transform('<html><body></body></html>', {
    alternates: [{ hreflang: 'en', href: 'en/index.html' }],
  });
  assert.ok(warnings.some((w) => w.includes('no <head>')));
  assert.ok(!html.includes('hreflang'));
});

test('html: several markers on one page all resolve', () => {
  const { html, warnings } = transform(
    '<html><head></head><body>' +
      '<h1 data-i18n="hero.text">a</h1>' +
      '<p data-i18n="title">b</p>' +
      '</body></html>',
  );
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('<h1>Salam dunia</h1>'));
  assert.ok(html.includes('<p>Hello world</p>'));
});

test('html: attribute values containing ">" survive', () => {
  const { html, warnings } = transform(
    '<html><body><a data-x="a>b" href="#" data-i18n="hero.text">go</a></body></html>',
  );
  assert.equal(warnings.length, 0);
  assert.ok(html.includes('data-x="a>b"'));
  assert.ok(html.includes('>Salam dunia</a>'));
});
