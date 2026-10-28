// moonlingo — project scaffolder.
// Creates a minimal, working starting point: config, one dictionary and a
// demo page that already uses every marker type. Refuses to overwrite.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CONFIG = {
  src: 'site',
  dist: 'dist',
  localesDir: 'locales',
  sourceLocale: 'en',
  locales: ['en'],
  root: 'redirect',
};

const DICTIONARY = {
  title: 'moonlingo demo',
  nav: {
    home: 'Home',
    features: 'Features',
    about: 'About',
  },
  hero: {
    title: 'Write once, build every language',
    subtitle: 'This page was scaffolded by moonlingo. Translate the JSON, run build, ship every language.',
    cta: 'Get started',
  },
  footer: {
    line: 'Built with moonlingo.',
  },
  meta: {
    download_alt: 'Download the app',
  },
};

const DEMO_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title data-i18n="title">moonlingo demo</title>
</head>
<body>
  <nav>
    <a href="#" data-i18n="nav.home">Home</a>
    <a href="#" data-i18n="nav.features">Features</a>
    <a href="#" data-i18n="nav.about">About</a>
  </nav>

  <main>
    <h1 data-i18n="hero.title">Write once, build every language</h1>
    <p data-i18n="hero.subtitle">
      This page was scaffolded by moonlingo. Translate the JSON, run build, ship every language.
    </p>
    <a href="#" data-i18n="hero.cta">Get started</a>
  </main>

  <footer>
    <p data-i18n="footer.line">Built with moonlingo.</p>
  </footer>
</body>
</html>
`;

/**
 * Scaffold config + locales/en.json + site/index.html in the current
 * working directory.
 * @param {object} [options] { silent?: boolean }
 * @returns {string[]} created file paths
 */
export function init(options = {}) {
  const cwd = process.cwd();
  const created = [];

  const configPath = join(cwd, 'moonlingo.config.json');
  if (existsSync(configPath)) {
    throw new Error(`refusing to overwrite existing ${configPath}`);
  }

  const paths = {
    'moonlingo.config.json': JSON.stringify(CONFIG, null, 2) + '\n',
    [`locales/${CONFIG.sourceLocale}.json`]: JSON.stringify(DICTIONARY, null, 2) + '\n',
    'site/index.html': DEMO_PAGE,
  };

  for (const [rel, content] of Object.entries(paths)) {
    const target = resolve(cwd, rel);
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, content);
    created.push(rel);
  }

  if (!options.silent) {
    console.log('moonlingo init');
    for (const file of created) {
      console.log(`  created ${file}`);
    }
    console.log('');
    console.log('next steps:');
    console.log('  1. edit locales/en.json (your source dictionary)');
    console.log('  2. add more locales to moonlingo.config.json, e.g. ["en", "id", "ar"]');
    console.log(`     and create locales/<tag>.json for each of them`);
    console.log('  3. run: moonlingo build');
  }
  return created;
}
