// moonlingo — dictionary consistency checker (CI-friendly).
// Compares every locale against the source locale: missing keys and empty
// values are problems; extra keys are reported as notes only.

import { resolve } from 'node:path';

import { loadLocales } from './locales.js';

/**
 * Check all locale dictionaries for missing / extra / empty keys.
 * @param {object} ctx { config, dir } from loadConfig()
 * @returns {{ ok: boolean, problemCount: number, report: Array<object> }}
 */
export function check(ctx) {
  const { config, dir } = ctx;
  const dicts = loadLocales(resolve(dir, config.localesDir), config.locales);
  const sourceKeys = new Set(Object.keys(dicts.get(config.sourceLocale)));

  const report = [];
  let problemCount = 0;

  for (const locale of config.locales) {
    const dict = dicts.get(locale);
    const keys = Object.keys(dict);
    const keySet = new Set(keys);

    const missing = [...sourceKeys].filter((key) => !keySet.has(key));
    const extra = keys.filter((key) => !sourceKeys.has(key));
    const empty = keys.filter((key) => dict[key] === '');

    if (locale === config.sourceLocale) {
      // the source locale cannot miss its own keys; extra is meaningless there
      problemCount += empty.length;
      report.push({ locale, missing: [], extra: [], empty });
      continue;
    }

    problemCount += missing.length + empty.length;
    report.push({ locale, missing, extra, empty });
  }

  return { ok: problemCount === 0, problemCount, report };
}
