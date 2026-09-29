import fs from "node:fs";
import path from "node:path";
import { matchSiteIndexDetailed } from "./player-question-collector.mjs";

/**
 * Automated evidence review for Reddit question candidates.
 *
 * Why this exists: `traffic-opportunities.mjs` only turns a candidate into a
 * reply draft when `review.state === "ready-to-reply"`, and until now nothing in
 * the repo ever set that state automatically. Every candidate was born in
 * `system-review` and stayed there, so the Reddit funnel silently produced zero
 * opportunities from 2026-08-09 onward while CI kept reporting success.
 *
 * Safety invariant: this reviewer only ever advances `system-review` ->
 * `ready-to-reply`, and only revokes a state it granted itself (`autoReviewed`).
 * A state a human wrote is never touched, so running this cannot destroy manual
 * triage.
 */
export const defaultEvidencePolicy = {
  // Topical match must be carried by more than one generic word.
  minTokenHits: 2,
  minMatchScore: 0.5,
  requireTitleOverlap: true,
  // Drafts ship in three locales, so the target page must exist in all three.
  requireTrilingual: true,
  locales: ["zh-cn", "ru"],
  // The whole premise of the site is that facts link out to a source.
  requireExternalSource: true,
  externalSourcePattern: /https:\/\/(wiki\.subnautica\.com|unknownworlds\.com|www\.reddit\.com)\/[^\s"']*/,
};

/** Lazily reads and caches on-disk facts about pages referenced by the search index. */
export function createPageEvidenceIndex({ root, policy = defaultEvidencePolicy }) {
  const cache = new Map();
  return {
    lookup(href) {
      if (!href) return { exists: false, trilingual: false, citesExternalSource: false };
      if (cache.has(href)) return cache.get(href);
      const locales = policy.locales ?? [];
      let entry;
      try {
        const html = fs.readFileSync(path.join(root, href), "utf8");
        entry = {
          exists: true,
          trilingual: locales.every((locale) => fs.existsSync(path.join(root, locale, href))),
          citesExternalSource: policy.externalSourcePattern.test(html),
        };
      } catch {
        entry = { exists: false, trilingual: false, citesExternalSource: false };
      }
      cache.set(href, entry);
      return entry;
    },
  };
}

/**
 * Decides one candidate. Returns the review object to store plus a machine
 * readable reason list so a human can audit why the queue is (not) moving.
 */
export function reviewCandidateEvidence({ candidate, searchIndex, pageEvidence, policy = defaultEvidencePolicy }) {
  const merged = { ...defaultEvidencePolicy, ...policy };
  // Always match against the live index so a page that was renamed or dropped
  // since the candidate was first collected cannot keep an stale approval.
  const detailed = matchSiteIndexDetailed(candidate.title, searchIndex);
  const top = detailed.suggestedPages[0] ?? candidate.suggestedPages?.[0];
  if (!top) return { state: "system-review", answerStatus: "no-matched-page", reasons: ["no-matched-page"], page: null };

  const hits = top.hits ?? 0;
  const titleHits = top.titleHits ?? 0;
  const score = top.score ?? 0;
  const page = pageEvidence.lookup(top.href);

  const reasons = [];
  if (score < merged.minMatchScore) reasons.push("match-score-too-low");
  if (hits < merged.minTokenHits) reasons.push("too-few-shared-tokens");
  if (merged.requireTitleOverlap && !(titleHits > 0)) reasons.push("no-title-token-overlap");
  if (!page.exists) reasons.push("page-missing-on-disk");
  if (merged.requireTrilingual && !page.trilingual) reasons.push("locale-coverage-incomplete");
  if (merged.requireExternalSource && !page.citesExternalSource) reasons.push("page-cites-no-external-source");

  if (reasons.length) return { state: "system-review", answerStatus: "evidence-thin", reasons, page: top.href, hits, score };
  return { state: "ready-to-reply", answerStatus: "evidence-verified", reasons: ["evidence-verified"], page: top.href, hits, score };
}

/**
 * Applies the reviewer across a candidate document. Mutates `candidate.review`
 * in place and returns per-outcome counts for the step summary.
 */
export function applyEvidenceAutoReview({ document, searchIndex, pageEvidence, policy = defaultEvidencePolicy, now }) {
  const counts = { promoted: 0, revoked: 0, held: 0, skippedHuman: 0, alreadyReady: 0 };
  for (const candidate of document.candidates ?? []) {
    const prior = candidate.review ?? {};
    if (prior.state !== "system-review" && prior.state !== "ready-to-reply") {
      counts.skippedHuman += 1;
      continue;
    }
    if (prior.state === "ready-to-reply" && !prior.autoReviewed) {
      counts.skippedHuman += 1;
      continue;
    }
    const verdict = reviewCandidateEvidence({ candidate, searchIndex, pageEvidence, policy });
    if (prior.state === "system-review" && verdict.state === "ready-to-reply") {
      candidate.review = {
        state: "ready-to-reply",
        answerStatus: verdict.answerStatus,
        autoReviewed: true,
        reviewedAt: now,
        evidencePage: verdict.page,
        matchScore: verdict.score,
        tokenHits: verdict.hits,
        notes: `系统证据审核通过：命中 ${verdict.hits} 个共享词，匹配度 ${verdict.score}，目标页 ${verdict.page}。站长只需决定是否手工发布。`,
      };
      counts.promoted += 1;
      continue;
    }
    if (prior.state === "ready-to-reply" && verdict.state !== "ready-to-reply") {
      candidate.review = {
        state: "system-review",
        answerStatus: verdict.answerStatus,
        autoReviewed: false,
        reviewedAt: now,
        revokedAt: now,
        holdReasons: verdict.reasons,
        notes: `系统此前自动放行，现证据条件回退：${describeReasons(verdict.reasons)}。`,
      };
      counts.revoked += 1;
      continue;
    }
    if (prior.state === "ready-to-reply") {
      counts.alreadyReady += 1;
      continue;
    }
    candidate.review = {
      ...prior,
      state: "system-review",
      answerStatus: verdict.answerStatus,
      autoReviewed: false,
      reviewedAt: now,
      holdReasons: verdict.reasons,
      notes: `系统证据审核未通过：${describeReasons(verdict.reasons)}。`,
    };
    counts.held += 1;
  }
  return counts;
}

const HOLD_LABELS = {
  "no-matched-page": "站点索引里没有可匹配的页面",
  "match-score-too-low": "标题与目标页匹配度过低",
  "too-few-shared-tokens": "共享实词太少（可能只是通用词撞车）",
  "no-title-token-overlap": "目标页标题与问题无实词重叠",
  "page-missing-on-disk": "目标页文件缺失",
  "locale-coverage-incomplete": "三语版本不齐全",
  "page-cites-no-external-source": "目标页没有外链证据",
  "evidence-verified": "已通过系统证据审核",
  "evidence-thin": "证据条件未全部达标",
};

const describeReasons = (reasons = []) => reasons.map((reason) => `${HOLD_LABELS[reason] ?? reason}`).join("；");

/** Human-readable queue health block for GITHUB_STEP_SUMMARY and the .md report. */
export function renderEvidenceReviewSummary({ document, counts, policy = defaultEvidencePolicy }) {
  const candidates = document.candidates ?? [];
  const held = candidates.filter((candidate) => candidate.review?.state === "system-review");
  const reasonTally = new Map();
  for (const candidate of held) {
    const reasons = candidate.review?.holdReasons?.length ? candidate.review.holdReasons : [candidate.review?.answerStatus ?? "not-reviewed-yet"];
    for (const reason of reasons) reasonTally.set(reason, (reasonTally.get(reason) ?? 0) + 1);
  }
  const ready = candidates.filter((candidate) => candidate.review?.state === "ready-to-reply");
  const lines = [
    "## 候选证据审核",
    "",
    `- 队列总数：${candidates.length}`,
    `- 可生成回复草稿（ready-to-reply）：${ready.length}（本次自动放行 ${counts?.promoted ?? 0}，回退 ${counts?.revoked ?? 0}，人工保留 ${counts?.skippedHuman ?? 0}）`,
    `- 仍待审核（system-review）：${held.length}`,
    "",
  ];
  if (ready.length) {
    lines.push("本轮可出水的问题：", "");
    for (const candidate of ready.slice(0, 10)) {
      lines.push(`- ${candidate.sourceSubreddit ?? "—"} · [${candidate.title}](${candidate.url}) → \`${candidate.review?.evidencePage ?? "已发布攻略"}\``);
    }
    lines.push("");
  }
  if (reasonTally.size) {
    lines.push("卡住原因分布：", "");
    for (const [reason, total] of [...reasonTally].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${HOLD_LABELS[reason] ?? reason}：${total}`);
    }
    lines.push("");
  }
  const p = { ...defaultEvidencePolicy, ...policy };
  lines.push(
    `放行门槛：匹配度 ≥ ${p.minMatchScore} 且共享词 ≥ ${p.minTokenHits} 且标题词重叠` +
    `${p.requireTrilingual ? " 且三语页面齐全" : ""}${p.requireExternalSource ? " 且页面带外链证据" : ""}。`,
  );
  return `${lines.join("\n")}\n`;
}
