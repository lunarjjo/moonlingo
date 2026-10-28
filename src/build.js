// moonlingo — build orchestrator.
// Reads the source site once, writes one mirrored copy per locale under
// dist/<locale>/, then generates the root page (browser-language redirect
// or a copy of the source locale).

import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isRtl } from './rtl.js';
import { loadLocales } from './locales.js';
import { transformHtml } from './html.js';
import { generateRedirectPage } from './redirect.js';

function walk(dir, base = '', acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walk(join(dir, entry.name), rel, acc);
    } else {
      acc.push(rel);
    }
  }
  return acc;
}

function ensureParent(filePath) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
}

/**
 * Run a full build.
 * @param {object} ctx { config, dir } from loadConfig()
 * @param {object} [options] { silent?: boolean }
 * @returns {object} build summary
 */
export function build(ctx, options = {}) {
  const { config, dir } = ctx;
  const started = Date.now();

  const srcDir = resolve(dir, config.src);
  const distDir = resolve(dir, config.dist);
  const localesDir = resolve(dir, config.localesDir);

  if (statSync(srcDir).isDirectory() === false) {
    throw new Error(`source directory is not a directory: ${srcDir}`);
  }

  const dicts = loadLocales(localesDir, config.locales);
  const files = walk(srcDir);
  const htmlFiles = files.filter((f) => f.toLowerCase().endsWith('.html'));
  const assetFiles = files.filter((f) => !htmlFiles.includes(f));

  const warnings = [];
  let pagesWritten = 0;
  let assetsCopied = 0;

  for (const rel of files) {
    const srcPath = join(srcDir, rel);

    for (const locale of config.locales) {
      const outPath = join(distDir, locale, rel);
      ensureParent(outPath);

      if (rel.toLowerCase().endsWith('.html')) {
        const source = readFileSync(srcPath, 'utf8');
        const depth = rel.split('/').length - 1;
        const prefix = '../'.repeat(depth);

        const alternates = config.locales.map((target) => ({
          hreflang: target,
          href: `${prefix}${target}/${rel}`,
        }));
        alternates.push({
          hreflang: 'x-default',
          href: config.root === 'source' ? `${prefix}${rel}` : `${prefix}${config.sourceLocale}/${rel}`,
        });

        const { html, warnings: pageWarnings } = transformHtml(source, dicts.get(locale), {
          locale,
          dir: isRtl(locale) ? 'rtl' : 'ltr',
          alternates,
        });
        for (const warning of pageWarnings) {
          warnings.push(`[${locale}] ${rel}: ${warning}`);
        }
        writeFileSync(outPath, html);
        pagesWritten += 1;

        if (config.root === 'source' && locale === config.sourceLocale) {
          const rootPath = join(distDir, rel);
          ensureParent(rootPath);
          writeFileSync(rootPath, html);
          pagesWritten += 1;
        }
      } else {
        copyFileSync(srcPath, outPath);
        assetsCopied += 1;
      }
    }
  }

  if (config.root === 'redirect') {
    const rootPath = join(distDir, 'index.html');
    ensureParent(rootPath);
    writeFileSync(
      rootPath,
      generateRedirectPage({ locales: config.locales, sourceLocale: config.sourceLocale, base: config.base }),
    );
  }

  const summary = {
    locales: config.locales,
    rtlLocales: config.locales.filter((locale) => isRtl(locale)),
    pages: htmlFiles.length,
    pagesWritten,
    assets: assetFiles.length,
    assetsCopied,
    warnings,
    outDir: distDir,
    root: config.root,
    ms: Date.now() - started,
  };

  if (!options.silent) printSummary(summary);
  return summary;
}

function printSummary(summary) {
  const localeList = summary.locales.join(', ');
  const rtlNote = summary.rtlLocales.length > 0 ? ` (rtl: ${summary.rtlLocales.join(', ')})` : '';
  console.log(`moonlingo build`);
  console.log(`  locales: ${localeList}${rtlNote}`);
  console.log(`  pages:   ${summary.pages} source page(s) x ${summary.locales.length} locale(s) = ${summary.pagesWritten} written`);
  console.log(`  assets:  ${summary.assets} file(s) x ${summary.locales.length} locale(s) = ${summary.assetsCopied} copied`);
  console.log(`  root:    ${summary.root}`);
  if (summary.warnings.length > 0) {
    console.log(`  warnings: ${summary.warnings.length}`);
    for (const warning of summary.warnings) {
      console.log(`    ${warning}`);
    }
  }
  console.log(`  done in ${summary.ms}ms -> ${summary.outDir}`);
}
