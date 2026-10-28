import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { check } from '../src/check.js';
import { validateConfig } from '../src/config.js';

function makeProject(dictionaries) {
  const dir = mkdtempSync(join(tmpdir(), 'moonlingo-check-'));
  mkdirSync(join(dir, 'locales'), { recursive: true });
  for (const [tag, dict] of Object.entries(dictionaries)) {
    writeFileSync(join(dir, 'locales', `${tag}.json`), JSON.stringify(dict));
  }
  const config = validateConfig({ locales: Object.keys(dictionaries), sourceLocale: 'en' });
  return { ctx: { config, dir }, dir };
}

test('check: perfect dictionaries pass', () => {
  const { ctx, dir } = makeProject({
    en: { 'a.b': 'hello', c: 'x' },
    id: { 'a.b': 'halo', c: 'y' },
  });
  try {
    const { ok, problemCount, report } = check(ctx);
    assert.equal(ok, true);
    assert.equal(problemCount, 0);
    assert.deepEqual(report[1], { locale: 'id', missing: [], extra: [], empty: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check: missing and empty keys are problems, extra keys are notes', () => {
  const { ctx, dir } = makeProject({
    en: { keep: 'k', gone: 'g', empty: '' },
    id: { keep: 'k2', gone: '' }, // missing "empty", empty "gone"
    fr: { keep: 'k3', gone: 'g3', empty: 'e3', bonus: 'b' }, // extra "bonus"
  });
  try {
    const { ok, problemCount, report } = check(ctx);
    assert.equal(ok, false);
    // problems: id.missing(empty)=1, id.empty(gone)=1, en.empty=1
    assert.equal(problemCount, 3);

    const id = report.find((r) => r.locale === 'id');
    assert.deepEqual(id.missing, ['empty']);
    assert.deepEqual(id.empty, ['gone']);

    const fr = report.find((r) => r.locale === 'fr');
    assert.deepEqual(fr.extra, ['bonus']);
    assert.deepEqual(fr.missing, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check: empty value in the source locale counts as a problem', () => {
  const { ctx, dir } = makeProject({
    en: { a: 'x', blank: '' },
    id: { a: 'y', blank: 'z' },
  });
  try {
    const { ok, problemCount } = check(ctx);
    assert.equal(ok, false);
    assert.equal(problemCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
