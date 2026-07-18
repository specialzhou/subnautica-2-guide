import assert from "node:assert/strict";
import { buildTrafficOpportunities, renderTrafficOpportunityIssue } from "./lib/traffic-opportunities.mjs";

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
  review: { state: "needs-review" },
  possibleDuplicateOf: { id: question.id, score },
});

const report = buildTrafficOpportunities({
  candidates: [candidate("high", 0.8, 9), candidate("duplicate", 0.7, 4), candidate("weak", 0.4, 20)],
  questions: [question],
  generatedAt: "2026-07-18T00:00:00Z",
});
assert.equal(report.count, 1, "one opportunity per guide page should be selected");
assert.equal(report.opportunities[0].redditId, "high");
assert.match(report.opportunities[0].guideUrl, /utm_content=high/);
assert.match(report.opportunities[0].replyDraft, /I maintain a small evidence-linked guide/);
assert.match(renderTrafficOpportunityIssue(report), /It never posts, votes, or messages automatically/);

const sourceCandidate = candidate("source", 0.9, 20);
assert.equal(buildTrafficOpportunities({ candidates: [sourceCandidate], questions: [question], generatedAt: "now" }).count, 0, "source thread must not be promoted back to itself");
assert.equal(buildTrafficOpportunities({ candidates: [candidate("open", 0.9, 20)], questions: [{ ...question, resolution: "open" }], generatedAt: "now" }).count, 0, "unresolved guides must not generate replies");
process.stdout.write("Traffic opportunity tests passed.\n");
