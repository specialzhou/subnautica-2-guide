import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile as writeFixture } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  countCommentEntries,
  candidateDocument,
  computePriorityScore,
  computeTrafficValue,
  extractSubredditFromFeedUrl,
  findPublishedDuplicate,
  matchSiteIndex,
  matchSiteIndexDetailed,
  mergeCandidateFeed,
  normalizeQuestionKey,
  normalizeRedditUrl,
  parseAtomFeed,
  renderCandidateReport,
  scorePainEntry,
} from "./lib/player-question-collector.mjs";
import {
  applyEvidenceAutoReview,
  createPageEvidenceIndex,
  renderEvidenceReviewSummary,
  reviewCandidateEvidence,
} from "./lib/question-evidence-review.mjs";

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

// Evidence auto-review: the gate that was missing until 2026-09-29, when the
// Reddit funnel had produced zero reply drafts for seven straight weeks.
assert.equal(typeof matchSiteIndexDetailed, "function");
const detailedKraken = matchSiteIndexDetailed("Where to find the kraken leviathan?", sampleIndex);
assert.ok(detailedKraken.suggestedPages[0].hits >= 1, "detailed matcher must expose raw token hits");
assert.ok("titleHits" in detailedKraken.suggestedPages[0], "detailed matcher must expose title-token hits");
// matchSiteIndex keeps its original public shape so persisted candidates do not change.
assert.deepEqual(
  Object.keys(matchSiteIndex("Where to find the kraken leviathan?", sampleIndex).suggestedPages[0]),
  ["href", "title", "score"],
  "matchSiteIndex must not leak the new hit counters into the persisted shape",
);

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "evidence-review-"));
const writePage = async (href, { sources = true } = {}) => {
  await mkdir(path.join(fixtureRoot, path.dirname(href)), { recursive: true });
  const body = sources ? '<a href="https://wiki.subnautica.com/sn2/index.php?oldid=1">rev</a>' : "<p>no citations</p>";
  await writeFixture(path.join(fixtureRoot, href), `<!doctype html><html><body>${body}</body></html>`);
  for (const locale of ["zh-cn", "ru"]) await writePageForLocale(locale, href, body);
};
const writePageForLocale = async (locale, href, body) => {
  const target = path.join(fixtureRoot, locale, href);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFixture(target, `<!doctype html><html><body>${body}</body></html>`);
};
await writePage("guide/vehicles/tadpole-dock.html");
await writePage("starter-planner.html");

const evidenceIndex = {
  entries: [
    { title: "Tadpole Dock", href: "guide/vehicles/tadpole-dock.html", terms: "tadpole dock vehicle chassis" },
    { title: "Start here", href: "starter-planner.html", terms: "starter planner scanner" },
  ],
};
const pageEvidence = () => createPageEvidenceIndex({ root: fixtureRoot });
const systemCandidate = (title) => ({
  redditId: `r_${normalizeQuestionKey(title).replace(/\W+/g, "_")}`,
  title,
  url: "https://www.reddit.com/r/Subnautica_2/comments/x/y/",
  painScore: 12,
  review: { state: "system-review", answerStatus: "needs-evidence", notes: "等待系统核对 Reddit 上下文、官方资料和证据边界。" },
});

// A real topical match with two shared title tokens passes.
const strongDoc = { candidates: [systemCandidate("Why won't my tadpole dock?")] };
const strongMatch = matchSiteIndexDetailed("Why won't my tadpole dock?", evidenceIndex);
strongDoc.candidates[0].suggestedPages = strongMatch.suggestedPages.map(({ hits, titleHits, ...page }) => page);
strongDoc.candidates[0].answerability = strongMatch.answerability;
const strongVerdict = reviewCandidateEvidence({ candidate: strongDoc.candidates[0], searchIndex: evidenceIndex, pageEvidence: pageEvidence() });
assert.equal(strongVerdict.state, "ready-to-reply", "a two-token title match on a cited trilingual page should pass");
assert.equal(strongVerdict.page, "guide/vehicles/tadpole-dock.html");

// One generic word colliding with a page title is not evidence, even at score 1.0.
const flukeDoc = { candidates: [systemCandidate("Help me start")] };
const flukeMatch = matchSiteIndexDetailed("Help me start", evidenceIndex);
flukeDoc.candidates[0].suggestedPages = flukeMatch.suggestedPages.map(({ hits, titleHits, ...page }) => page);
flukeDoc.candidates[0].answerability = flukeMatch.answerability;
const flukeVerdict = reviewCandidateEvidence({ candidate: flukeDoc.candidates[0], searchIndex: evidenceIndex, pageEvidence: pageEvidence() });
assert.equal(flukeVerdict.state, "system-review", "a single-token collision must not be promoted even when the ratio is 1.0");
assert.ok(flukeVerdict.reasons.includes("too-few-shared-tokens"), `expected too-few-shared-tokens, got ${flukeVerdict.reasons.join(",")}`);

