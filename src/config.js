// moonlingo — config loading and validation.
// All paths in the config are resolved relative to the config file's own
// directory, so a config can live anywhere (monorepos, examples, CI).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const LANG_TAG_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const ROOT_MODES = new Set(['redirect', 'source']);

export const DEFAULTS = Object.freeze({
  src: 'site',
  dist: 'dist',
  localesDir: 'locales',
  sourceLocale: null, // defaults to the first entry of locales
  locales: null, // required
  root: 'redirect',
  base: '',
});

export function validateConfig(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config must be a JSON object');
  }

  const locales = raw.locales;
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new Error('"locales" must be a non-empty array of language tags, e.g. ["en", "id"]');
  }

  const seen = new Set();
  for (const tag of locales) {
    if (typeof tag !== 'string' || !LANG_TAG_RE.test(tag)) {
      throw new Error(`invalid language tag: ${JSON.stringify(tag)} (expected BCP 47 style, e.g. "en" or "pt-BR")`);
    }
    const lower = tag.toLowerCase();
    if (seen.has(lower)) {
      throw new Error(`duplicate locale (case-insensitive): ${tag}`);
    }
    seen.add(lower);
  }

  let sourceLocale = raw.sourceLocale ?? locales[0];
  if (typeof sourceLocale !== 'string' || !seen.has(sourceLocale.toLowerCase())) {
    throw new Error('"sourceLocale" must be one of the entries in "locales"');
  }
  sourceLocale = locales.find((t) => t.toLowerCase() === sourceLocale.toLowerCase());

  const root = raw.root ?? DEFAULTS.root;
  if (typeof root !== 'string' || !ROOT_MODES.has(root)) {
    throw new Error(`"root" must be one of: ${[...ROOT_MODES].join(', ')} (got ${JSON.stringify(root)})`);
  }

  let base = raw.base ?? DEFAULTS.base;
  if (typeof base !== 'string') {
    throw new Error('"base" must be a string URL prefix, e.g. "https://example.com/"');
  }
  if (base !== '' && !base.endsWith('/')) {
    throw new Error('"base" must end with "/" (got ' + JSON.stringify(base) + ')');
  }

  const str = (value, fallback, name) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value.length === 0 || value.startsWith('/') || value.includes('..')) {
      throw new Error(`"${name}" must be a relative path without leading "/" or ".."`);
    }
    return value;
  };

  return {
    src: str(raw.src, DEFAULTS.src, 'src'),
    dist: str(raw.dist, DEFAULTS.dist, 'dist'),
    localesDir: str(raw.localesDir, DEFAULTS.localesDir, 'localesDir'),
    sourceLocale,
    locales: [...locales],
    root,
    base,
  };
}

/**
 * Load a moonlingo.config.json file.
 * @param {string} configPath path to the config file
 * @returns {{ config: object, dir: string }} validated config plus the
 *   directory it lives in (all relative paths resolve against it).
 */
export function loadConfig(configPath) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`config file not found: ${configPath} — run "moonlingo init" first`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`invalid JSON in ${configPath}: ${error.message}`);
    }
    throw error;
  }
  return { config: validateConfig(raw), dir: dirname(resolve(configPath)) };
}
