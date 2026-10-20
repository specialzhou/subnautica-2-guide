import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile as writeFixture } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildCollectionHealth,
  countCommentEntries,
  candidateDocument,
  computePriorityScore,
  computeTrafficValue,
  extractSubredditFromFeedUrl,
  findPublishedDuplicate,
  foldToken,
  matchSiteIndex,
  matchSiteIndexDetailed,
  mergeCandidateFeed,
  normalizeQuestionKey,
  normalizeRedditUrl,
  parseAtomFeed,
  parseRetryAfterMs,
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

// ---------------------------------------------------------------------------
// 2026-10-19 outage regressions.
// ---------------------------------------------------------------------------

// 1. 429 handling: Reddit rate-limits by wall clock and sends Retry-After. The
// collector used to ignore it, retry inside the same penalty window, and fail all
// attempts -- which is why the feed stayed empty for days.
assert.equal(parseRetryAfterMs("120"), 120000, "delta-seconds must be honoured");
assert.equal(parseRetryAfterMs(" 0 "), 0);
assert.equal(parseRetryAfterMs(null), null, "absent header must fall back to the caller's backoff");
assert.equal(parseRetryAfterMs("not-a-date"), null);
const dateNow = Date.parse("2026-10-21T00:00:00Z");
assert.equal(parseRetryAfterMs("Wed, 21 Oct 2026 00:01:00 GMT", dateNow), 60000, "HTTP-date form must be honoured");
assert.equal(parseRetryAfterMs("Wed, 21 Oct 2026 00:00:00 GMT", dateNow + 1000), 0, "past dates clamp to zero, never negative");
assert.equal(parseRetryAfterMs("Tue, 20 Oct 2026 00:00:00 GMT", dateNow), 0, "past dates clamp to zero");

// 2. Degraded runs must be recorded, not silent. The record is what lets the
// traffic job distinguish "upstream refused us" from "we read a frozen file".
const healthyCollection = buildCollectionHealth({ attemptedAt: "2026-10-21T09:50:00.000Z", fetchErrors: [], entries: 100, degraded: false });
assert.equal(healthyCollection.degraded, false);
assert.equal(healthyCollection.entriesCollected, 100);
assert.equal(healthyCollection.reason, null);
const degradedCollection = buildCollectionHealth({
  attemptedAt: "2026-10-21T09:50:00.000Z",
  fetchErrors: ["https://www.reddit.com/r/Subnautica_2/new/.rss?limit=100: Reddit RSS request failed (429)"],
  entries: 0,
  degraded: true,
});
assert.equal(degradedCollection.degraded, true);
assert.equal(degradedCollection.reason, "all-feeds-rejected");
assert.match(degradedCollection.lastError, /429/, "the recorded reason must keep the HTTP status for triage");
assert.ok(degradedCollection.lastError.length <= 500, "the recorded error must stay bounded");
const docWithCollection = candidateDocument({ previous: {}, merged, now: "2026-07-16T12:00:00Z", feedUrl: "x", collection: healthyCollection });
assert.equal(docWithCollection.collection.degraded, false, "healthy runs must also record their collection state");
assert.equal(candidateDocument({ previous: {}, merged, now: "2026-07-16T12:00:00Z", feedUrl: "x" }).collection, undefined, "omitting collection must not fabricate a record");

// 3. Inflection folding: "Bloom canker?" could not match a page titled
// "...Angel Comb cankers open?" because "canker" != "cankers", so an answerable
// question was held as if the site had no coverage.
assert.equal(foldToken("cankers"), "canker");
assert.equal(foldToken("fragments"), "fragment");
assert.equal(foldToken("recipes"), "recipe");
assert.equal(foldToken("boxes"), "box");
assert.equal(foldToken("classes"), "class");
assert.equal(foldToken("boxes"), "box");
assert.equal(foldToken("docks"), "dock");
// Words that merely end in s must survive intact.
assert.equal(foldToken("gas"), "gas");
assert.equal(foldToken("this"), "this");
assert.equal(foldToken("fps"), "fps");
assert.equal(foldToken("bonus"), "bonus");
assert.equal(foldToken("campus"), "campus");
assert.equal(foldToken("ruins"), "ruin");
const pluralIndex = { entries: [{ title: "Angel Comb cankers", href: "q/cankers.html", terms: "canker bloom" }] };
const pluralMatch = matchSiteIndexDetailed("Bloom canker?", pluralIndex);
assert.equal(pluralMatch.suggestedPages[0].titleHits, 1, "singular question must match plural page title");
assert.ok(pluralMatch.suggestedPages[0].hits >= 2, "plural and singular must both count as hits");

