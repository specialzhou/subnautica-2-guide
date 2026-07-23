import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTrafficOpportunities,
  buildTrafficOpportunityState,
  renderTrafficOpportunityIssue,
} from "./lib/traffic-opportunities.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.length ? value.join("=") : true];
}));
const output = path.resolve(root, String(args.get("output") || "data/traffic-opportunities.md"));
const stateInput = args.get("state") ? path.resolve(root, String(args.get("state"))) : null;
const stateOutput = args.get("state-output") ? path.resolve(root, String(args.get("state-output"))) : null;
const generatedAt = String(args.get("generated-at") || new Date().toISOString());
const limit = Number(args.get("limit") || 3);
const [candidateData, questionData] = await Promise.all([
  readFile(path.join(root, "data/player-question-candidates.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data/player-questions.json"), "utf8").then(JSON.parse),
]);
const state = stateInput
  ? await readFile(stateInput, "utf8").then(JSON.parse).catch((error) => {
    if (error.code === "ENOENT") return {};
    throw error;
  })
  : {};
const report = buildTrafficOpportunities({
  candidates: candidateData.candidates ?? [],
  questions: questionData.questions ?? [],
  generatedAt,
  limit,
  state,
});
await writeFile(output, renderTrafficOpportunityIssue(report));
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `count=${report.count}\n`);
}
if (stateOutput) {
  await writeFile(stateOutput, `${JSON.stringify(buildTrafficOpportunityState({ state, report }), null, 2)}\n`);
}
process.stdout.write(`已生成 ${report.count} 个 Reddit 流量机会：${output}\n`);
