const guideBaseUrl = "https://specialzhou.github.io/subnautica-2-guide/questions";
const stateLimit = 1000;

const normalizeRedditId = (url = "") => String(url).match(/\/comments\/([^/]+)/)?.[1] ?? "";
const round = (value) => Number(value.toFixed(2));

export function opportunityScore(candidate) {
  const comments = candidate.attention?.comments ?? 0;
  const duplicateScore = candidate.possibleDuplicateOf?.score ?? 0;
  return round(candidate.painScore + Math.min(comments, 20) + duplicateScore * 10);
}

const opportunityKey = (redditId, guideId) => `${redditId}:${guideId}`;

export function buildTrafficOpportunities({ candidates, questions, generatedAt, limit = 3, state = {} }) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const seenOpportunityKeys = new Set(state.seenOpportunityKeys ?? []);
  const ranked = [];

  for (const candidate of candidates) {
    if (candidate.review?.state !== "needs-review") continue;
    const match = candidate.possibleDuplicateOf;
    if (!match || match.score < 0.55) continue;
    const question = questionById.get(match.id);
    if (!question || question.resolution !== "solved") continue;
    if (normalizeRedditId(question.source?.url) === candidate.redditId) continue;
    const key = opportunityKey(candidate.redditId, question.id);
    if (seenOpportunityKeys.has(key)) continue;
    ranked.push({ candidate, question, key, matchScore: match.score, score: opportunityScore(candidate) });
  }

  ranked.sort((a, b) => b.score - a.score || String(b.candidate.publishedAt).localeCompare(String(a.candidate.publishedAt)));
  const seenQuestions = new Set();
  const selected = [];
  for (const entry of ranked) {
    if (seenQuestions.has(entry.question.id)) continue;
    seenQuestions.add(entry.question.id);
    const trackingUrl = new URL(`${guideBaseUrl}/${entry.question.id}.html`);
    trackingUrl.searchParams.set("utm_source", "reddit");
    trackingUrl.searchParams.set("utm_medium", "comment");
    trackingUrl.searchParams.set("utm_campaign", "daily_traffic_opportunities");
    trackingUrl.searchParams.set("utm_content", entry.candidate.redditId);
    selected.push({
      opportunityKey: entry.key,
      redditId: entry.candidate.redditId,
      title: entry.candidate.title,
      redditUrl: entry.candidate.url,
      comments: entry.candidate.attention?.comments ?? null,
      painScore: entry.candidate.painScore,
      opportunityScore: entry.score,
      matchScore: entry.matchScore,
      guideId: entry.question.id,
      guideUrl: trackingUrl.toString(),
      buildContext: entry.question.buildContext,
      verification: entry.question.verification,
      replyDraft: `${entry.question.answer.en}\n\nI maintain a small evidence-linked guide and keep the build context and sources updated here: ${trackingUrl.toString()}`,
    });
    if (selected.length >= limit) break;
  }

  return { generatedAt, count: selected.length, opportunities: selected };
}

export function buildTrafficOpportunityState({ state = {}, report }) {
  const seenOpportunityKeys = new Set(state.seenOpportunityKeys ?? []);
  for (const entry of report.opportunities) seenOpportunityKeys.add(entry.opportunityKey);
  return {
    schemaVersion: "1.0.0",
    updatedAt: report.count > 0 ? report.generatedAt : (state.updatedAt ?? report.generatedAt),
    seenOpportunityKeys: [...seenOpportunityKeys].slice(-stateLimit),
  };
}

const verificationLabels = {
  official: "官方资料",
  community: "社区反馈",
  "official-and-community": "官方资料 + 社区反馈",
  "in-game": "游戏内验证",
};

const escapeMarkdown = (value) => String(value ?? "—")
  .replaceAll("\\", "\\\\")
  .replaceAll("[", "\\[")
  .replaceAll("]", "\\]")
  .replaceAll("|", "\\|")
  .replace(/\s+/g, " ")
  .trim();

export function renderTrafficOpportunityIssue(report) {
  const rows = report.opportunities.map((entry, index) => `| ${index + 1} | ${entry.opportunityScore} | ${entry.comments ?? "?"} | [${escapeMarkdown(entry.title)}](${entry.redditUrl}) | [${entry.guideId}](${entry.guideUrl}) | ${entry.matchScore} |`);
  const drafts = report.opportunities.map((entry, index) => `### ${index + 1}. ${escapeMarkdown(entry.title)}\n\n- Reddit 原帖：${entry.redditUrl}\n- 游戏版本：${entry.buildContext}\n- 证据等级：${verificationLabels[entry.verification] ?? entry.verification}\n\n#### 人工审核清单\n\n- [ ] 打开原帖，确认问题仍未解决且回复仍有价值\n- [ ] 核对玩家平台、当前 build 和最新官方补丁\n- [ ] 核对攻略页来源，确认没有把“可能有效”写成“必然解决”\n- [ ] 根据原帖语境修改下面的英文草稿，删除不确定或重复内容\n- [ ] 手工发布，或者决定不回复；处理完成后关闭本 Issue\n\n#### 英文回复草稿（不能未经审核直接发布）\n\n\`\`\`text\n${entry.replyDraft}\n\`\`\``);
  const empty = "今天没有新的合格机会。候选问题仍保留在审核队列中，系统不会自动发帖、评论、投票或私信。";
  return `# Reddit 流量机会人工审核\n\n生成时间：${report.generatedAt}\n\n本报告只生成候选回复，不会自动操作 Reddit。发布前必须打开原帖，并重新核对当前游戏版本和证据。\n\n| 排名 | 机会分 | 评论数 | Reddit 问题 | 匹配攻略 | 匹配度 |\n| ---: | ---: | ---: | --- | --- | ---: |\n${rows.length ? rows.join("\n") : `| — | — | — | ${empty} | — | — |`}\n\n## 待审核回复\n\n${drafts.length ? drafts.join("\n\n") : empty}\n`;
}
