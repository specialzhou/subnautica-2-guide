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

const matchTokens = (value) => normalizeQuestionKey(value).split(" ").filter((token) => token.length > 2 && !duplicateStopWords.has(token));

export function matchSiteIndex(title = "", searchIndex = { entries: [] }) {
  const tokens = matchTokens(title);
  if (!tokens.length) return { suggestedPages: [], answerability: 0 };
  const tokenSet = new Set(tokens);
  const scored = [];
  for (const entry of searchIndex.entries ?? []) {
    const hay = `${entry.title ?? ""} ${entry.terms ?? ""} ${entry.localizedTitles?.en ?? ""} ${entry.localizedTerms?.en ?? ""} ${entry.localizedTerms?.["zh-cn"] ?? ""}`.toLowerCase();
    const hayTokens = new Set(hay.split(/[^a-z0-9]+/i).filter(Boolean));
    let hits = 0;
    for (const token of tokenSet) if (hayTokens.has(token)) hits += 1;
    const score = hits / tokens.length;
    if (score > 0) scored.push({ href: entry.href, title: entry.title, score: Number(score.toFixed(2)) });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  return {
    suggestedPages: top,
    answerability: top.length ? Number(Math.min(1, top[0].score).toFixed(2)) : 0,
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

export function candidateDocument({ previous = {}, merged, now, feedUrl, subreddits = [] }) {
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
