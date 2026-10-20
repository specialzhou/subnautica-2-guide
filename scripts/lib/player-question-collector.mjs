const entityMap = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(value = "") {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(digits, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return entityMap[entity.toLowerCase()] ?? match;
  });
}

const textValue = (entry, tag) => decodeEntities(entry.match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "").trim();

export function stripMarkup(value = "") {
  const decoded = decodeEntities(decodeEntities(value));
  return decoded.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeRedditUrl(value = "") {
  try {
    const url = new URL(decodeEntities(value));
    url.search = "";
    url.hash = "";
    url.hostname = "www.reddit.com";
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return "";
  }
}

export function parseAtomFeed(xml) {
  return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const entry = match[1];
    const id = textValue(entry, "id").replace(/^t3_/, "");
    const link = normalizeRedditUrl(entry.match(/<link [^>]*href="([^"]+)"/i)?.[1] ?? "");
    return {
      redditId: id,
      title: textValue(entry, "title"),
      url: link,
      publishedAt: textValue(entry, "published") || textValue(entry, "updated"),
      bodyText: stripMarkup(textValue(entry, "content")),
    };
  }).filter((entry) => entry.redditId && entry.url && entry.title);
}

const signals = [
  ["help", /\b(help|advice|need help)\b/i, 5],
  ["stuck", /\b(stuck|soft[ -]?lock(?:ed)?|progression block)\b/i, 6],
  ["not-working", /\b(can(?:not|'t)|won't|doesn(?:'t| not)|not working|unable|failed?|broken)\b/i, 5],
  ["bug", /\b(bug|glitch|issue|problem|crash(?:es|ed)?|missing|lost)\b/i, 4],
  ["where", /\b(where|location|find|located)\b/i, 4],
  ["how", /\b(how|what is|what are|why|which)\b/i, 4],
  ["crafting", /\b(craft|fabricat|recipe|blueprint|fragment|build|place)\w*/i, 3],
  ["progression", /\b(story|progress|bioscan|scan|canker|angel comb|upgrade|unlock)\w*/i, 3],
  ["performance", /\b(fps|performance|frame gen|controller|controls|save file)\w*/i, 3],
];

const noise = /\b(meme|fan ?art|cosplay|giveaway|moderators? needed|tier list|trailer reaction|complete .{0,30} list|feedback so far|watch me|up close photos?|pet shiver|random dots|i played|how to find .{0,50} for bioscans)\b/i;

export function normalizeQuestionKey(value = "") {
  return String(value)
    .toLocaleLowerCase()
    .replace(/\[[^\]]+]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const duplicateStopWords = new Set(["the", "a", "an", "to", "of", "in", "on", "for", "with", "is", "are", "am", "i", "my", "it", "this", "that", "what", "where", "how", "why", "does", "do", "can", "cannot", "cant", "wont", "not", "new", "update", "help", "need"]);
const duplicateTokens = (value) => normalizeQuestionKey(value).split(" ").filter((token) => token.length > 2 && !duplicateStopWords.has(token));

export function findPublishedDuplicate(title, questions, threshold = 0.45) {
  const sourceTokens = new Set(duplicateTokens(title));
  if (sourceTokens.size < 2) return null;
  let best = null;
  for (const question of questions) {
    const targetTokens = new Set(duplicateTokens(`${question.question?.en ?? ""} ${question.searchTerms?.en ?? ""}`));
    const shared = [...sourceTokens].filter((token) => targetTokens.has(token));
    const score = shared.length / sourceTokens.size;
    if (shared.length < 2 || score < threshold || score <= (best?.score ?? 0)) continue;
    best = { id: question.id, score: Number(score.toFixed(2)), sharedTerms: shared };
  }
  return best;
}

export function scorePainEntry(entry) {
  const title = entry.title ?? "";
  const body = entry.bodyText ?? "";
  const combined = `${title} ${body}`;
  const matched = [];
  let score = title.includes("?") ? 3 : 0;
  for (const [name, pattern, weight] of signals) {
    if (!pattern.test(combined)) continue;
    matched.push(name);
    score += pattern.test(title) ? weight : Math.max(1, Math.floor(weight / 2));
  }
  if (noise.test(title)) score -= 8;
  return { score: Math.max(0, score), signals: matched };
}

const guideBaseUrl = "https://specialzhou.github.io/subnautica-2-guide/";

const highIntentPattern = /\b(craft|recipe|blueprint|fragment|fabricat|build|base|where|find|location|loot|resource|material|co-?op|multiplayer|scan|unlock|stuck|not working|how|what|why)\b/i;

export function computeTrafficValue(title = "") {
  return highIntentPattern.test(title) ? 1 : 0;
}

export function computePriorityScore(painScore = 0, answerability = 0, trafficValue = 0) {
  const safe = Number.isFinite(painScore) ? painScore : 0;
  const ans = Math.min(1, Math.max(0, Number(answerability) || 0));
  const tv = Number(trafficValue) ? 1 : 0;
  return Math.round(safe * (1 + ans) * (1 + 0.5 * tv));
}

/**
 * Collapses trivial English inflection so that a question phrased in the
 * singular still matches a page titled in the plural. Without this, "Bloom
 * canker?" shares only one *title* token with "Why won't the last Angel Comb
 * cankers open?" and the evidence reviewer holds a candidate the site can
 * actually answer. Deliberately conservative: no stemming library, no
 * cross-word guessing, only regular plural forms.
 */
export function foldToken(token = "") {
  if (token.length <= 4) return token;
  if (token.endsWith("ies") && token.length > 5) return `${token.slice(0, -3)}y`;
  if (/(?:ses|xes|zes|ches|shes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is")) return token.slice(0, -1);
  return token;
}

const matchTokens = (value) => normalizeQuestionKey(value).split(" ").filter((token) => token.length > 2 && !duplicateStopWords.has(token)).map(foldToken);

const indexHay = (entry) => `${entry.title ?? ""} ${entry.terms ?? ""} ${entry.localizedTitles?.en ?? ""} ${entry.localizedTerms?.en ?? ""} ${entry.localizedTerms?.["zh-cn"] ?? ""}`.toLowerCase();
const indexTitleHay = (entry) => `${entry.title ?? ""} ${entry.localizedTitles?.en ?? ""}`.toLowerCase();
const toTokenSet = (value) => new Set(value.split(/[^a-z0-9]+/i).filter(Boolean).map(foldToken));

/**
 * Same matching as matchSiteIndex but keeps the raw overlap counts, because the
 * evidence reviewer must tell "3 of 3 title tokens land on this page" apart from
 * "a single generic word happened to collide".
 *
 * Ranking is score-first, then *specificity*: when two pages tie on the raw
 * overlap ratio, the page whose matched tokens are rarer in the corpus wins.
 * Before this, ties fell back to search-index order, so "Building a protected
 * corridor" resolved to base-building.html (generic "building") instead of
 * guide/items/corridor.html, and the reviewer judged candidates against the
 * wrong page.
 */
export function matchSiteIndexDetailed(title = "", searchIndex = { entries: [] }) {
  const tokens = matchTokens(title);
  if (!tokens.length) return { suggestedPages: [], answerability: 0, tokenCount: 0 };
  const tokenSet = new Set(tokens);
  const entries = searchIndex.entries ?? [];
  // Corpus document frequency, used only to break ties between equal ratios.
  const documentFrequency = new Map();
  for (const entry of entries) {
    for (const token of toTokenSet(indexHay(entry))) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
  const specificity = (token) => 1 / (1 + (documentFrequency.get(token) ?? 0));
  const scored = [];
  for (const entry of entries) {
    const hayTokens = toTokenSet(indexHay(entry));
    const titleTokens = toTokenSet(indexTitleHay(entry));
    let hits = 0;
    let titleHits = 0;
    let rarity = 0;
    for (const token of tokenSet) {
      if (!hayTokens.has(token)) continue;
      hits += 1;
      rarity += specificity(token);
      if (titleTokens.has(token)) titleHits += 1;
    }
    const score = hits / tokens.length;
    if (score > 0) scored.push({ href: entry.href, title: entry.title, score: Number(score.toFixed(2)), hits, titleHits, rarity: Number(rarity.toFixed(4)) });
  }
  scored.sort((a, b) => b.score - a.score || b.titleHits - a.titleHits || b.rarity - a.rarity || b.hits - a.hits);
  const top = scored.slice(0, 3).map(({ rarity, ...page }) => page);
  return {
    suggestedPages: top,
    answerability: top.length ? Number(Math.min(1, top[0].score).toFixed(2)) : 0,
    tokenCount: tokens.length,
  };
}

export function matchSiteIndex(title = "", searchIndex = { entries: [] }) {
  const detailed = matchSiteIndexDetailed(title, searchIndex);
  return {
    suggestedPages: detailed.suggestedPages.map(({ hits, titleHits, ...page }) => page),
    answerability: detailed.answerability,
  };
}

export function countCommentEntries(xml) {
  return [...String(xml).matchAll(/<id>t1_[^<]+<\/id>/gi)].length;
}

export function mergeCandidateFeed({ feedEntries, existing, publishedUrls, now, threshold = 5, maxCandidates = 80, searchIndex = null }) {
  const carriedCandidates = (existing.candidates ?? []).filter((candidate) => !publishedUrls.has(normalizeRedditUrl(candidate.url)));
  const existingById = new Map(carriedCandidates.map((candidate) => [candidate.redditId, candidate]));
  const existingByQuestionKey = new Map(carriedCandidates.map((candidate) => [candidate.questionKey ?? normalizeQuestionKey(candidate.title), candidate]));
  const seenIds = new Set(existing.seenRedditIds ?? []);
  let added = 0;

  for (const entry of feedEntries) {
    if (publishedUrls.has(normalizeRedditUrl(entry.url))) continue;
    const pain = scorePainEntry(entry);
    if (pain.score < threshold) continue;
    const prior = existingById.get(entry.redditId);
    if (!prior && seenIds.has(entry.redditId)) continue;
    const questionKey = normalizeQuestionKey(entry.title);
    const grouped = existingByQuestionKey.get(questionKey);
    if (!prior && grouped) {
      grouped.relatedSources ??= [];
      if (!grouped.relatedSources.some((source) => source.redditId === entry.redditId)) {
        grouped.relatedSources.push({ redditId: entry.redditId, title: entry.title, url: normalizeRedditUrl(entry.url), publishedAt: entry.publishedAt });
      }
      grouped.lastSeenAt = now;
      seenIds.add(entry.redditId);
      continue;
    }
    const candidate = prior ?? {
      redditId: entry.redditId,
      firstSeenAt: now,
      review: { state: "system-review", answerStatus: "needs-evidence", notes: "等待系统核对 Reddit 上下文、官方资料和证据边界。" },
      attention: { upvotes: null, comments: null, observedAt: null, approximate: true, method: "not-checked" },
    };
    if (!prior) added += 1;
    candidate.title = entry.title;
    candidate.questionKey = questionKey;
    candidate.url = normalizeRedditUrl(entry.url);
    candidate.publishedAt = entry.publishedAt;
    candidate.lastSeenAt = now;
    candidate.sourceSubreddit = entry.sourceSubreddit ?? candidate.sourceSubreddit ?? "";
    candidate.painScore = pain.score;
    candidate.signals = pain.signals;
    existingById.set(entry.redditId, candidate);
    existingByQuestionKey.set(questionKey, candidate);
    seenIds.add(entry.redditId);
  }

  for (const candidate of existingById.values()) {
    const trafficValue = computeTrafficValue(candidate.title);
    const match = searchIndex ? matchSiteIndex(candidate.title, searchIndex) : { answerability: 0, suggestedPages: [] };
    candidate.trafficValue = trafficValue;
    candidate.answerability = match.answerability;
    candidate.suggestedPages = match.suggestedPages;
    candidate.priorityScore = computePriorityScore(candidate.painScore, match.answerability, trafficValue);
  }

  const statePriority = { "ready-to-reply": 0, "system-review": 1, dismissed: 2, promoted: 3 };
  const candidates = [...existingById.values()].sort((a, b) => {
    const state = (statePriority[a.review?.state] ?? 9) - (statePriority[b.review?.state] ?? 9);
    return state || (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || (b.attention?.comments ?? -1) - (a.attention?.comments ?? -1) || b.painScore - a.painScore || String(b.publishedAt).localeCompare(String(a.publishedAt));
  }).slice(0, maxCandidates);

  return { candidates, seenRedditIds: [...seenIds].slice(-500), added };
}

/**
 * Health of the *upstream feed*, recorded in the candidate document itself.
 *
 * Why this exists: when every RSS request is rejected the collector keeps the
 * existing queue and exits 0 (so a Reddit outage never blocks the commit step).
 * That is the right call, but it used to leave no trace in the data file, so
 * downstream could not tell "Reddit is refusing us" apart from "this job read a
 * frozen branch". The traffic job then hard-failed with the wrong diagnosis
 * ("候选数据源已过期，说明读到的不是最新文件") while the real cause was an
 * upstream outage. Recording the attempt makes both cases distinguishable.
 */
export function buildCollectionHealth({ attemptedAt, fetchErrors = [], entries = 0, degraded = false }) {
  return {
    attemptedAt,
    entriesCollected: entries,
    degraded,
    reason: degraded ? "all-feeds-rejected" : null,
    lastError: fetchErrors.length ? fetchErrors.join("; ").slice(0, 500) : null,
  };
}

/** Parses a Retry-After header (delta-seconds or HTTP-date) into milliseconds. */
export function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const asDate = Date.parse(raw);
  if (!Number.isFinite(asDate)) return null;
  return Math.max(0, asDate - nowMs);
}

export function candidateDocument({ previous = {}, merged, now, feedUrl, subreddits = [], collection = null }) {
  return {
    schemaVersion: "1.0.0",
    collectedAt: now,
    source: {
      platform: "Reddit",
      subreddit: subreddits[0] ?? "r/Subnautica_2",
      subreddits,
      feedUrl,
      method: "public-atom-rss",
    },
    collectionPolicy: {
      purpose: "Find player questions for evidence-based system review; never publish answers automatically.",
      storesPostBody: false,
      upvotes: "Unavailable through RSS; remains null until manually observed.",
      comments: "Estimated by counting comment entries in the public post RSS feed.",
      promotionGate: "The system must verify the Reddit context, answer, evidence boundary, build context, and all three locales before moving a candidate to player-questions.json.",
    },
    detailCursor: previous.detailCursor ?? 0,
    ...(collection ? { collection } : {}),
    counts: {
      total: merged.candidates.length,
      systemReview: merged.candidates.filter((candidate) => candidate.review?.state === "system-review").length,
      readyToReply: merged.candidates.filter((candidate) => candidate.review?.state === "ready-to-reply").length,
      dismissed: merged.candidates.filter((candidate) => candidate.review?.state === "dismissed").length,
      addedThisRun: merged.added,
    },
    seenRedditIds: merged.seenRedditIds,
    candidates: merged.candidates,
  };
}

const markdownCell = (value) => String(value ?? "").replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("[", "\\[").replaceAll("]", "\\]").replace(/\s+/g, " ").trim();

export function extractSubredditFromFeedUrl(feedUrl = "") {
  const match = String(feedUrl).match(/\/r\/([A-Za-z0-9_]+)/);
  return match ? `r/${match[1]}` : "";
}

export function renderCandidateReport(document) {
  const pageLink = (page) => page ? `[${markdownCell(page.title)}](${guideBaseUrl}${page.href})` : "—";
  const suggested = (candidate) => (candidate.suggestedPages?.length ? candidate.suggestedPages.map(pageLink).join("; ") : "—");
  const rows = document.candidates.map((candidate) => {
    const comments = candidate.attention?.comments ?? "?";
    const duplicate = candidate.possibleDuplicateOf ? `${candidate.possibleDuplicateOf.id} (${candidate.possibleDuplicateOf.score})` : "—";
    const sources = 1 + (candidate.relatedSources?.length ?? 0);
    return `| ${comments} | ${candidate.painScore} | ${sources} | ${markdownCell(candidate.review?.state)} | [${markdownCell(candidate.title)}](${candidate.url}) | ${markdownCell(duplicate)} | ${candidate.answerability ?? 0} | ${candidate.trafficValue ?? 0} | ${candidate.priorityScore ?? 0} | ${suggested(candidate)} | ${candidate.sourceSubreddit ?? "—"} |`;
  });
  return `# 玩家问题候选审核\n\n采集时间：${document.collectedAt}\n\n这里只包含 RSS 自动发现的候选。评论数为近似值；点赞数必须通过 Reddit 登录态核对。本文件中的内容不会自动发布到攻略站。\n\n状态说明：\`system-review\` 由系统继续核对证据；\`ready-to-reply\` 已完成证据审核，可生成回复草稿；\`dismissed\` 是重复、已解决或不适合攻略化的内容。站长不需要判断游戏事实。\n\n优先级 = 痛点分 × (1+可答性) × (1+0.5×流量价值)，由系统按站点搜索索引自动算；建议页面为自动匹配的深链，人工审核时可直接采纳。\n\n| 评论数 | 痛点分 | 来源数 | 审核状态 | 候选问题 | 可能重复的已发布攻略 | 可答性 | 流量价值 | 优先级 | 建议页面 | 来源 |\n| ---: | ---: | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- |\n${rows.join("\n")}\n`;
}
