import assert from "node:assert/strict";
import { buildPublishedQuestion, createReviewTemplate, validateReview } from "./lib/player-question-promotion.mjs";

const candidate = {
  redditId: "test123",
  title: "Where is the test item?",
  url: "https://www.reddit.com/r/Subnautica_2/comments/test123/test/",
  attention: { comments: 4 },
  review: { state: "needs-review" },
};
const review = createReviewTemplate(candidate, "2026-07-18");
assert.equal(review.redditId, candidate.redditId);
assert.ok(validateReview({ review, candidate, publishedQuestions: [] }).length > 5);
Object.assign(review.review, { reviewedBy: "reviewer" });
Object.assign(review.question, {
  id: "test-item-location",
  category: "locations",
  buildContext: "EA 1.1",
  resolution: "solved",
  verification: "wiki-revision",
  question: { en: "Where is the test item?", "zh-cn": "测试物品在哪里？", ru: "Где тестовый предмет?" },
  answer: { en: "It is in the test biome.", "zh-cn": "它位于测试生态区。", ru: "Он находится в тестовом биоме." },
  evidenceNote: { en: "Verified revision.", "zh-cn": "已核对修订版本。", ru: "Проверено по версии." },
  searchTerms: { en: "test item location", "zh-cn": "测试 物品 地点", ru: "тест предмет место" },
  relatedPages: ["locations.html"],
  evidenceSources: [{ type: "wiki-revision", label: "Wiki revision", url: "https://example.com/revision" }],
  attention: { observedAt: "2026-07-18", upvotes: 10, comments: 4, approximate: true },
});
assert.deepEqual(validateReview({ review, candidate, publishedQuestions: [] }), []);
const published = buildPublishedQuestion(review, candidate);
assert.equal(published.source.url, candidate.url);
assert.equal(published.featuredRank, null);
const duplicateCandidate = { ...candidate, possibleDuplicateOf: { id: "existing", score: 0.8 } };
assert.match(validateReview({ review, candidate: duplicateCandidate, publishedQuestions: [] }).join("\n"), /Possible duplicate/);
review.review.duplicateDisposition = "distinct";
assert.deepEqual(validateReview({ review, candidate: duplicateCandidate, publishedQuestions: [] }), []);
process.stdout.write("Player question promotion tests passed.\n");
