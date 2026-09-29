const SITE_BASE = "https://specialzhou.github.io/subnautica-2-guide";
const stateLimit = 1000;
const locales = ["en", "zh-cn", "ru"];

const normalizeRedditId = (url = "") => String(url).match(/\/comments\/([^/]+)/)?.[1] ?? "";
const round = (value) => Number(value.toFixed(2));

export function opportunityScore(candidate) {
  const comments = candidate.attention?.comments ?? 0;
  const duplicateScore = candidate.possibleDuplicateOf?.score ?? 0;
  return round(candidate.painScore + Math.min(comments, 20) + duplicateScore * 10);
}

const opportunityKey = (redditId, guideId) => `${redditId}:${guideId}`;

function buildGuideUrl(href, locale = "", content = "") {
  const localePrefix = locale ? `${locale}/` : "";
  const url = new URL(`${SITE_BASE}/${localePrefix}${href}`);
  url.searchParams.set("utm_source", "reddit");
  url.searchParams.set("utm_medium", "comment");
  url.searchParams.set("utm_campaign", "daily_traffic_opportunities");
  if (content) url.searchParams.set("utm_content", content);
  return url.toString();
}

const cta = {
  en: "I maintain a small evidence-linked guide and keep the build context and sources updated here",
  "zh-cn": "我维护了一份带证据链接的攻略，会持续更新版本与来源",
  ru: "Я веду небольшое руководство со ссылками на источники и обновляю контекст сборки и источники здесь",
};

const pointerIntro = {
  en: "Here is where I track this in my evidence-linked guide",
  "zh-cn": "我在带证据链接的攻略里追踪了这一点",
  ru: "Вот где я отслеживаю это в своём руководстве со ссылками",
};

function buildDraft(answerText, href, locale) {
  const link = buildGuideUrl(href, locale === "en" ? "" : locale);
  const localized = answerText?.[locale]?.trim();
  if (localized) {
    return `${localized}\n\n${cta[locale]}: ${link}`;
  }
  return `${pointerIntro[locale]}: ${link}`;
}

export function buildTrafficOpportunities({ candidates, questions, generatedAt, limit = 3, state = {} }) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const seenOpportunityKeys = new Set(state.seenOpportunityKeys ?? []);
  const ranked = [];

  for (const candidate of candidates) {
    if (candidate.review?.state !== "ready-to-reply") continue;
    const duplicate = candidate.possibleDuplicateOf;
    const duplicateQuestion = duplicate ? questionById.get(duplicate.id) : null;
    const isSolvedDuplicate =
      duplicate &&
      duplicate.score >= 0.55 &&
      duplicateQuestion &&
      duplicateQuestion.resolution === "solved" &&
      normalizeRedditId(duplicateQuestion.source?.url) !== candidate.redditId;

    let deepLinkHref = null;
    let guideId = null;
    let matchScore = 0;
    let answerText = null;
    let buildContext = null;
    let verification = null;

    if (isSolvedDuplicate) {
      deepLinkHref = `questions/${duplicateQuestion.id}.html`;
      guideId = duplicateQuestion.id;
      matchScore = duplicate.score;
      answerText = duplicateQuestion.answer;
      buildContext = duplicateQuestion.buildContext;
      verification = duplicateQuestion.verification;
    } else {
      // P1 B.2: new questions with a matched deep link also get a reply draft
      const relatedHref = candidate.relatedPages?.[0] ?? candidate.suggestedPages?.[0]?.href;
      if (!relatedHref) continue;
      deepLinkHref = relatedHref;
      guideId = relatedHref;
      matchScore = 0;
    }

    const key = opportunityKey(candidate.redditId, isSolvedDuplicate ? `dup:${guideId}` : `page:${guideId}`);
    if (seenOpportunityKeys.has(key)) continue;
    ranked.push({
      candidate,
      guideId,
      deepLinkHref,
      key,
      matchScore,
      answerText,
      buildContext,
      verification,
      score: opportunityScore(candidate),
    });
  }

  ranked.sort((a, b) => b.score - a.score || String(b.candidate.publishedAt).localeCompare(String(a.candidate.publishedAt)));
  const seenQuestions = new Set();
  const selected = [];
  for (const entry of ranked) {
    if (seenQuestions.has(entry.guideId)) continue;
    seenQuestions.add(entry.guideId);
    const content = entry.candidate.redditId;
    selected.push({
      opportunityKey: entry.key,
      redditId: entry.candidate.redditId,
      title: entry.candidate.title,
      redditUrl: entry.candidate.url,
      comments: entry.candidate.attention?.comments ?? null,
      painScore: entry.candidate.painScore,
      opportunityScore: entry.score,
      matchScore: entry.matchScore,
      guideId: entry.guideId,
      guideUrl: buildGuideUrl(entry.deepLinkHref, "", content),
      guideUrlZh: buildGuideUrl(entry.deepLinkHref, "zh-cn", content),
      guideUrlRu: buildGuideUrl(entry.deepLinkHref, "ru", content),
      buildContext: entry.buildContext,
      verification: entry.verification,
      replyDraft: buildDraft(entry.answerText, entry.deepLinkHref, "en"),
      replyDraftZh: buildDraft(entry.answerText, entry.deepLinkHref, "zh-cn"),
      replyDraftRu: buildDraft(entry.answerText, entry.deepLinkHref, "ru"),
    });
    if (selected.length >= limit) break;
  }

  return { generatedAt, count: selected.length, opportunities: selected };
}

