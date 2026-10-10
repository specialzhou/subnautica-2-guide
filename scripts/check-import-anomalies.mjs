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
  // 小基数分类（如 vehicles 只有 3 条）：百分比阈值对正常的归类调整过于敏感
  // （2026-10-06 Wiki 摘除两个底盘的分类即触发 3→1 误拦）。基数 < 5 时只拦
  // "整个分类消失"；真正的页面删除由下面的关键实体名单兜底。
  if (previous > 0 && previous < 5) {
    if (current === 0) failures.push(`${label} vanished entirely (was ${previous})`);
    return;
  }
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
// 关键实体名单：任一消失即拦。底盘页自 2026-10-06 起不再依赖 Wiki 分类收录
// （import-entities.mjs 改用 titles 显式指定），页面被删除/改名时由这里兜底。
for (const key of ["resources:Copper", "vehicles:Tadpole", "vehicles:Tadpole Haul Chassis", "vehicles:Tadpole Scout Ray Chassis", "biomes:Shallows"]) {
  if (!currentKeys.has(key)) failures.push(`Critical Wiki entity disappeared: ${key}`);
}

if (failures.length) {
  process.stderr.write(`Suspicious Wiki import; refusing to publish generated deletions:\n${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Wiki import anomaly checks passed: ${currentEntities.publishedCount} entities, ${currentStory.pages.length} story records.\n`);
}
