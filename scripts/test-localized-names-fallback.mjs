import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function testMissingTranslationsSchema() {
  const missingFile = path.join(root, "data", "missing-translations.json");
  const missingData = JSON.parse(await readFile(missingFile, "utf8"));
  assert.equal(missingData.schemaVersion, "1.0.0", "Missing translations schema version must be 1.0.0");
  assert.equal(typeof missingData.missingCount, "number", "missingCount must be a number");
  assert.ok(Array.isArray(missingData.items), "items must be an array");
}

async function testFallbackLocalizedNamesConsistency() {
  const localizedFile = path.join(root, "data", "localized-names.json");
  const localizedData = JSON.parse(await readFile(localizedFile, "utf8"));
  assert.ok(localizedData.names, "names object must exist");
  assert.equal(typeof localizedData.counts.fallback, "number", "counts.fallback must be a number");

  const missingFile = path.join(root, "data", "missing-translations.json");
  const missingData = JSON.parse(await readFile(missingFile, "utf8"));
  assert.equal(missingData.missingCount, localizedData.counts.fallback, "missingCount must match localized-names.json fallback count");
}

await testMissingTranslationsSchema();
await testFallbackLocalizedNamesConsistency();
process.stdout.write("Localized names fallback tests passed.\n");
