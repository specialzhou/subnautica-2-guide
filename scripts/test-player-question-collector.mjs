import assert from "node:assert/strict";
import {
  countCommentEntries,
  candidateDocument,
  computePriorityScore,
  computeTrafficValue,
  extractSubredditFromFeedUrl,
  findPublishedDuplicate,
  matchSiteIndex,
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

// P0: compound priority scoring + site-index matching
assert.equal(computeTrafficValue("How do I craft the habitat builder?"), 1);
assert.equal(computeTrafficValue("Nice fan art share"), 0);
assert.equal(computePriorityScore(10, 0, 0), 10);
assert.equal(computePriorityScore(10, 0.5, 1), 23); // round(10 * 1.5 * 1.5) = round(22.5) = 23
const sampleIndex = {
  entries: [
    { title: "Kraken", href: "creatures/kraken.html", terms: "leviathan deep", localizedTitles: { en: "Kraken", "zh-cn": "海妖", ru: "Кракен" }, localizedTerms: { en: "leviathan", "zh-cn": "深海", ru: "левиафан" } },
    { title: "Chassis", href: "guides/chassis.html", terms: "build recipe", localizedTitles: { en: "Chassis", "zh-cn": "底盘", ru: "" }, localizedTerms: { en: "build", "zh-cn": "配方", ru: "" } },
  ],
};
const krakenMatch = matchSiteIndex("Where to find the kraken?", sampleIndex);
assert.ok(krakenMatch.suggestedPages.some((page) => page.href === "creatures/kraken.html"));
assert.ok(krakenMatch.answerability > 0);
const emptyMatch = matchSiteIndex("qwerty", { entries: sampleIndex.entries });
assert.equal(emptyMatch.suggestedPages.length, 0);
assert.equal(emptyMatch.answerability, 0);

const mergedWithIndex = mergeCandidateFeed({ feedEntries: entries, existing: {}, publishedUrls: new Set(), now: "2026-07-16T12:00:00Z", threshold: 5, searchIndex: sampleIndex });
assert.equal(mergedWithIndex.candidates[0].trafficValue, 1); // "Can't build the chassis" -> build + what
assert.ok(mergedWithIndex.candidates[0].priorityScore > 0);
assert.ok(Array.isArray(mergedWithIndex.candidates[0].suggestedPages));
assert.ok(mergedWithIndex.candidates[0].answerability > 0);
// Without searchIndex the fields still populate with safe defaults (no crash)
const mergedNoIndex = mergeCandidateFeed({ feedEntries: entries, existing: {}, publishedUrls: new Set(), now: "2026-07-16T12:00:00Z", threshold: 5 });
assert.equal(mergedNoIndex.candidates[0].answerability, 0);
assert.equal(mergedNoIndex.candidates[0].trafficValue, 1);
const candidateReport = renderCandidateReport(candidateDocument({ previous: {}, merged, now: "2026-07-16T12:00:00Z", feedUrl: "https://example.com/feed" }));
assert.match(candidateReport, /玩家问题候选审核/);
assert.match(candidateReport, /不会自动发布到攻略站/);
assert.match(candidateReport, /站长不需要判断游戏事实/);

// P2: multi-subreddit listening
assert.equal(extractSubredditFromFeedUrl("https://www.reddit.com/r/Subnautica/new/.rss?limit=100"), "r/Subnautica");
assert.equal(extractSubredditFromFeedUrl("https://www.reddit.com/r/Subnautica_2/comments/x/y/"), "r/Subnautica_2");
assert.equal(extractSubredditFromFeedUrl("https://example.com/feed"), "");
const subbedEntry = { ...entries[0], sourceSubreddit: "r/Subnautica_2" };
const subbedMerge = mergeCandidateFeed({ feedEntries: [subbedEntry], existing: {}, publishedUrls: new Set(), now: "2026-07-16T12:00:00Z", threshold: 5 });
assert.equal(subbedMerge.candidates[0].sourceSubreddit, "r/Subnautica_2");
const doc = candidateDocument({ previous: {}, merged, now: "2026-07-16T12:00:00Z", feedUrl: "a, b", subreddits: ["r/Subnautica_2", "r/Subnautica"] });
assert.deepEqual(doc.source.subreddits, ["r/Subnautica_2", "r/Subnautica"]);
assert.equal(doc.source.subreddit, "r/Subnautica_2");

process.stdout.write("Player question collector tests passed.\n");
