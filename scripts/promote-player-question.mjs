import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPublishedQuestion, validateReview } from "./lib/player-question-promotion.mjs";
import { renderCandidateReport } from "./lib/player-question-collector.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.length ? value.join("=") : true];
}));
const reviewPath = path.resolve(root, String(args.get("review") || ""));
if (!args.get("review")) throw new Error("Usage: npm run promote:question -- --review=data/player-question-reviews/<reddit-id>.json");
const candidatesPath = path.join(root, "data/player-question-candidates.json");
const candidateReportPath = path.join(root, "data/player-question-candidates.md");
const publishedPath = path.join(root, "data/player-questions.json");
const [reviewText, originalCandidatesText, originalCandidateReport, originalPublishedText] = await Promise.all([
  readFile(reviewPath, "utf8"),
  readFile(candidatesPath, "utf8"),
  readFile(candidateReportPath, "utf8"),
  readFile(publishedPath, "utf8"),
]);
const review = JSON.parse(reviewText);
const candidates = JSON.parse(originalCandidatesText);
const published = JSON.parse(originalPublishedText);
const candidate = candidates.candidates.find((entry) => entry.redditId === review.redditId);
const failures = validateReview({ review, candidate, publishedQuestions: published.questions });
for (const relatedPage of review.question?.relatedPages ?? []) {
  await access(path.join(root, relatedPage)).catch(() => failures.push(`Related page does not exist: ${relatedPage}`));
}
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
const promoted = buildPublishedQuestion(review, candidate);
published.questions.push(promoted);
published.collectedAt = new Date(Math.max(new Date(published.collectedAt).getTime(), new Date(`${review.review.reviewedAt}T00:00:00.000Z`).getTime())).toISOString();
candidates.candidates = candidates.candidates.filter((entry) => entry.redditId !== review.redditId);
candidates.counts.total = candidates.candidates.length;
candidates.counts.systemReview = candidates.candidates.filter((entry) => entry.review?.state === "system-review").length;
candidates.counts.readyToReply = candidates.candidates.filter((entry) => entry.review?.state === "ready-to-reply").length;
candidates.counts.dismissed = candidates.candidates.filter((entry) => entry.review?.state === "dismissed").length;
await Promise.all([
  writeFile(publishedPath, `${JSON.stringify(published, null, 2)}\n`),
  writeFile(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`),
  writeFile(candidateReportPath, renderCandidateReport(candidates)),
]);
process.stdout.write(`Promoted ${review.redditId} as ${promoted.id}.\n`);
if (!args.has("data-only")) {
  for (const script of ["questions", "validate"]) {
    const result = spawnSync("npm", ["run", script], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) {
      await Promise.all([
        writeFile(publishedPath, originalPublishedText),
        writeFile(candidatesPath, originalCandidatesText),
        writeFile(candidateReportPath, originalCandidateReport),
      ]);
      spawnSync("npm", ["run", "questions"], { cwd: root, stdio: "inherit" });
      process.stderr.write(`Promotion rolled back after ${script} failed.\n`);
      process.exit(result.status ?? 1);
    }
  }
}
const archivedReview = { ...review, promotion: { publishedId: promoted.id, promotedAt: new Date().toISOString() } };
const archivePath = path.join(root, "data/player-question-reviews/promoted", `${review.redditId}.json`);
await mkdir(path.dirname(archivePath), { recursive: true });
await writeFile(archivePath, `${JSON.stringify(archivedReview, null, 2)}\n`);
if (reviewPath !== archivePath) await rm(reviewPath);
