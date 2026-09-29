import { readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  candidateDocument,
  countCommentEntries,
  extractSubredditFromFeedUrl,
  findPublishedDuplicate,
  mergeCandidateFeed,
  normalizeRedditUrl,
  parseAtomFeed,
  renderCandidateReport,
} from "./lib/player-question-collector.mjs";
import {
  applyEvidenceAutoReview,
  createPageEvidenceIndex,
  defaultEvidencePolicy,
  renderEvidenceReviewSummary,
} from "./lib/question-evidence-review.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.length ? value.join("=") : true];
}));
const outputPath = path.resolve(root, String(args.get("output") || "data/player-question-candidates.json"));
const reportPath = path.resolve(root, String(args.get("report") || "data/player-question-candidates.md"));
const inputPath = args.get("input") ? path.resolve(root, String(args.get("input"))) : null;
const feedUrl = String(args.get("feed") || process.env.REDDIT_FEED_URL || "https://www.reddit.com/r/Subnautica_2/new/.rss?limit=100");
const threshold = Number(args.get("threshold") || 5);
const maxDetails = Number(args.get("max-details") || 0);
const detailDelayMs = Number(args.get("detail-delay-ms") || 65000);
const fetchAttempts = Math.max(1, Number(args.get("fetch-attempts") || 1));
const fetchRetryDelayMs = Math.max(0, Number(args.get("fetch-retry-delay-ms") || 5000));
const allowStaleFeed = args.has("allow-stale-feed");
const skipAutoReview = args.has("no-auto-review");
const feedsArg = args.get("feeds");
const feedUrls = feedsArg ? String(feedsArg).split(",").map((value) => value.trim()).filter(Boolean) : [feedUrl];
const now = process.env.COLLECTED_AT || new Date().toISOString();
const userAgent = process.env.REDDIT_USER_AGENT || "subnautica-2-guide/0.1 (https://github.com/specialzhou/subnautica-2-guide)";

const fetchText = async (url, { attempts = 1, retryDelayMs = 0 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/atom+xml", "User-Agent": userAgent } });
      if (!response.ok) throw new Error(`Reddit RSS request failed (${response.status}) for ${url}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!/xml|atom/i.test(contentType)) throw new Error(`Unexpected Reddit RSS content type: ${contentType}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }
  throw lastError;
};

const previous = args.has("reset") ? {} : JSON.parse(await readFile(outputPath, "utf8").catch(() => "{}"));
const published = JSON.parse(await readFile(path.join(root, "data/player-questions.json"), "utf8"));
const publishedUrls = new Set(published.questions.map((question) => normalizeRedditUrl(question.source.url)));
const searchIndex = JSON.parse(await readFile(path.join(root, "data/search-index.json"), "utf8").catch(() => "{}"));
const allEntries = [];
const subreddits = [];
const fetchErrors = [];
for (const currentFeedUrl of feedUrls) {
  let feedXml;
  try {
    feedXml = inputPath && feedUrls.length === 1
      ? await readFile(inputPath, "utf8")
      : await fetchText(currentFeedUrl, { attempts: fetchAttempts, retryDelayMs: fetchRetryDelayMs });
  } catch (error) {
    fetchErrors.push(`${currentFeedUrl}: ${error.message}`);
    continue;
  }
  const entries = parseAtomFeed(feedXml);
  const subreddit = extractSubredditFromFeedUrl(currentFeedUrl);
  for (const entry of entries) entry.sourceSubreddit = subreddit;
  if (subreddit && !subreddits.includes(subreddit)) subreddits.push(subreddit);
  allEntries.push(...entries);
}
if (!allEntries.length) {
  if (!allowStaleFeed || !fetchErrors.length) {
    throw new Error(fetchErrors.length ? fetchErrors.join("; ") : "Reddit RSS contained no readable entries");
  }
  const message = `Reddit 当前拒绝所有 RSS 请求；已保留现有候选队列，本次没有采集新帖子。${fetchErrors.join("; ")}`;
  process.stderr.write(`::warning title=Reddit 采集已降级::${message}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Reddit 采集已降级\n\n${message}\n`, { flag: "a" });
  }
  process.exit(0);
}
if (fetchErrors.length) {
  process.stderr.write(`::warning title=部分 sub 采集失败::${fetchErrors.join("; ")}\n`);
}
const feedEntries = allEntries;

