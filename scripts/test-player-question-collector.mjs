import assert from "node:assert/strict";
import {
  countCommentEntries,
  candidateDocument,
  findPublishedDuplicate,
  mergeCandidateFeed,
  normalizeQuestionKey,
  normalizeRedditUrl,
  parseAtomFeed,
  renderCandidateReport,
  scorePainEntry,
} from "./lib/player-question-collector.mjs";

const fixture = `<?xml version="1.0"?><feed>
  <entry><id>t3_help123</id><link href="https://www.reddit.com/r/Subnautica_2/comments/help123/cant_build_the_chassis/"/><published>2026-07-16T10:00:00Z</published><title>Can't build the chassis — what am I missing?</title><content type="html">&lt;p&gt;I have the recipe but it does not work.&lt;/p&gt;</content></entry>
  <entry><id>t3_art123</id><link href="https://www.reddit.com/r/Subnautica_2/comments/art123/my_fan_art/"/><published>2026-07-16T09:00:00Z</published><title>My fan art</title><content type="html">&lt;p&gt;A drawing.&lt;/p&gt;</content></entry>
</feed>`;
const entries = parseAtomFeed(fixture);
assert.equal(entries.length, 2);
assert.equal(entries[0].redditId, "help123");
assert.match(entries[0].bodyText, /recipe/);
assert.ok(scorePainEntry(entries[0]).score >= 5);
assert.equal(scorePainEntry(entries[1]).score, 0);
assert.equal(normalizeRedditUrl("https://old.reddit.com/r/Subnautica_2/comments/help123/x/?utm_source=x"), "https://www.reddit.com/r/Subnautica_2/comments/help123/x/");
assert.equal(normalizeQuestionKey("[HELP] Can't build?!"), "can t build");
const merged = mergeCandidateFeed({ feedEntries: entries, existing: {}, publishedUrls: new Set(), now: "2026-07-16T12:00:00Z", threshold: 5 });
assert.equal(merged.added, 1);
assert.equal(merged.candidates.length, 1);
assert.equal(merged.candidates[0].review.state, "system-review");
const duplicate = { ...entries[0], redditId: "help456", url: "https://www.reddit.com/r/Subnautica_2/comments/help456/cant_build_the_chassis/" };
const grouped = mergeCandidateFeed({ feedEntries: [entries[0], duplicate], existing: {}, publishedUrls: new Set(), now: "2026-07-16T12:00:00Z", threshold: 5 });
assert.equal(grouped.candidates.length, 1);
assert.equal(grouped.candidates[0].relatedSources.length, 1);
assert.equal(mergeCandidateFeed({ feedEntries: entries, existing: { candidates: merged.candidates, seenRedditIds: merged.seenRedditIds }, publishedUrls: new Set(), now: "2026-07-16T13:00:00Z", threshold: 5 }).added, 0);
const afterPromotion = mergeCandidateFeed({
  feedEntries: entries,
  existing: { candidates: merged.candidates, seenRedditIds: merged.seenRedditIds },
  publishedUrls: new Set([normalizeRedditUrl(entries[0].url)]),
  now: "2026-07-16T14:00:00Z",
  threshold: 5,
});
assert.equal(afterPromotion.candidates.length, 0);
assert.equal(countCommentEntries("<entry><id>t3_post</id></entry><entry><id>t1_a</id></entry><entry><id>t1_b</id></entry>"), 2);
assert.equal(findPublishedDuplicate("Second Angel Comb progression bug", [{ id: "angel", question: { en: "Why won't the Angel Comb cankers open?" }, searchTerms: { en: "angel comb canker progression bug" } }]).id, "angel");
const candidateReport = renderCandidateReport(candidateDocument({ previous: {}, merged, now: "2026-07-16T12:00:00Z", feedUrl: "https://example.com/feed" }));
assert.match(candidateReport, /玩家问题候选审核/);
assert.match(candidateReport, /不会自动发布到攻略站/);
assert.match(candidateReport, /站长不需要判断游戏事实/);
process.stdout.write("Player question collector tests passed.\n");
