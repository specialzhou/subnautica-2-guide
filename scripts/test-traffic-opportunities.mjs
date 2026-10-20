import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTrafficOpportunities,
  buildTrafficOpportunityState,
  evaluateCandidateFreshness,
  evaluatePipelineHealth,
  renderPipelineAlertIssue,
  renderPipelineHealthSummary,
  renderTrafficOpportunityIssue,
} from "./lib/traffic-opportunities.mjs";

const question = {
  id: "angel-comb-main-cankers-stuck",
  resolution: "solved",
  buildContext: "EA 1.1 / Hotfix 4",
  verification: "official-and-community",
  answer: { en: "Install Hotfix 4 and restart the client." },
  source: { url: "https://www.reddit.com/r/Subnautica_2/comments/source/source/" },
};
const candidate = (redditId, score, comments) => ({
  redditId,
  title: `Angel Comb bug ${redditId}`,
  url: `https://www.reddit.com/r/Subnautica_2/comments/${redditId}/question/`,
  publishedAt: "2026-07-18T00:00:00Z",
  painScore: 8,
  attention: { comments },
  review: { state: "ready-to-reply" },
  possibleDuplicateOf: { id: question.id, score },
});

const report = buildTrafficOpportunities({
  candidates: [candidate("high", 0.8, 9), candidate("duplicate", 0.7, 4), candidate("weak", 0.4, 20)],
  questions: [question],
  generatedAt: "2026-07-18T00:00:00Z",
});
assert.equal(report.count, 1, "one opportunity per guide page should be selected");
assert.equal(report.opportunities[0].redditId, "high");
assert.equal(buildTrafficOpportunities({
  candidates: [{ ...candidate("unreviewed", 0.9, 20), review: { state: "system-review" } }],
  questions: [question],
  generatedAt: "now",
}).count, 0, "system-review candidates must not generate reply drafts");
assert.match(report.opportunities[0].guideUrl, /utm_content=high/);
assert.equal(
  new URL(report.opportunities[0].guideUrl).pathname,
  "/subnautica-2-guide/questions/angel-comb-main-cankers-stuck.html",
  "English guide links should use the root canonical URL",
);
assert.match(report.opportunities[0].replyDraft, /I maintain a small evidence-linked guide/);
const renderedIssue = renderTrafficOpportunityIssue(report);
assert.match(renderedIssue, /系统不会自动|不会自动操作 Reddit/);
assert.match(renderedIssue, /已完成的系统审核/);
assert.match(renderedIssue, /可直接使用的回复/);
assert.match(renderedIssue, /中文/);
assert.match(renderedIssue, /Русский/);

const firstRun = buildTrafficOpportunities({
  candidates: [candidate("repeat", 0.9, 20)],
  questions: [question],
  generatedAt: "2026-07-18T00:00:00Z",
});
const state = buildTrafficOpportunityState({ state: {}, report: firstRun });
const secondRun = buildTrafficOpportunities({
  candidates: [candidate("repeat", 0.9, 20)],
  questions: [question],
  generatedAt: "2026-07-19T00:00:00Z",
  state,
});
assert.equal(secondRun.count, 0, "an opportunity surfaced by an earlier run must not be generated again");

const sourceCandidate = candidate("source", 0.9, 20);
assert.equal(buildTrafficOpportunities({ candidates: [sourceCandidate], questions: [question], generatedAt: "now" }).count, 0, "source thread must not be promoted back to itself");
assert.equal(buildTrafficOpportunities({ candidates: [candidate("open", 0.9, 20)], questions: [{ ...question, resolution: "open" }], generatedAt: "now" }).count, 0, "unresolved guides must not generate replies");

// P1 B.2 + B.3: ready-to-reply NEW question with a matched page generates a pointer draft in 3 locales
const newQuestionCandidate = {
  redditId: "newbuild",
  title: "How do I build the habitat base?",
  url: "https://www.reddit.com/r/Subnautica_2/comments/newbuild/build/",
  publishedAt: "2026-07-19T00:00:00Z",
  painScore: 12,
  attention: { comments: 6 },
  review: { state: "ready-to-reply" },
  relatedPages: ["base-building.html"],
  suggestedPages: [{ href: "base-building.html", title: "Base building", score: 0.8 }],
};
const newReport = buildTrafficOpportunities({
  candidates: [newQuestionCandidate],
  questions: [question],
  generatedAt: "2026-07-19T00:00:00Z",
});
assert.equal(newReport.count, 1, "ready-to-reply new question with a matched page should generate a pointer draft");
assert.equal(
  new URL(newReport.opportunities[0].guideUrl).pathname,
  "/subnautica-2-guide/base-building.html",
  "new-question deep link should point to the specific related page, not /questions/",
);
assert.match(newReport.opportunities[0].replyDraft, /Here is where I track this/);
assert.match(newReport.opportunities[0].replyDraftZh, /带证据链接的攻略里追踪/);
assert.match(newReport.opportunities[0].replyDraftRu, /отслеживаю это/);
assert.match(newReport.opportunities[0].guideUrlZh, /\/zh-cn\/base-building\.html/);
assert.match(newReport.opportunities[0].guideUrlRu, /\/ru\/base-building\.html/);
// Dry-run streak tracking: the seven-week outage was invisible because a zero
// output run looked identical to a healthy one in CI.
const emptyReport = (generatedAt) => ({ generatedAt, count: 0, opportunities: [] });
const fullReport = (generatedAt) => ({ generatedAt, count: 1, opportunities: [{ opportunityKey: "abc:page:x.html" }] });

