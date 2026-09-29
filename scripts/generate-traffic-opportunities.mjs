import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTrafficOpportunities,
  buildTrafficOpportunityState,
  evaluatePipelineHealth,
  renderPipelineAlertIssue,
  renderPipelineHealthSummary,
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
const alertAfterDryRuns = Math.max(1, Number(args.get("alert-after-dry-runs") || 3));
const alertOutput = args.get("alert-output") ? path.resolve(root, String(args.get("alert-output"))) : null;
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
const nextState = buildTrafficOpportunityState({ state, report });
const health = evaluatePipelineHealth({ state: nextState, alertAfterDryRuns });
const queueDepth = {
  total: candidateData.candidates?.length ?? 0,
  readyToReply: candidateData.counts?.readyToReply ?? candidateData.candidates?.filter((entry) => entry.review?.state === "ready-to-reply").length ?? 0,
  systemReview: candidateData.counts?.systemReview ?? 0,
};

await writeFile(output, renderTrafficOpportunityIssue(report));
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `count=${report.count}\ndry-run-streak=${health.dryRunStreak}\nalert=${health.alert ? "true" : "false"}\n`);
}
if (stateOutput) {
  await writeFile(stateOutput, `${JSON.stringify(nextState, null, 2)}\n`);
}
if (alertOutput && health.alert) {
  await writeFile(alertOutput, renderPipelineAlertIssue({ health, report, queueDepth }));
}
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${renderPipelineHealthSummary(health)}\n- 候选队列：${queueDepth.total} 条，其中 ready-to-reply ${queueDepth.readyToReply} / system-review ${queueDepth.systemReview}\n`);
}

if (health.alert) {
  process.stderr.write(`::error title=Reddit 流量管道空转::${health.message} 候选队列 ${queueDepth.total} 条，ready-to-reply 仅 ${queueDepth.readyToReply} 条。\n`);
} else if (!report.count) {
  process.stderr.write(`::warning title=Reddit 流量机会今日 0 产出::${health.message}\n`);
}
process.stdout.write(`已生成 ${report.count} 个 Reddit 流量机会：${output}（连续 0 产出 ${health.dryRunStreak} 次，告警 ${health.alert ? "已触发" : "未触发"}）\n`);
