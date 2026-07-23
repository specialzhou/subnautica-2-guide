import assert from "node:assert/strict";
import {
  buildTrafficOpportunities,
  buildTrafficOpportunityState,
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
assert.match(renderedIssue, /可直接使用的英文回复/);

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
process.stdout.write("Traffic opportunity tests passed.\n");