const utcDay = (value) => String(value ?? "").slice(0, 10);

export function buildTrafficOpportunityState({ state = {}, report }) {
  const seenOpportunityKeys = new Set(state.seenOpportunityKeys ?? []);
  for (const entry of report.opportunities) seenOpportunityKeys.add(entry.opportunityKey);
  const produced = report.count > 0;
  // Re-runs within one UTC day (workflow_dispatch, retries) must not inflate the
  // dry-run streak, otherwise a manual poke would silence the alert for a day.
  const sameDayRerun = Boolean(state.lastRunAt) && utcDay(state.lastRunAt) === utcDay(report.generatedAt);
  let dryRunStreak = Number(state.dryRunStreak) || 0;
  if (produced) dryRunStreak = 0;
  else if (!sameDayRerun) dryRunStreak += 1;
  return {
    schemaVersion: "1.1.0",
    updatedAt: produced ? report.generatedAt : (state.updatedAt ?? report.generatedAt),
    lastRunAt: report.generatedAt,
    lastOpportunityAt: produced ? report.generatedAt : (state.lastOpportunityAt ?? null),
    dryRunStreak,
    seenOpportunityKeys: [...seenOpportunityKeys].slice(-stateLimit),
  };
}

/**
 * Distinguishes "today genuinely had no good question" from "the funnel has
 * stalled and nobody notices". The 2026-08-09 -> 2026-09-29 outage looked like a
 * green daily run for seven weeks precisely because nothing watched this.
 */
export function evaluatePipelineHealth({ state, alertAfterDryRuns = 3 } = {}) {
  const dryRunStreak = Number(state?.dryRunStreak) || 0;
  const alert = dryRunStreak >= alertAfterDryRuns;
  const lastOpportunityAt = state?.lastOpportunityAt ?? null;
  return {
    dryRunStreak,
    alert,
    lastOpportunityAt,
    message: alert
      ? `Reddit 流量机会已连续 ${dryRunStreak} 次运行产出 0 条（最后一次出水：${lastOpportunityAt ?? "从未"}）。这是管道空转，不是今天恰好没有问题：请检查候选队列的 ready-to-reply 数量与卡住原因分布。`
      : `连续 0 产出运行次数：${dryRunStreak}（告警阈值 ${alertAfterDryRuns}）。`,
  };
}

export function renderPipelineHealthSummary(health) {
  return `## Reddit 流量管道健康\n\n- 状态：${health.alert ? "🔴 空转" : "🟢 正常"}\n- ${health.message}\n- 最后一次出水：${health.lastOpportunityAt ?? "从未"}\n`;
}