// 4. Tie-breaking on specificity. Ranking used to fall back to search-index
// order, so a generic word sent the reviewer to the wrong page: "Building a
// protected corridor" resolved to base-building.html, and because the decision was
// made on the top page only, the precise corridor page was never considered.
// The fixture mirrors the real corpus, where a generic word like "building" appears
// on many pages while "corridor" appears on exactly one.
const tieIndex = {
  entries: [
    { title: "Base building", href: "base-building.html", terms: "Habitat Builder base modules" },
    { title: "Corridor", href: "guide/items/corridor.html", terms: "Corridor Habitat Builder Titanium" },
    { title: "Tadpole vehicle planner", href: "vehicle-planner.html", terms: "vehicle depth chassis" },
    { title: "Base building advanced", href: "base-2.html", terms: "base building modules foundation" },
    { title: "Base building power", href: "base-3.html", terms: "base building power reactor" },
    { title: "Building a habitat", href: "base-4.html", terms: "building habitat construction" },
  ],
};
const tieMatch = matchSiteIndexDetailed("Building a protected corridor : worth it?", tieIndex);
assert.equal(tieMatch.suggestedPages[0].href, "guide/items/corridor.html", "the precise page must outrank a generic-token collision");
// A page that merely repeats a generic token must not win on raw frequency.
const genericMatch = matchSiteIndexDetailed("Base not enough power", tieIndex);
assert.ok(genericMatch.suggestedPages.some((page) => page.href.startsWith("base-")), "a real base question must still find a base page");

// 5. The reviewer must consider every suggested page, not just the top one.
// Regression: a loose match ranked first used to hold a candidate even when a
// later suggestion was a valid, cited, trilingual answer. Here the top-ranked page
// covers all tokens but shares nothing with a *title* (so it must be rejected),
// while the second-ranked page is a precise, entitled match that should pass.
const alternateRoot = await mkdtemp(path.join(tmpdir(), "evidence-alt-"));
const writeAlt = async (href) => {
  for (const prefix of ["", "zh-cn/", "ru/"]) {
    const target = path.join(alternateRoot, prefix, href);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFixture(target, '<!doctype html><a href="https://wiki.subnautica.com/sn2/index.php?oldid=1">rev</a>');
  }
};
await writeAlt("wrong/generic.html");
await writeAlt("right/specific.html");
const altIndex = {
  entries: [
    { title: "Generic page", href: "wrong/generic.html", terms: "corridor base building protected" },
    { title: "Corridor", href: "right/specific.html", terms: "corridor protected" },
  ],
};
const altRanking = matchSiteIndexDetailed("Building a protected corridor", altIndex);
assert.equal(altRanking.suggestedPages[0].href, "wrong/generic.html", "fixture precondition: the loose match must rank first");
assert.equal(altRanking.suggestedPages[0].titleHits, 0, "fixture precondition: the loose match must have no title overlap");
const altVerdict = reviewCandidateEvidence({
  candidate: { redditId: "alt", title: "Building a protected corridor", review: { state: "system-review" } },
  searchIndex: altIndex,
  pageEvidence: createPageEvidenceIndex({ root: alternateRoot }),
});
assert.equal(altVerdict.state, "ready-to-reply", "a valid alternate suggestion must be able to pass the gate");
assert.equal(altVerdict.page, "right/specific.html", "the passing page must be the one recorded as evidence");
// When genuinely nothing passes, the hold reasons still come from the best candidate.
const altReject = reviewCandidateEvidence({
  candidate: { redditId: "alt2", title: "Unrelated fan art question", review: { state: "system-review" } },
  searchIndex: altIndex,
  pageEvidence: createPageEvidenceIndex({ root: alternateRoot }),
});
assert.equal(altReject.state, "system-review");
assert.ok(altReject.reasons.length, "a held candidate must always explain itself");

// 6. A candidate whose stored page has disappeared from the live index must be
// held, not crash. `ranked` is empty here while `suggestedPages` is not, and the
// reviewer used to dereference a missing rank entry and throw, which took down the
// whole collector run.
const orphanVerdict = reviewCandidateEvidence({
  candidate: {
    redditId: "orphan",
    title: "Some question that no longer matches anything zzz",
    review: { state: "system-review" },
    suggestedPages: [{ href: "gone/page.html", title: "Gone", score: 0.9 }],
  },
  searchIndex: { entries: [] },
  pageEvidence: createPageEvidenceIndex({ root: alternateRoot }),
});
assert.equal(orphanVerdict.state, "system-review", "an orphaned stored page must hold the candidate");
assert.ok(orphanVerdict.reasons.length, "an orphaned candidate must still explain itself");
assert.equal(orphanVerdict.page, "gone/page.html", "the stored page must be reported for triage");
await rm(alternateRoot, { recursive: true, force: true });

await rm(fixtureRoot, { recursive: true, force: true });

process.stdout.write("Player question collector tests passed.\n");
