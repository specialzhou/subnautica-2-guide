const locales = ["en", "zh-cn", "ru"];
const resolutions = new Set(["solved", "partial", "open"]);
const evidenceTypes = new Set(["official", "wiki-revision", "in-game", "community"]);

export function createReviewTemplate(candidate, reviewedAt = new Date().toISOString().slice(0, 10)) {
  return {
    schemaVersion: "1.0.0",
    redditId: candidate.redditId,
    decision: "promote",
    review: {
      reviewedAt,
      reviewedBy: "",
      duplicateDisposition: candidate.possibleDuplicateOf ? "" : "not-duplicate",
      notes: "",
    },
    question: {
      id: "",
      featuredRank: null,
      category: "",
      buildContext: "",
      resolution: "",
      verification: "",
      question: { en: candidate.title, "zh-cn": "", ru: "" },
      answer: { en: "", "zh-cn": "", ru: "" },
      evidenceNote: { en: "", "zh-cn": "", ru: "" },
      searchTerms: { en: "", "zh-cn": "", ru: "" },
      relatedPages: [],
      evidenceSources: [{ type: "", label: "", url: "" }],
      attention: {
        observedAt: reviewedAt,
        upvotes: null,
        comments: candidate.attention?.comments ?? null,
        approximate: true,
      },
    },
  };
}

export function validateReview({ review, candidate, publishedQuestions }) {
  const failures = [];
  const question = review?.question ?? {};
  if (review?.schemaVersion !== "1.0.0") failures.push("Review schemaVersion must be 1.0.0");
  if (review?.decision !== "promote") failures.push("Review decision must be promote");
  if (!candidate) failures.push(`Candidate not found: ${review?.redditId ?? "unknown"}`);
  if (candidate?.review?.state === "dismissed") failures.push("Dismissed candidates cannot be promoted");
  if (!review?.review?.reviewedBy?.trim()) failures.push("review.reviewedBy is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review?.review?.reviewedAt ?? "")) failures.push("review.reviewedAt must be YYYY-MM-DD");
  if (candidate?.possibleDuplicateOf && review?.review?.duplicateDisposition !== "distinct") failures.push(`Possible duplicate of ${candidate.possibleDuplicateOf.id}; set duplicateDisposition to distinct only after review`);
  if (!/^[a-z0-9-]+$/.test(question.id ?? "")) failures.push("question.id must be a lowercase slug");
  if (publishedQuestions.some((entry) => entry.id === question.id)) failures.push(`Published question id already exists: ${question.id}`);
  if (!/^[a-z0-9-]+$/.test(question.category ?? "")) failures.push("question.category must be a lowercase slug");
  if (!question.buildContext?.trim()) failures.push("question.buildContext is required");
  if (!resolutions.has(question.resolution)) failures.push("question.resolution must be solved, partial, or open");
  if (!question.verification?.trim()) failures.push("question.verification is required");
  if (question.featuredRank !== null) failures.push("New questions must use featuredRank: null until homepage placement is reviewed separately");
  for (const field of ["question", "answer", "evidenceNote", "searchTerms"]) {
    for (const locale of locales) if (!question[field]?.[locale]?.trim()) failures.push(`question.${field}.${locale} is required`);
  }
  if (!Array.isArray(question.relatedPages)) failures.push("question.relatedPages must be an array");
  if (!Array.isArray(question.evidenceSources) || !question.evidenceSources.length) failures.push("At least one evidence source is required");
  for (const [index, source] of (question.evidenceSources ?? []).entries()) {
    if (!evidenceTypes.has(source.type)) failures.push(`Invalid evidence source type at index ${index}`);
    if (!source.label?.trim()) failures.push(`Evidence source label is required at index ${index}`);
    if (!/^https:\/\//.test(source.url ?? "")) failures.push(`Evidence source URL must use HTTPS at index ${index}`);
  }
  const attention = question.attention ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attention.observedAt ?? "")) failures.push("question.attention.observedAt must be YYYY-MM-DD");
  if (!Number.isInteger(attention.upvotes) || attention.upvotes < 0) failures.push("question.attention.upvotes must be a manually observed non-negative integer");
  if (!Number.isInteger(attention.comments) || attention.comments < 0) failures.push("question.attention.comments must be a non-negative integer");
  return failures;
}

export function buildPublishedQuestion(review, candidate) {
  const question = review.question;
  return {
    id: question.id,
    featuredRank: null,
    category: question.category,
    buildContext: question.buildContext,
    resolution: question.resolution,
    verification: question.verification,
    question: question.question,
    answer: question.answer,
    evidenceNote: question.evidenceNote,
    searchTerms: question.searchTerms,
    relatedPages: question.relatedPages,
    evidenceSources: question.evidenceSources,
    ...(candidate.relatedSources?.length ? { additionalSources: candidate.relatedSources.map(({ title, url }) => ({ title, url })) } : {}),
    source: {
      platform: "Reddit",
      subreddit: "r/Subnautica_2",
      title: candidate.title,
      url: candidate.url,
      observedAt: question.attention.observedAt,
      upvotes: question.attention.upvotes,
      comments: question.attention.comments,
      approximate: question.attention.approximate !== false,
    },
  };
}