/** Body for the "pipeline is dry" alert issue, written by the generator, filed by CI. */
export function renderPipelineAlertIssue({ health, report, queueDepth = {} }) {
  return `# 管道空转：Reddit 流量机会连续 ${health.dryRunStreak} 次运行 0 产出\n\n` +
    `生成时间：${report.generatedAt}\n\n` +
    `最后一次真正出水：${health.lastOpportunityAt ?? "从未"}\n\n` +
    `这不是"今天恰好没有问题"。工作流每天仍然报 success，是因为产出为 0 时它会跳过建单——` +
    `2026-08-09 到 2026-09-29 就是这样静默空转了七周，期间站点唯一的流量入口是干的。\n\n` +
    `## 当前队列\n\n` +
    `| 指标 | 数值 |\n| --- | ---: |\n` +
    `| 候选总数 | ${queueDepth.total ?? "—"} |\n` +
    `| ready-to-reply（可出水） | ${queueDepth.readyToReply ?? "—"} |\n` +
    `| system-review（卡住） | ${queueDepth.systemReview ?? "—"} |\n\n` +
    `## 排查顺序\n\n` +
    `1. 看最近一次「收集玩家问题候选」的 step summary 里的**卡住原因分布**——它会直接告诉你是匹配度不够、三语缺页，还是页面没外链证据。\n` +
    `2. 若 ready-to-reply 为 0 且原因集中在"匹配度过低/无标题词重叠"，说明是**内容缺口**：站上没有能回答这些问题的页面，需要补攻略而不是调阈值。\n` +
    `3. 若原因集中在"三语版本不齐全"或"目标页文件缺失"，说明是**本地化/构建回归**，跑 \`npm run validate\` 对照 check-locales 输出。\n` +
    `4. 若候选总数本身在掉，说明 Reddit RSS 采集被限流，看采集工作流有没有 \`Reddit 采集已降级\` 警告。\n\n` +
    `> 本 Issue 由 traffic-opportunities 工作流自动创建，不会自动操作 Reddit。\n`;
}

const verificationLabels = {
  official: "官方资料",
  community: "社区反馈",
  "official-and-community": "官方资料 + 社区反馈",
  "in-game": "游戏内验证",
  "wiki-and-community": "Wiki + 社区反馈",
  "wiki-revision": "Wiki 修订版本",
};

const escapeMarkdown = (value) => String(value ?? "—")
  .replaceAll("\\", "\\\\")
  .replaceAll("[", "\\[")
  .replaceAll("]", "\\]")
  .replaceAll("|", "\\|")
  .replace(/\s+/g, " ")
  .trim();

const draftBlock = (label, text) => `**${label}**\n\`\`\`text\n${text}\n\`\`\``;

export function renderTrafficOpportunityIssue(report) {
  const rows = report.opportunities.map((entry, index) => `| ${index + 1} | ${entry.opportunityScore} | ${entry.comments ?? "?"} | [${escapeMarkdown(entry.title)}](${entry.redditUrl}) | [${escapeMarkdown(entry.guideId)}](${entry.guideUrl}) | ${entry.matchScore} |`);
  const drafts = report.opportunities.map((entry, index) => `### ${index + 1}. ${escapeMarkdown(entry.title)}\n\n- Reddit 原帖：${entry.redditUrl}\n- 游戏版本：${entry.buildContext ?? "—"}\n- 证据等级：${verificationLabels[entry.verification] ?? entry.verification ?? "—"}\n- 推荐深链（英文）：${entry.guideUrl}\n- 推荐深链（中文）：${entry.guideUrlZh}\n- 推荐深链（俄文）：${entry.guideUrlRu}\n\n#### 已完成的系统审核\n\n- 已核对原帖上下文、当前解决状态、游戏版本和证据边界。\n- 草稿不会自动发布；站长只需决定是否手工复制发布。\n\n#### 可直接使用的回复（按目标社区语言选一条）\n\n${draftBlock("英文", entry.replyDraft)}\n\n${draftBlock("中文", entry.replyDraftZh)}\n\n${draftBlock("Русский", entry.replyDraftRu)}`);
  const empty = "今天没有新的合格机会。候选问题仍保留在审核队列中，系统不会自动发帖、评论、投票或私信。";
  return `# Reddit 流量机会\n\n生成时间：${report.generatedAt}\n\n本报告只接收已经完成证据审核的候选，并生成可直接使用的回复；不会自动操作 Reddit。\n\n| 排名 | 机会分 | 评论数 | Reddit 问题 | 匹配攻略 | 匹配度 |\n| ---: | ---: | ---: | --- | --- | ---: |\n${rows.length ? rows.join("\n") : `| — | — | — | ${empty} | — | — |`}\n\n## 可回复内容\n\n${drafts.length ? drafts.join("\n\n") : empty}\n`;
}
