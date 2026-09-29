import assert from "node:assert/strict";
import {
  buildTrafficOpportunities,
  buildTrafficOpportunityState,
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

process.stdout.write("Traffic opportunity tests passed.\n");
