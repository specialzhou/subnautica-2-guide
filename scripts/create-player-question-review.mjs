import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReviewTemplate } from "./lib/player-question-promotion.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.length ? value.join("=") : true];
}));
const redditId = String(args.get("reddit-id") || "");
if (!redditId) throw new Error("Usage: npm run review:question -- --reddit-id=<id>");
const candidates = JSON.parse(await readFile(path.join(root, "data/player-question-candidates.json"), "utf8"));
const candidate = candidates.candidates.find((entry) => entry.redditId === redditId);
if (!candidate) throw new Error(`Candidate not found: ${redditId}`);
const output = path.resolve(root, String(args.get("output") || `data/player-question-reviews/${redditId}.json`));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(createReviewTemplate(candidate), null, 2)}\n`, { flag: args.has("force") ? "w" : "wx" });
process.stdout.write(`Created review template: ${path.relative(root, output)}\n`);
