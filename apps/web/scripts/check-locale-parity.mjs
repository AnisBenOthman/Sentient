/**
 * Full-depth EN/FR locale parity check.
 *
 * WHY this exists alongside the compile-time `frResourcesMatchEn` guard in
 * src/i18n/index.ts: that guard is bounded at three levels per namespace,
 * because unbounded recursion across every namespace exceeds TypeScript's
 * instantiation limit. A key nested deeper than that silently escapes it and
 * falls back to English at runtime with no error anywhere. This script has no
 * depth limit, and also catches a namespace present in one locale but not the
 * other — which the type guard cannot see either.
 *
 * Run: pnpm --filter @sentient/web check:i18n
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const REFERENCE = 'en';
const COMPARED = ['fr'];

/** Every leaf path in a locale object, e.g. "profile.genders.MALE". */
function leafKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function namespacesIn(locale) {
  return readdirSync(join(LOCALES_DIR, locale))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length));
}

function load(locale, namespace) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, locale, `${namespace}.json`), 'utf8'));
}

let failures = 0;
const reference = namespacesIn(REFERENCE);

for (const locale of COMPARED) {
  const present = new Set(namespacesIn(locale));

  for (const namespace of reference) {
    if (!present.has(namespace)) {
      console.error(`MISSING NAMESPACE  ${locale}/${namespace}.json`);
      failures++;
      continue;
    }
    const expected = new Set(leafKeys(load(REFERENCE, namespace)));
    const actual = new Set(leafKeys(load(locale, namespace)));

    for (const key of expected) {
      if (!actual.has(key)) {
        console.error(`MISSING  ${locale}:${namespace}:${key}`);
        failures++;
      }
    }
    for (const key of actual) {
      if (!expected.has(key)) {
        console.error(`EXTRA    ${locale}:${namespace}:${key}  (not in ${REFERENCE})`);
        failures++;
      }
    }
  }

  for (const namespace of present) {
    if (!reference.includes(namespace)) {
      console.error(`EXTRA NAMESPACE    ${locale}/${namespace}.json`);
      failures++;
    }
  }
}

const total = reference.reduce((sum, ns) => sum + leafKeys(load(REFERENCE, ns)).length, 0);
if (failures > 0) {
  console.error(`\n${failures} locale parity problem(s).`);
  process.exit(1);
}
console.log(`Locale parity OK — ${total} keys across ${reference.length} namespaces, ${COMPARED.join(', ')} match ${REFERENCE}.`);