const dayOne = buildTrafficOpportunityState({ state: { schemaVersion: "1.0.0", seenOpportunityKeys: [] }, report: emptyReport("2026-09-25T07:17:00Z") });
assert.equal(dayOne.dryRunStreak, 1, "legacy state without a streak field should start counting at 1");
assert.equal(dayOne.lastOpportunityAt, null, "an unknown last-outage date should stay null");
const dayOneRerun = buildTrafficOpportunityState({ state: dayOne, report: emptyReport("2026-09-25T09:00:00Z") });
assert.equal(dayOneRerun.dryRunStreak, 1, "a same-day re-run must not inflate the streak");
const dayTwo = buildTrafficOpportunityState({ state: dayOneRerun, report: emptyReport("2026-09-26T07:17:00Z") });
const dayThree = buildTrafficOpportunityState({ state: dayTwo, report: emptyReport("2026-09-27T07:17:00Z") });
assert.equal(dayThree.dryRunStreak, 3);
assert.equal(evaluatePipelineHealth({ state: dayTwo }).alert, false, "two dry runs is still normal day-to-day variance");
const health = evaluatePipelineHealth({ state: dayThree });
assert.equal(health.alert, true, "three consecutive dry runs must escalate");
assert.match(health.message, /连续 3 次运行产出 0 条/);
const recovered = buildTrafficOpportunityState({ state: dayThree, report: fullReport("2026-09-28T07:17:00Z") });
assert.equal(recovered.dryRunStreak, 0, "producing an opportunity resets the streak");
assert.equal(recovered.lastOpportunityAt, "2026-09-28T07:17:00Z");
assert.equal(evaluatePipelineHealth({ state: recovered }).alert, false);
const alertBody = renderPipelineAlertIssue({ health, report: emptyReport("2026-09-27T07:17:00Z"), queueDepth: { total: 80, readyToReply: 0, systemReview: 75 } });
assert.match(alertBody, /管道空转/);
assert.match(alertBody, /ready-to-reply/);
assert.match(alertBody, /排查顺序/);
assert.match(renderPipelineHealthSummary(health), /🔴 空转/);

// Anti-recurrence for the 2026-08-31..2026-10-04 outage: CI read candidate data from a
// frozen branch, so every ready-to-reply entry was already deduped and the job could
// only ever produce 0. A stale source must fail loudly instead of looking like a quiet day.
assert.equal(evaluateCandidateFreshness({ collectedAt: "2026-10-04T00:00:00Z", generatedAt: "2026-10-04T07:17:00Z" }).ok, true, "same-day candidates are fresh");
assert.equal(evaluateCandidateFreshness({ collectedAt: "2026-10-01T00:00:00Z", generatedAt: "2026-10-04T00:00:00Z" }).ok, true, "three days is still inside the tolerance");
const stale = evaluateCandidateFreshness({ collectedAt: "2026-08-30T10:29:08Z", generatedAt: "2026-10-04T07:17:00Z" });
assert.equal(stale.ok, false, "a five-week-old snapshot must be rejected");
assert.equal(stale.reason, "stale");
assert.ok(stale.ageDays > 34, `expected ~35 days of age, got ${stale.ageDays}`);
assert.match(stale.message, /候选数据源已过期/);
assert.equal(evaluateCandidateFreshness({ collectedAt: undefined, generatedAt: "2026-10-04T07:17:00Z" }).ok, false, "a candidate file without collectedAt cannot be trusted");

