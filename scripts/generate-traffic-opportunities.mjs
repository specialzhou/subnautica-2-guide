import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTrafficOpportunities, renderTrafficOpportunityIssue } from "./lib/traffic-opportunities.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.length ? value.join("=") : true];
}));
const output = path.resolve(root, String(args.get("output") || "data/traffic-opportunities.md"));
const generatedAt = String(args.get("generated-at") || new Date().toISOString());
const limit = Number(args.get("limit") || 3);
const [candidateData, questionData] = await Promise.all([
  readFile(path.join(root, "data/player-question-candidates.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data/player-questions.json"), "utf8").then(JSON.parse),
]);
const report = buildTrafficOpportunities({ candidates: candidateData.candidates ?? [], questions: questionData.questions ?? [], generatedAt, limit });
await writeFile(output, renderTrafficOpportunityIssue(report));
process.stdout.write(`Generated ${report.count} traffic opportunities at ${output}.\n`);
