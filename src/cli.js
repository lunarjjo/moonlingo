// moonlingo — command line interface.

import { loadConfig } from './config.js';
import { build } from './build.js';
import { check } from './check.js';
import { init } from './init.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version;

const HELP = `moonlingo — static-first i18n for plain html

usage:
  moonlingo init                      scaffold config, dictionary and demo page
  moonlingo build [--config <path>]   build every locale into dist/
  moonlingo check  [--config <path>]  compare locale dictionaries (ci-friendly)

options:
  --config <path>   path to moonlingo.config.json (default: ./moonlingo.config.json)
  --silent          suppress output
  --version         print version
  --help            show this help

markers:
  data-i18n="key"            replace element text (leaf elements)
  data-i18n-html="key"       replace element content, raw html opt-in
  data-i18n-attr="a:key"     translate attributes (alt, placeholder, title, ...)
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--silent') {
      args.silent = true;
    } else if (arg === '--help') {
      args.help = true;
    } else if (arg === '--version') {
      args.version = true;
    } else if (arg === '--config') {
      args.config = argv[++i];
      if (args.config === undefined) {
        throw new Error('--config requires a path argument');
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function loadProjectConfig(flagPath) {
  const path = flagPath ?? 'moonlingo.config.json';
  return loadConfig(path);
}

export function run(argv) {
  const args = parseArgs(argv.slice(2));

  if (args.version) {
    console.log(VERSION);
    return 0;
  }
  if (args.help || args._.length === 0) {
    process.stdout.write(HELP);
    return args.help ? 0 : 1;
  }

  const command = args._[0];
  try {
    switch (command) {
      case 'init': {
        init({ silent: args.silent });
        return 0;
      }
      case 'build': {
        build(loadProjectConfig(args.config), { silent: args.silent });
        return 0;
      }
      case 'check': {
        const { ok, problemCount, report } = check(loadProjectConfig(args.config));
        if (!args.silent) {
          for (const entry of report) {
            const parts = [];
            if (entry.missing.length > 0) parts.push(`missing: ${entry.missing.join(', ')}`);
            if (entry.empty.length > 0) parts.push(`empty: ${entry.empty.join(', ')}`);
            if (entry.extra.length > 0) parts.push(`extra (ok): ${entry.extra.join(', ')}`);
            console.log(`  ${entry.locale}: ${parts.length > 0 ? parts.join(' | ') : 'all keys present'}`);
          }
          console.log(
            ok
              ? 'moonlingo check: ok'
              : `moonlingo check: ${problemCount} problem(s) found`,
          );
        }
        return ok ? 0 : 1;
      }
      default: {
        process.stdout.write(HELP);
        process.stderr.write(`\nmoonlingo: unknown command "${command}"\n`);
        return 1;
      }
    }
  } catch (error) {
    if (!args.silent) {
      process.stderr.write(`moonlingo: ${error.message}\n`);
    }
    return 1;
  }
}