// 2026-10-19..: Reddit began rejecting every RSS request. The collector correctly
// kept the queue and exited 0, but left no trace, so this job blamed itself with
// "候选数据源已过期，说明读到的不是最新文件" while the real cause was an upstream
// outage. A *recorded* degraded attempt must be attributed to the feed, not to a
// stale read -- and must still not claim the data is fresh.
const degraded = evaluateCandidateFreshness({
  collectedAt: "2026-10-18T09:38:08.229Z",
  generatedAt: "2026-10-22T07:17:00Z",
  collection: { attemptedAt: "2026-10-21T09:50:00.000Z", degraded: true, reason: "all-feeds-rejected", entriesCollected: 0, lastError: "Reddit RSS request failed (429)" },
});
assert.equal(degraded.ok, true, "a recorded upstream outage must not be reported as a stale read");
assert.equal(degraded.reason, "upstream-degraded");
assert.equal(degraded.degraded, true);
assert.match(degraded.message, /上游 Reddit 采集已降级/);
assert.match(degraded.message, /429/);
assert.doesNotMatch(degraded.message, /这说明本步骤读到的不是采集工作流最新写入的文件/, "must not blame the read path when the feed is the cause");
// The same old file WITHOUT a degraded record is still a defect: this is the case
// the gate exists for (frozen branch / broken collector), so it must keep failing.
const staleNoRecord = evaluateCandidateFreshness({ collectedAt: "2026-10-18T09:38:08.229Z", generatedAt: "2026-10-22T07:17:00Z" });
assert.equal(staleNoRecord.ok, false, "staleness without a degraded record must still hard-fail");
assert.equal(staleNoRecord.reason, "stale");
// A degraded flag is only trusted while the attempt itself is recent; an ancient
// record must not permanently whitelist a frozen queue.
const staleOldRecord = evaluateCandidateFreshness({
  collectedAt: "2026-08-30T10:29:08Z",
  generatedAt: "2026-10-04T07:17:00Z",
  collection: { attemptedAt: "2026-09-01T00:00:00Z", degraded: true, reason: "all-feeds-rejected" },
});
assert.equal(staleOldRecord.ok, false, "an expired degraded record must not mask a frozen queue");

// Severity split: the streak and its threshold are unchanged, but only a
// repo-owned defect fails the job. Both causes still alert and still file an issue.
const starved = evaluatePipelineHealth({ state: dayThree, upstreamDegraded: true });
assert.equal(starved.alert, true, "an upstream-starved dry streak must still raise the alarm");
assert.equal(starved.cause, "upstream-starved");
assert.equal(starved.fail, false, "an upstream outage cannot be fixed by failing this repo's build");
assert.match(starved.message, /上游 Reddit 采集/);
assert.doesNotMatch(starved.message, /这是管道空转，不是今天恰好没有问题/, "must not claim a funnel defect when the feed is the cause");
const funnel = evaluatePipelineHealth({ state: dayThree, upstreamDegraded: false });
assert.equal(funnel.alert, true);
assert.equal(funnel.cause, "funnel-defect");
assert.equal(funnel.fail, true, "fresh candidates that still never convert must fail the build");
assert.match(funnel.message, /这是管道空转/);
// Default (unspecified) attribution stays strict: never silently downgrade.
assert.equal(evaluatePipelineHealth({ state: dayThree }).fail, true, "unattributed dry streaks must default to a repo defect");
// Below threshold nothing fails regardless of cause.
assert.equal(evaluatePipelineHealth({ state: dayTwo, upstreamDegraded: true }).fail, false);
assert.equal(evaluatePipelineHealth({ state: dayTwo, upstreamDegraded: false }).fail, false);
// A degraded feed that still produced opportunities is not a "starved" alarm.
const recoveredWhileDegraded = buildTrafficOpportunityState({ state: dayThree, report: fullReport("2026-09-28T07:17:00Z") });
assert.equal(evaluatePipelineHealth({ state: recoveredWhileDegraded, upstreamDegraded: true }).alert, false);
const degradedAlertBody = renderPipelineAlertIssue({
  health: starved,
  report: emptyReport("2026-10-22T07:17:00Z"),
  queueDepth: { total: 80, readyToReply: 16, systemReview: 44 },
  freshness: degraded,
});
assert.match(degradedAlertBody, /上游采集已降级/, "the filed issue must state the real cause");
assert.match(degradedAlertBody, /请不要靠调阈值或清空 seenOpportunityKeys/, "the issue must warn against fake recovery");
assert.doesNotMatch(degradedAlertBody, /这不是"今天恰好没有问题"/, "must not accuse the funnel when the feed is the cause");
assert.match(degradedAlertBody, /只发警告、不判红/);
// The funnel-defect issue keeps the original, accusatory wording.
assert.match(alertBody, /这不是"今天恰好没有问题"/, "a genuine funnel defect must keep the hard diagnosis");
assert.doesNotMatch(alertBody, /上游采集已降级/);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = mkdtempSync(path.join(tmpdir(), "traffic-stale-"));
execFileSync("cp", ["-R", path.join(repoRoot, "scripts"), path.join(sandbox, "scripts")]);
const sandboxData = path.join(sandbox, "data");
execFileSync("mkdir", ["-p", sandboxData]);
writeFileSync(path.join(sandboxData, "player-question-candidates.json"), `${JSON.stringify({
  collectedAt: "2026-08-30T10:29:08.231Z",
  counts: { total: 1, readyToReply: 1, systemReview: 0 },
  candidates: [{ redditId: "stale", title: "Angel Comb bug", review: { state: "ready-to-reply" } }],
})}\n`);
writeFileSync(path.join(sandboxData, "player-questions.json"), `${JSON.stringify({ questions: [] })}\n`);
const staleRun = spawnSync(process.execPath, [
  path.join(sandbox, "scripts", "generate-traffic-opportunities.mjs"),
  "--generated-at=2026-10-04T07:17:00Z",
], { cwd: sandbox, encoding: "utf8" });
assert.equal(staleRun.status, 1, "the generator must exit non-zero when the candidate source is stale");
assert.match(staleRun.stderr, /::error title=Reddit 流量候选数据源过期::/);
assert.match(staleRun.stderr, /2026-08-30T10:29:08.231Z/);

