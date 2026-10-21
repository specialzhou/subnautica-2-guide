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
      // P1 B.2: new questions with a matched deep link also get a reply draft.
      //
      // When that deep link is one of our own question pages, the page already
      // carries a vetted trilingual answer -- reuse it instead of degrading to a
      // bare "here is a link" stub. Without this every non-duplicate opportunity
      // shipped a content-free draft (see issues #84/#86/#88), which is useless
      // to post and reads as spam.
      const relatedHref = candidate.relatedPages?.[0] ?? candidate.suggestedPages?.[0]?.href;
      if (!relatedHref) continue;
      deepLinkHref = relatedHref;
      guideId = relatedHref;
      matchScore = 0;
      const questionMatch = /^questions\/([a-z0-9-]+)\.html$/.exec(relatedHref);
      const linkedQuestion = questionMatch ? questionById.get(questionMatch[1]) : null;
      if (linkedQuestion?.answer) {
        answerText = linkedQuestion.answer;
        buildContext = linkedQuestion.buildContext;
        verification = linkedQuestion.verification;
      }
    }

    const key = opportunityKey(candidate.redditId, isSolvedDuplicate ? `dup:${guideId}` : `page:${guideId}`);
    if (seenOpportunityKeys.has(key)) continue;
    // An entry with no answer text is a link drop, not a draft. It is still
    // listed (the pointer draft is a designed behaviour), but flagged so the
    // rendered issue can say plainly that there is nothing to paste yet.
    const hasAnswer = Boolean(answerText?.en?.trim());
    ranked.push({
      candidate,
      guideId,
      deepLinkHref,
      key,
      matchScore,
      answerText,
      buildContext,
      verification,
      hasAnswer,
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
      hasAnswer: entry.hasAnswer,
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
 *
 * A dry streak has two possible owners, and they need different responses:
 *   - the repo (`funnel-defect`): fresh candidates keep arriving and still never
 *     convert. Fail the job red -- the owner can fix this today.
 *   - the upstream feed (`upstream-starved`): Reddit rejected every request and
 *     the existing queue has already been drained. The alarm must still fire and
 *     still file an issue, but turning the job red does not make Reddit serve us
 *     again; it only teaches everyone that red on this workflow is noise, which
 *     is exactly the failure this gate was built to prevent.
 * The streak itself, its threshold and the issue are unchanged. Only the
 * attribution and the exit severity differ, and an unattributed dry streak is
 * always treated as a funnel defect.
 */
export function evaluatePipelineHealth({ state, alertAfterDryRuns = 3, upstreamDegraded = false } = {}) {
  const dryRunStreak = Number(state?.dryRunStreak) || 0;
  const alert = dryRunStreak >= alertAfterDryRuns;
  const lastOpportunityAt = state?.lastOpportunityAt ?? null;
  const cause = upstreamDegraded ? "upstream-starved" : "funnel-defect";
  const message = alert
    ? upstreamDegraded
      ? `Reddit 流量机会已连续 ${dryRunStreak} 次运行产出 0 条（最后一次出水：${lastOpportunityAt ?? "从未"}）。队列里可回复的候选都已用尽，而上游 Reddit 采集一直拿不到新帖，所以没有新机会可发——这是外部限流导致的枯竭，不是本站漏斗缺陷。恢复采集后会自动出水；请不要通过调阈值或清空 seenOpportunityKeys 来制造产出。`
      : `Reddit 流量机会已连续 ${dryRunStreak} 次运行产出 0 条（最后一次出水：${lastOpportunityAt ?? "从未"}）。这是管道空转，不是今天恰好没有问题：请检查候选队列的 ready-to-reply 数量与卡住原因分布。`
    : `连续 0 产出运行次数：${dryRunStreak}（告警阈值 ${alertAfterDryRuns}）。`;
  return {
    dryRunStreak,
    alert,
    cause: alert ? cause : null,
    // The issue is filed for both causes; only the repo-owned one fails the job.
    fail: alert && cause === "funnel-defect",
    lastOpportunityAt,
    message,
  };
}

/**
 * The candidate file is produced by a separate daily collector. If this job ever
 * reads a snapshot from a dead source again -- which is exactly what happened from
 * 2026-08-31 to 2026-10-04, when CI overwrote main's file with a frozen branch --
 * every ready-to-reply entry is already in seenOpportunityKeys, so the pipeline
 * reports "0 opportunities" forever while looking like ordinary day-to-day variance.
 * Age is the one signal that separates a stale source from a genuinely quiet day.
 *
 * A stale age has two very different causes, and conflating them sends whoever is
 * on call to the wrong place:
 *   - `stale-read`: the collector is running fine but this job read an old copy.
 *     That is a real defect here and must fail loudly.
 *   - `upstream-degraded`: the collector ran recently and told us, in the file it
 *     wrote, that Reddit rejected every request. Nothing is wrong with the read;
 *     there was simply nothing new to read. Failing red here just re-reports an
 *     outage we cannot fix from CI, and hides the fact that recovery is external.
 */
export function evaluateCandidateFreshness({ collectedAt, generatedAt, maxAgeDays = 3, collection = null } = {}) {
  const collectedMs = Date.parse(String(collectedAt ?? ""));
  const generatedMs = Date.parse(String(generatedAt ?? ""));
  if (!Number.isFinite(collectedMs)) {
    return { ok: false, ageDays: null, reason: "missing-collectedAt", message: `候选文件没有可用的 collectedAt（当前值：${collectedAt ?? "缺失"}），无法判断数据源是否还在更新。` };
  }
  const referenceMs = Number.isFinite(generatedMs) ? generatedMs : Date.now();
  const ageDays = (referenceMs - collectedMs) / 86_400_000;

  // Did the collector itself report a degraded run? Its own timestamp is the
  // authority: if it attempted the fetch recently, the file is current even
  // though no new posts could be appended.
  const attemptedMs = Date.parse(String(collection?.attemptedAt ?? ""));
  const attemptedRecently = Number.isFinite(attemptedMs) && (referenceMs - attemptedMs) / 86_400_000 <= maxAgeDays;
  const upstreamDegraded = Boolean(collection?.degraded) && attemptedRecently;

  if (ageDays > maxAgeDays) {
    if (upstreamDegraded) {
      return {
        ok: true,
        ageDays,
        reason: "upstream-degraded",
        degraded: true,
        message: `候选队列自 ${collectedAt} 起没有新增：上游 Reddit 采集已降级（最后一次尝试 ${collection.attemptedAt}，${collection.reason ?? "feed-rejected"}${collection.lastError ? `：${collection.lastError}` : ""}）。这不是本步骤读到了旧文件，而是上游拒绝了全部请求；队列本身（${collection.entriesCollected ?? 0} 条新增）原样保留。恢复取决于 Reddit 是否解除限流，因此本步骤不重复报红。`,
      };
    }
    return {
      ok: false,
      ageDays,
      reason: "stale",
      message: `候选数据源已过期：collectedAt=${collectedAt}，距运行时间 ${Math.floor(ageDays)} 天（阈值 ${maxAgeDays} 天），且采集工作流没有留下降级记录。这说明本步骤读到的不是采集工作流最新写入的文件，而不是"今天恰好没有问题"。`,
    };
  }
  return {
    ok: true,
    ageDays,
    reason: upstreamDegraded ? "upstream-degraded" : null,
    degraded: upstreamDegraded,
    message: upstreamDegraded
      ? `候选数据源虽新，但上游采集已降级：${collection.lastError ?? collection.reason ?? "feed-rejected"}。`
      : `候选数据源新鲜：collectedAt=${collectedAt}（${ageDays.toFixed(2)} 天前）。`,
  };
}

export function renderPipelineHealthSummary(health) {
  return `## Reddit 流量管道健康\n\n- 状态：${health.alert ? "🔴 空转" : "🟢 正常"}\n- ${health.message}\n- 最后一次出水：${health.lastOpportunityAt ?? "从未"}\n`;
}

/** Body for the "pipeline is dry" alert issue, written by the generator, filed by CI. */
export function renderPipelineAlertIssue({ health, report, queueDepth = {}, freshness = null }) {
  const starvation = Boolean(freshness?.degraded);
  const upstreamNote = starvation
    ? `\n## ⚠️ 上游采集已降级（本次空转的归因）\n\n${freshness.message}\n\n` +
      `这一条是**外因**：队列里可回复的候选都已经出过水，Reddit 又拒绝新帖，所以没有新机会可发。` +
      `恢复采集后本 Issue 会自然停止；在恢复前请不要靠调阈值或清空 seenOpportunityKeys 来制造产出——` +
      `那只会把同一批帖子重复发一遍。\n`
    : "";
  // The opening paragraph must not accuse the funnel when the feed is the cause;
  // a wrong diagnosis here is what sent the previous investigation down the
  // "CI read a frozen branch" path while Reddit was actually returning 429.
  const opening = starvation
    ? `工作流每天仍然报 success，是因为产出为 0 时它会跳过建单——2026-08-09 到 2026-09-29 ` +
      `就是这样静默空转了七周。本次空转的归因是**上游限流**，不是本站漏斗缺陷，因此本步骤只发警告、不判红；` +
      `下面的排查顺序仅在**上游恢复后仍然 0 产出**时才需要执行。\n`
    : `这不是"今天恰好没有问题"。工作流每天仍然报 success，是因为产出为 0 时它会跳过建单——` +
      `2026-08-09 到 2026-09-29 就是这样静默空转了七周，期间站点唯一的流量入口是干的。\n`;
  const troubleshooting = `## 排查顺序\n\n` +
    `1. 看最近一次「收集玩家问题候选」的 step summary 里的**卡住原因分布**——它会直接告诉你是匹配度不够、三语缺页，还是页面没外链证据。\n` +
    `2. 若 ready-to-reply 为 0 且原因集中在"匹配度过低/无标题词重叠"，说明是**内容缺口**：站上没有能回答这些问题的页面，需要补攻略而不是调阈值。\n` +
    `3. 若原因集中在"三语版本不齐全"或"目标页文件缺失"，说明是**本地化/构建回归**，跑 \`npm run validate\` 对照 check-locales 输出。\n` +
    `4. 若候选总数本身在掉，说明 Reddit RSS 采集被限流，看采集工作流有没有 \`Reddit 采集已降级\` 警告。\n\n`;
  return `# 管道空转：Reddit 流量机会连续 ${health.dryRunStreak} 次运行 0 产出\n\n` +
    `生成时间：${report.generatedAt}\n\n` +
    `最后一次真正出水：${health.lastOpportunityAt ?? "从未"}\n\n` +
    opening +
    upstreamNote +
    `\n## 当前队列\n\n` +
    `| 指标 | 数值 |\n| --- | ---: |\n` +
    `| 候选总数 | ${queueDepth.total ?? "—"} |\n` +
    `| ready-to-reply（可出水） | ${queueDepth.readyToReply ?? "—"} |\n` +
    `| system-review（卡住） | ${queueDepth.systemReview ?? "—"} |\n\n` +
    troubleshooting +
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
  const answerable = report.opportunities.filter((entry) => entry.hasAnswer);
  const linkOnly = report.opportunities.length - answerable.length;
  const rows = report.opportunities.map((entry, index) => `| ${index + 1} | ${entry.opportunityScore} | ${entry.comments ?? "?"} | [${escapeMarkdown(entry.title)}](${entry.redditUrl}) | [${escapeMarkdown(entry.guideId)}](${entry.guideUrl}) | ${entry.matchScore} | ${entry.hasAnswer ? "可直接发" : "待补内容"} |`);
  const drafts = report.opportunities.map((entry, index) => {
    const header = `### ${index + 1}. ${escapeMarkdown(entry.title)}`;
    const meta = `- Reddit 原帖：${entry.redditUrl}\n- 游戏版本：${entry.buildContext ?? "—"}\n- 证据等级：${verificationLabels[entry.verification] ?? entry.verification ?? "—"}\n- 推荐深链（英文）：${entry.guideUrl}\n- 推荐深链（中文）：${entry.guideUrlZh}\n- 推荐深链（俄文）：${entry.guideUrlRu}`;
    if (!entry.hasAnswer) {
      // Be explicit: there is nothing to paste. Showing an empty "draft" is how
      // these issues previously wasted the maintainer's time.
      return `${header}\n\n${meta}\n\n#### ⚠️ 暂无可用回复\n\n本站还没有能直接回答这个问题的页面内容，**本条不需要你做任何决定**。\n它留在队列里只是提示内容缺口；等对应攻略页补齐答案后会自动重新进入待发列表。\n若你完全不打算手工发 Reddit，可以忽略或直接关闭本 Issue。`;
    }
    return `${header}\n\n${meta}\n\n#### 已完成的系统审核\n\n- 已核对原帖上下文、当前解决状态、游戏版本和证据边界。\n- 草稿不会自动发布；站长只需决定是否手工复制发布。\n\n#### 可直接使用的回复（按目标社区语言选一条）\n\n${draftBlock("英文", entry.replyDraft)}\n\n${draftBlock("中文", entry.replyDraftZh)}\n\n${draftBlock("Русский", entry.replyDraftRu)}`;
  });
  const empty = "今天没有新的合格机会。候选问题仍保留在审核队列中，系统不会自动发帖、评论、投票或私信。";
  const summary = answerable.length
    ? `${answerable.length} 条可直接复制发布${linkOnly ? `，另有 ${linkOnly} 条待补内容（无需你处理）` : "。"}`
    : "今天没有可直接发布的回复。";
  return `# Reddit 流量机会\n\n生成时间：${report.generatedAt}\n\n${summary}\n\n本报告只接收已经完成证据审核的候选；不会自动操作 Reddit。\n\n| 排名 | 机会分 | 评论数 | Reddit 问题 | 匹配攻略 | 匹配度 | 状态 |\n| ---: | ---: | ---: | --- | --- | ---: | --- |\n${rows.length ? rows.join("\n") : `| — | — | — | ${empty} | — | — | — |`}\n\n## 可回复内容\n\n${drafts.length ? drafts.join("\n\n") : empty}\n`;
}
