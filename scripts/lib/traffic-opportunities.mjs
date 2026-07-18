const guideBaseUrl = "https://specialzhou.github.io/subnautica-2-guide/en/questions";

const normalizeRedditId = (url = "") => String(url).match(/\/comments\/([^/]+)/)?.[1] ?? "";
const round = (value) => Number(value.toFixed(2));

export function opportunityScore(candidate) {
  const comments = candidate.attention?.comments ?? 0;
  const duplicateScore = candidate.possibleDuplicateOf?.score ?? 0;
  return round(candidate.painScore + Math.min(comments, 20) + duplicateScore * 10);
}

export function buildTrafficOpportunities({ candidates, questions, generatedAt, limit = 3 }) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const ranked = [];

  for (const candidate of candidates) {
    if (candidate.review?.state !== "needs-review") continue;
    const match = candidate.possibleDuplicateOf;
    if (!match || match.score < 0.55) continue;
    const question = questionById.get(match.id);
    if (!question || question.resolution !== "solved") continue;
    if (normalizeRedditId(question.source?.url) === candidate.redditId) continue;
    ranked.push({ candidate, question, matchScore: match.score, score: opportunityScore(candidate) });
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

const escapeMarkdown = (value) => String(value ?? "—")
  .replaceAll("\\", "\\\\")
  .replaceAll("[", "\\[")
  .replaceAll("]", "\\]")
  .replaceAll("|", "\\|")
  .replace(/\s+/g, " ")
  .trim();

export function renderTrafficOpportunityIssue(report) {
  const rows = report.opportunities.map((entry, index) => `| ${index + 1} | ${entry.opportunityScore} | ${entry.comments ?? "?"} | [${escapeMarkdown(entry.title)}](${entry.redditUrl}) | [${entry.guideId}](${entry.guideUrl}) | ${entry.matchScore} |`);
  const drafts = report.opportunities.map((entry, index) => `### ${index + 1}. ${escapeMarkdown(entry.title)}\n\nTarget: ${entry.redditUrl}\n\nBuild: ${entry.buildContext} · Verification: ${entry.verification}\n\n\`\`\`text\n${entry.replyDraft}\n\`\`\``);
  const empty = "No safe matches today. Candidates remain in the review queue; nothing should be posted automatically.";
  return `# Daily traffic opportunities\n\nGenerated: ${report.generatedAt}\n\nThis report prepares value-first Reddit replies. It never posts, votes, or messages automatically. Verify the live thread and current game build before publishing.\n\n| Rank | Score | Comments | Reddit question | Matching guide | Match |\n| ---: | ---: | ---: | --- | --- | ---: |\n${rows.length ? rows.join("\n") : `| — | — | — | ${empty} | — | — |`}\n\n## Reply drafts\n\n${drafts.length ? drafts.join("\n\n") : empty}\n`;
}