// The same stale file, but with a fresh degraded record, is an upstream outage:
// the generator must not hard-fail, must say so, and must tell CI not to fail.
writeFileSync(path.join(sandboxData, "player-question-candidates.json"), `${JSON.stringify({
  collectedAt: "2026-10-18T09:38:08.229Z",
  collection: { attemptedAt: "2026-10-21T09:50:00.000Z", degraded: true, reason: "all-feeds-rejected", entriesCollected: 0, lastError: "Reddit RSS request failed (429)" },
  counts: { total: 1, readyToReply: 1, systemReview: 0 },
  candidates: [{ redditId: "starved", title: "Angel Comb bug", review: { state: "ready-to-reply" } }],
})}\n`);
// A prior dry streak is what makes the alert fire; seed the state file so this
// exercises the real gate instead of a first-run warning.
const seedState = (target) => writeFileSync(target, `${JSON.stringify({
  schemaVersion: "1.1.0", lastRunAt: "2026-10-21T07:17:00.000Z", lastOpportunityAt: "2026-10-15T12:41:41.919Z",
  dryRunStreak: 3, seenOpportunityKeys: [],
})}\n`);
const degradedStatePath = path.join(sandbox, "state-degraded.json");
seedState(degradedStatePath);
const degradedRun = spawnSync(process.execPath, [
  path.join(sandbox, "scripts", "generate-traffic-opportunities.mjs"),
  "--generated-at=2026-10-22T07:17:00Z",
  `--output=${path.join(sandbox, "out.md")}`,
  `--state=${degradedStatePath}`,
  `--state-output=${path.join(sandbox, "next-degraded.json")}`,
], { cwd: sandbox, encoding: "utf8" });
assert.equal(degradedRun.status, 0, "a recorded upstream outage must not fail the generator");
assert.match(degradedRun.stderr, /::warning title=Reddit 流量管道空转::/, "the outage must still be surfaced as a warning");
assert.doesNotMatch(degradedRun.stderr, /::error title=Reddit 流量候选数据源过期::/);
assert.match(degradedRun.stdout, /归因 upstream-starved/);
// The alarm still advances the streak -- a starved queue is still a real drought.
const nextDegraded = JSON.parse(readFileSync(path.join(sandbox, "next-degraded.json"), "utf8"));
assert.equal(nextDegraded.dryRunStreak, 4, "an upstream-starved run must still count toward the dry streak");

// And the defect case keeps failing loudly: a fresh-looking file with no degraded
// record still produces a red, attributable failure.
writeFileSync(path.join(sandboxData, "player-question-candidates.json"), `${JSON.stringify({
  collectedAt: "2026-10-18T09:38:08.229Z",
  counts: { total: 1, readyToReply: 1, systemReview: 0 },
  candidates: [{ redditId: "frozen", title: "Angel Comb bug", review: { state: "ready-to-reply" } }],
})}\n`);
const frozenStatePath = path.join(sandbox, "state-frozen.json");
seedState(frozenStatePath);
const frozenRun = spawnSync(process.execPath, [
  path.join(sandbox, "scripts", "generate-traffic-opportunities.mjs"),
  "--generated-at=2026-10-22T07:17:00Z",
  `--output=${path.join(sandbox, "out2.md")}`,
  `--state=${frozenStatePath}`,
  `--state-output=${path.join(sandbox, "next-frozen.json")}`,
  `--alert-output=${path.join(sandbox, "alert-frozen.md")}`,
], { cwd: sandbox, encoding: "utf8" });
assert.equal(frozenRun.status, 1, "an unexplained stale source must still fail the build");

process.stdout.write("Traffic opportunity tests passed.\n");
