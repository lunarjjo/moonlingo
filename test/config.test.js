import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateConfig } from '../src/config.js';

const VALID = { locales: ['en', 'id', 'ar'] };

test('config: defaults are applied', () => {
  const config = validateConfig(VALID);
  assert.deepEqual(config, {
    src: 'site',
    dist: 'dist',
    localesDir: 'locales',
    sourceLocale: 'en',
    locales: ['en', 'id', 'ar'],
    root: 'redirect',
    base: '',
  });
});

test('config: sourceLocale defaults to the first locale', () => {
  const config = validateConfig({ locales: ['es', 'en'], sourceLocale: 'en' });
  assert.equal(config.sourceLocale, 'en');
});

test('config: explicit paths and root mode are kept', () => {
  const config = validateConfig({
    locales: ['en', 'es'],
    src: 'public',
    dist: 'build',
    localesDir: 'i18n',
    root: 'source',
    base: 'https://example.com/site/',
  });
  assert.equal(config.src, 'public');
  assert.equal(config.dist, 'build');
  assert.equal(config.localesDir, 'i18n');
  assert.equal(config.root, 'source');
  assert.equal(config.base, 'https://example.com/site/');
});

test('config: rejects empty or missing locales', () => {
  assert.throws(() => validateConfig({}), /non-empty array/);
  assert.throws(() => validateConfig({ locales: [] }), /non-empty array/);
  assert.throws(() => validateConfig({ locales: 'en' }), /non-empty array/);
});

test('config: rejects invalid language tags', () => {
  assert.throws(() => validateConfig({ locales: ['en', 'not a tag'] }), /invalid language tag/);
  assert.throws(() => validateConfig({ locales: ['en', ''] }), /invalid language tag/);
  assert.throws(() => validateConfig({ locales: ['en', 42] }), /invalid language tag/);
});

test('config: rejects duplicate locales (case-insensitive)', () => {
  assert.throws(() => validateConfig({ locales: ['en', 'EN'] }), /duplicate locale/);
  assert.throws(() => validateConfig({ locales: ['en', 'pt-BR', 'PT-br'] }), /duplicate locale/);
});

test('config: sourceLocale must be one of the locales', () => {
  assert.throws(() => validateConfig({ locales: ['en', 'id'], sourceLocale: 'fr' }), /sourceLocale/);
});

test('config: rejects unknown root modes', () => {
  assert.throws(() => validateConfig({ locales: ['en'], root: 'both' }), /"root" must be/);
});

test('config: base must end with a slash', () => {
  assert.throws(() => validateConfig({ locales: ['en'], base: 'https://example.com' }), /must end with/);
});

test('config: paths must be relative and safe', () => {
  assert.throws(() => validateConfig({ locales: ['en'], src: '/etc' }), /relative path/);
  assert.throws(() => validateConfig({ locales: ['en'], dist: '../escape' }), /relative path/);
});

test('config: rejects non-object input', () => {
  assert.throws(() => validateConfig(null), /JSON object/);
  assert.throws(() => validateConfig([1, 2]), /JSON object/);
});
