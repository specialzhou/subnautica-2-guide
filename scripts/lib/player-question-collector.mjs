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

export function countCommentEntries(xml) {
  return [...String(xml).matchAll(/<id>t1_[^<]+<\/id>/gi)].length;
}

export function mergeCandidateFeed({ feedEntries, existing, publishedUrls, now, threshold = 5, maxCandidates = 80 }) {
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
      review: { state: "needs-review", answerStatus: "unknown", notes: "" },
      attention: { upvotes: null, comments: null, observedAt: null, approximate: true, method: "not-checked" },
    };
    if (!prior) added += 1;
    candidate.title = entry.title;
    candidate.questionKey = questionKey;
    candidate.url = normalizeRedditUrl(entry.url);
    candidate.publishedAt = entry.publishedAt;
    candidate.lastSeenAt = now;
    candidate.painScore = pain.score;
    candidate.signals = pain.signals;
    existingById.set(entry.redditId, candidate);
    existingByQuestionKey.set(questionKey, candidate);
    seenIds.add(entry.redditId);
  }

  const statePriority = { "needs-review": 0, "in-review": 1, dismissed: 2, promoted: 3 };
  const candidates = [...existingById.values()].sort((a, b) => {
    const state = (statePriority[a.review?.state] ?? 9) - (statePriority[b.review?.state] ?? 9);
    return state || (b.attention?.comments ?? -1) - (a.attention?.comments ?? -1) || b.painScore - a.painScore || String(b.publishedAt).localeCompare(String(a.publishedAt));
  }).slice(0, maxCandidates);

  return { candidates, seenRedditIds: [...seenIds].slice(-500), added };
}

export function candidateDocument({ previous = {}, merged, now, feedUrl }) {
  return {
    schemaVersion: "1.0.0",
    collectedAt: now,
    source: {
      platform: "Reddit",
      subreddit: "r/Subnautica_2",
      feedUrl,
      method: "public-atom-rss",
    },
    collectionPolicy: {
      purpose: "Find player questions for human review; never publish answers automatically.",
      storesPostBody: false,
      upvotes: "Unavailable through RSS; remains null until manually observed.",
      comments: "Estimated by counting comment entries in the public post RSS feed.",
      promotionGate: "A reviewer must verify the answer, evidence boundary, build context, and all three locales before moving a candidate to player-questions.json.",
    },
    detailCursor: previous.detailCursor ?? 0,
    counts: {
      total: merged.candidates.length,
      needsReview: merged.candidates.filter((candidate) => candidate.review?.state === "needs-review").length,
      addedThisRun: merged.added,
    },
    seenRedditIds: merged.seenRedditIds,
    candidates: merged.candidates,
  };
}

const markdownCell = (value) => String(value ?? "").replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("[", "\\[").replaceAll("]", "\\]").replace(/\s+/g, " ").trim();

export function renderCandidateReport(document) {
  const rows = document.candidates.map((candidate) => {
    const comments = candidate.attention?.comments ?? "?";
    const duplicate = candidate.possibleDuplicateOf ? `${candidate.possibleDuplicateOf.id} (${candidate.possibleDuplicateOf.score})` : "—";
    const sources = 1 + (candidate.relatedSources?.length ?? 0);
    return `| ${comments} | ${candidate.painScore} | ${sources} | ${markdownCell(candidate.review?.state)} | [${markdownCell(candidate.title)}](${candidate.url}) | ${markdownCell(duplicate)} |`;
  });
  return `# 玩家问题候选审核\n\n采集时间：${document.collectedAt}\n\n这里只包含 RSS 自动发现的候选。评论数为近似值；点赞数必须人工打开 Reddit 后确认。本文件中的内容不会自动发布到攻略站。\n\n使用 \`npm run review:question -- --reddit-id=<id>\` 创建受控审核模板。完成所有字段后，再运行 \`npm run promote:question -- --review=data/player-question-reviews/<id>.json\`。\n\n| 评论数 | 痛点分 | 来源数 | 审核状态 | 候选问题 | 可能重复的已发布攻略 |\n| ---: | ---: | ---: | --- | --- | --- |\n${rows.join("\n")}\n`;
}
