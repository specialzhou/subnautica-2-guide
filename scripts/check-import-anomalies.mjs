import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function readBaseline(relativePath) {
  return JSON.parse(execFileSync("git", ["show", `HEAD:${relativePath}`], { cwd: root, encoding: "utf8" }));
}

const currentEntities = await readJson("data/wiki-entities.json");
const previousEntities = readBaseline("data/wiki-entities.json");
const currentStory = await readJson("data/wiki-story.json");
const previousStory = readBaseline("data/wiki-story.json");
const failures = [];

function rejectLargeDrop(label, previous, current, threshold = 0.2) {
  if (previous > 0 && current < previous * (1 - threshold)) {
    failures.push(`${label} dropped from ${previous} to ${current} (> ${Math.round(threshold * 100)}%)`);
  }
}

rejectLargeDrop("Published Wiki entities", previousEntities.publishedCount, currentEntities.publishedCount);
for (const [kind, previousCount] of Object.entries(previousEntities.counts)) {
  rejectLargeDrop(`Published ${kind}`, previousCount, currentEntities.counts[kind] ?? 0, 0.4);
}
rejectLargeDrop("Story records", previousStory.pages.length, currentStory.pages.length);

const currentKeys = new Set(currentEntities.entities.filter((entity) => entity.status === "wiki-backed").map((entity) => `${entity.kind}:${entity.title}`));
for (const key of ["resources:Copper", "vehicles:Tadpole", "biomes:Shallows"]) {
  if (!currentKeys.has(key)) failures.push(`Critical Wiki entity disappeared: ${key}`);
}

if (failures.length) {
  process.stderr.write(`Suspicious Wiki import; refusing to publish generated deletions:\n${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Wiki import anomaly checks passed: ${currentEntities.publishedCount} entities, ${currentStory.pages.length} story records.\n`);
}