const merged = mergeCandidateFeed({ feedEntries, existing: previous, publishedUrls, now, threshold, searchIndex });
const document = candidateDocument({ previous, merged, now, feedUrl: feedUrls.join(", "), subreddits });
for (const candidate of document.candidates) {
  candidate.possibleDuplicateOf = findPublishedDuplicate(candidate.title, published.questions);
}

// System evidence review: advances system-review -> ready-to-reply when the site
// really does hold a trilingual, source-cited page that answers the question.
// Without this step nothing ever reached the Reddit draft generator and the
// traffic funnel sat at zero opportunities for seven weeks while CI stayed green.
const reviewCounts = skipAutoReview
  ? { promoted: 0, revoked: 0, held: 0, skippedHuman: 0, alreadyReady: 0, disabled: true }
  : applyEvidenceAutoReview({
    document,
    searchIndex,
    pageEvidence: createPageEvidenceIndex({ root }),
    now,
  });
document.reviewPolicy = skipAutoReview ? { disabled: true } : { ...defaultEvidencePolicy, externalSourcePattern: undefined };
document.counts.autoPromotedThisRun = reviewCounts.promoted;
document.counts.autoRevokedThisRun = reviewCounts.revoked;

const detailCandidates = document.candidates
  .filter((candidate) => candidate.review?.state === "system-review")
  .sort((a, b) => String(a.attention?.observedAt ?? "").localeCompare(String(b.attention?.observedAt ?? "")))
  .slice(0, Math.max(0, maxDetails));

for (let index = 0; index < detailCandidates.length; index += 1) {
  if (index > 0 && detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, detailDelayMs));
  const candidate = detailCandidates[index];
  try {
    const rssUrl = `${candidate.url}.rss?limit=500`;
    const detailXml = await fetchText(rssUrl);
    candidate.attention = {
      upvotes: null,
      comments: countCommentEntries(detailXml),
      observedAt: now,
      approximate: true,
      method: "reddit-post-rss-comment-entry-count",
    };
  } catch (error) {
    candidate.attention = { ...candidate.attention, lastErrorAt: now, lastError: error.message };
  }
}

const statePriority = { "ready-to-reply": 0, "system-review": 1, dismissed: 2, promoted: 3 };
document.candidates.sort((a, b) => ((statePriority[a.review?.state] ?? 9) - (statePriority[b.review?.state] ?? 9)) || (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || (b.attention?.comments ?? -1) - (a.attention?.comments ?? -1) || b.painScore - a.painScore || String(b.publishedAt).localeCompare(String(a.publishedAt)));
document.counts.total = document.candidates.length;
document.counts.systemReview = document.candidates.filter((candidate) => candidate.review?.state === "system-review").length;
document.counts.readyToReply = document.candidates.filter((candidate) => candidate.review?.state === "ready-to-reply").length;
document.counts.dismissed = document.candidates.filter((candidate) => candidate.review?.state === "dismissed").length;
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
const reviewSummary = renderEvidenceReviewSummary({ document, counts: reviewCounts });
await writeFile(reportPath, `${renderCandidateReport(document)}\n${reviewSummary}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${reviewSummary}\n`);
}
if (!document.counts.readyToReply) {
  // Warning, not error: failing here would block the candidate commit step and
  // turn a visibility problem into an actual outage. The hard failure lives in
  // the traffic-opportunities workflow, which is the job that owns the output.
  process.stderr.write("::warning title=Reddit 候选队列零出水::没有任何候选通过系统证据审核，流量机会生成器将持续返回 0 条。请查看本次 step summary 的卡住原因分布。\n");
}
process.stdout.write(`Collected ${feedEntries.length} Reddit posts across ${subreddits.length} subreddit(s) (${subreddits.join(", ")}); added ${merged.added} pain candidates; ${detailCandidates.length} discussion counts checked; evidence review promoted ${reviewCounts.promoted}/revoked ${reviewCounts.revoked}, ready-to-reply now ${document.counts.readyToReply}.\n`);
