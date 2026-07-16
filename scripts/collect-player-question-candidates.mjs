import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  candidateDocument,
  countCommentEntries,
  findPublishedDuplicate,
  mergeCandidateFeed,
  normalizeRedditUrl,
  parseAtomFeed,
  renderCandidateReport,
} from "./lib/player-question-collector.mjs";

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
const now = process.env.COLLECTED_AT || new Date().toISOString();
const userAgent = process.env.REDDIT_USER_AGENT || "subnautica-2-guide/0.1 (https://github.com/specialzhou/subnautica-2-guide)";

const fetchText = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/atom+xml", "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`Reddit RSS request failed (${response.status}) for ${url}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/xml|atom/i.test(contentType)) throw new Error(`Unexpected Reddit RSS content type: ${contentType}`);
  return response.text();
};

const previous = args.has("reset") ? {} : JSON.parse(await readFile(outputPath, "utf8").catch(() => "{}"));
const published = JSON.parse(await readFile(path.join(root, "data/player-questions.json"), "utf8"));
const publishedUrls = new Set(published.questions.map((question) => normalizeRedditUrl(question.source.url)));
const feedXml = inputPath ? await readFile(inputPath, "utf8") : await fetchText(feedUrl);
const feedEntries = parseAtomFeed(feedXml);
if (!feedEntries.length) throw new Error("Reddit RSS contained no readable entries");

const merged = mergeCandidateFeed({ feedEntries, existing: previous, publishedUrls, now, threshold });
const document = candidateDocument({ previous, merged, now, feedUrl });
for (const candidate of document.candidates) {
  candidate.possibleDuplicateOf = findPublishedDuplicate(candidate.title, published.questions);
}

const detailCandidates = document.candidates
  .filter((candidate) => candidate.review?.state === "needs-review")
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

document.candidates.sort((a, b) => (b.attention?.comments ?? -1) - (a.attention?.comments ?? -1) || b.painScore - a.painScore || String(b.publishedAt).localeCompare(String(a.publishedAt)));
document.counts.total = document.candidates.length;
document.counts.needsReview = document.candidates.filter((candidate) => candidate.review?.state === "needs-review").length;
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
await writeFile(reportPath, renderCandidateReport(document));
process.stdout.write(`Collected ${feedEntries.length} Reddit posts; added ${merged.added} pain candidates; ${detailCandidates.length} discussion counts checked.\n`);