// Promotion happens, is recorded, and is idempotent.
const promotedCounts = applyEvidenceAutoReview({ document: strongDoc, searchIndex: evidenceIndex, pageEvidence: pageEvidence(), now: "2026-09-29T00:00:00Z" });
assert.equal(promotedCounts.promoted, 1);
assert.equal(strongDoc.candidates[0].review.state, "ready-to-reply");
assert.equal(strongDoc.candidates[0].review.autoReviewed, true);
assert.equal(strongDoc.candidates[0].review.evidencePage, "guide/vehicles/tadpole-dock.html");
assert.match(strongDoc.candidates[0].review.notes, /系统证据审核通过/);
const stateSnapshot = JSON.stringify(strongDoc.candidates.map((entry) => [entry.redditId, entry.review.state]));
applyEvidenceAutoReview({ document: strongDoc, searchIndex: evidenceIndex, pageEvidence: pageEvidence(), now: "2026-09-30T00:00:00Z" });
assert.equal(JSON.stringify(strongDoc.candidates.map((entry) => [entry.redditId, entry.review.state])), stateSnapshot, "a second pass must not churn state");

// Missing locale coverage holds the candidate instead of shipping a broken draft.
const missingLocaleDoc = { candidates: [{ ...strongDoc.candidates[0], review: { state: "system-review" } }] };
await rm(path.join(fixtureRoot, "ru", "guide/vehicles/tadpole-dock.html"));
const missingLocaleVerdict = reviewCandidateEvidence({ candidate: missingLocaleDoc.candidates[0], searchIndex: evidenceIndex, pageEvidence: pageEvidence() });
assert.equal(missingLocaleVerdict.state, "system-review");
assert.ok(missingLocaleVerdict.reasons.includes("locale-coverage-incomplete"));

// A page that cites nothing cannot back a reply, so it holds too.
const uncitedDoc = { candidates: [{ ...missingLocaleDoc.candidates[0], title: "Why won't my tadpole dock?" }] };
await writeFixture(path.join(fixtureRoot, "zh-cn", "guide/vehicles/tadpole-dock.html"), "<!doctype html><p>no citations</p>");
const uncitedVerdict = reviewCandidateEvidence({
  candidate: uncitedDoc.candidates[0],
  searchIndex: evidenceIndex,
  pageEvidence: createPageEvidenceIndex({ root: fixtureRoot, policy: { locales: ["zh-cn"] } }),
  policy: { locales: ["zh-cn"] },
});
assert.ok(uncitedVerdict.reasons.includes("page-cites-no-external-source"), "uncited pages must be held");

// Human triage is sacred: only states this reviewer granted may be revoked.
const humanDoc = {
  candidates: [
    { ...systemCandidate("Tadpole dock"), review: { state: "dismissed", notes: "站长判定为重复" } },
    { ...systemCandidate("Tadpole dock"), redditId: "human-ready", review: { state: "ready-to-reply", notes: "人工已核" } },
  ],
};
const humanCounts = applyEvidenceAutoReview({ document: humanDoc, searchIndex: evidenceIndex, pageEvidence: pageEvidence(), now: "2026-09-29T00:00:00Z" });
assert.equal(humanDoc.candidates[0].review.state, "dismissed", "dismissed must never be reopened");
assert.equal(humanDoc.candidates[1].review.state, "ready-to-reply", "human-approved must never be revoked");
assert.equal(humanCounts.revoked, 0);
assert.equal(humanCounts.skippedHuman, 2);

// Something the system promoted can be un-promoted when the evidence disappears.
const driftDoc = { candidates: [{ ...strongDoc.candidates[0], suggestedPages: [{ href: "guide/vehicles/gone.html", title: "Gone", score: 1 }] }] };
const driftCounts = applyEvidenceAutoReview({ document: driftDoc, searchIndex: evidenceIndex, pageEvidence: pageEvidence(), now: "2026-10-01T00:00:00Z" });
assert.equal(driftCounts.revoked, 1, "a self-promoted candidate whose page vanished should fall back to system-review");
assert.equal(driftDoc.candidates[0].review.state, "system-review");

const summaryText = renderEvidenceReviewSummary({ document: strongDoc, counts: promotedCounts });
assert.match(summaryText, /候选证据审核/);
assert.match(summaryText, /放行门槛/);
await rm(fixtureRoot, { recursive: true, force: true });

process.stdout.write("Player question collector tests passed.\n");
