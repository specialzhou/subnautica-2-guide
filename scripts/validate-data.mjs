import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(path.join(root, "data", "wiki-items.json"), "utf8"));
const entityData = JSON.parse(await readFile(path.join(root, "data", "wiki-entities.json"), "utf8"));
const ledger = JSON.parse(await readFile(path.join(root, "data", "ledger.json"), "utf8"));
const changeReport = JSON.parse(await readFile(path.join(root, "data", "wiki-change-report.json"), "utf8"));
const storyData = JSON.parse(await readFile(path.join(root, "data", "wiki-story.json"), "utf8"));
const playerQuestions = JSON.parse(await readFile(path.join(root, "data", "player-questions.json"), "utf8"));
const playerQuestionCandidates = JSON.parse(await readFile(path.join(root, "data", "player-question-candidates.json"), "utf8"));
const playerQuestionCandidateReport = await readFile(path.join(root, "data", "player-question-candidates.md"), "utf8");
const failures = [];
if (!changeReport.changes.length || changeReport.changes.some((change) => change.change !== "removed" && !change.revisionId)) failures.push("Wiki change report is invalid");
const ids = new Set();
const byTitle = new Map(data.items.map((item) => [item.title, item]));

for (const item of data.items) {
  if (ids.has(item.id)) failures.push(`Duplicate id: ${item.id}`);
  ids.add(item.id);
  if (!item.source.revisionId || !item.source.permanentUrl) failures.push(`Missing provenance: ${item.title}`);
  if (item.media && (!item.media.url?.startsWith("https://wiki.subnautica.com/") || !item.media.filePage?.startsWith("https://wiki.subnautica.com/") || !item.media.width || !item.media.height)) failures.push(`Invalid item media: ${item.title}`);
  if (!item.recipes.length) failures.push(`Missing recipe: ${item.title}`);
  if (!item.unlock || !Object.hasOwn(item.unlock, "fragments")) failures.push(`Missing unlock schema: ${item.title}`);
  for (const recipe of item.recipes) {
    if (!recipe.station) failures.push(`Missing station: ${item.title}`);
    for (const ingredient of recipe.ingredients) {
      if (!ingredient.item || !ingredient.count) failures.push(`Invalid ingredient: ${item.title}`);
    }
  }
  if (item.status === "wiki-backed") {
    await access(path.join(root, "guide", "items", `${item.id}.html`)).catch(() => failures.push(`Missing generated page: ${item.id}`));
  }
}

if (data.publishedCount !== data.items.filter((item) => item.status === "wiki-backed").length) failures.push("Published count mismatch");
if (data.excludedCount !== data.items.filter((item) => item.status === "excluded").length) failures.push("Excluded count mismatch");
if (data.imageCount !== data.items.filter((item) => item.status === "wiki-backed" && item.media).length) failures.push("Item image count mismatch");

const expectedRecipes = [
  ["Basic Battery", "Fabricator", [["Copper", "2"], ["Acidic Raion Pouch", "1"]]],
  ["Scanner", "Fabricator", [["Titanium", "2"], ["Quartz", "2"], ["Basic Battery", "1"]]],
  ["Standard Air Tank", "Fabricator", [["Titanium", "2"], ["Rubber", "1"], ["Silver", "2"]]],
  ["Habitat Builder", "Fabricator", [["Titanium", "2"], ["Glass", "1"], ["Basic Battery", "1"], ["Copper Wire", "1"]]],
];
for (const [title, station, ingredients] of expectedRecipes) {
  const item = byTitle.get(title);
  if (!item) { failures.push(`Golden record missing: ${title}`); continue; }
  const recipe = item.recipes.find((candidate) => candidate.station === station);
  const actual = recipe?.ingredients.map((ingredient) => [ingredient.item, ingredient.count]);
  if (JSON.stringify(actual) !== JSON.stringify(ingredients)) failures.push(`Golden recipe mismatch: ${title}`);
}

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const questionIds = new Set();
const featuredRanks = new Set();
for (const question of playerQuestions.questions) {
  if (questionIds.has(question.id)) failures.push(`Duplicate player question id: ${question.id}`);
  questionIds.add(question.id);
  if (!/^[a-z0-9-]+$/.test(question.id)) failures.push(`Invalid player question id: ${question.id}`);
  if (!question.source?.url?.startsWith("https://www.reddit.com/") || !Number.isInteger(question.source.upvotes) || !Number.isInteger(question.source.comments)) failures.push(`Invalid player question source: ${question.id}`);
  if (!question.source.observedAt || !question.buildContext || !["solved", "partial", "open"].includes(question.resolution)) failures.push(`Incomplete player question status: ${question.id}`);
  for (const locale of ["en", "zh-cn", "ru"]) {
    if (!question.question?.[locale] || !question.answer?.[locale] || !question.evidenceNote?.[locale] || !question.searchTerms?.[locale]) failures.push(`Missing ${locale} player question copy: ${question.id}`);
  }
  if (question.featuredRank !== null) {
    if (!Number.isInteger(question.featuredRank) || featuredRanks.has(question.featuredRank)) failures.push(`Invalid featured rank: ${question.id}`);
    featuredRanks.add(question.featuredRank);
  }
}
if (playerQuestions.questions.length < 8) failures.push("Player question library is too small");
if (featuredRanks.size < 4) failures.push("Homepage needs at least four featured player questions");
if (!sitemap.includes("/questions.html")) failures.push("Sitemap missing player question library");
if (playerQuestionCandidates.collectionPolicy?.storesPostBody !== false) failures.push("Player question candidate collector must not store Reddit post bodies");
const publishedRedditIds = new Set(playerQuestions.questions.map((question) => question.source.url.match(/\/comments\/([^/]+)/)?.[1]).filter(Boolean));
const candidateIds = new Set();
for (const candidate of playerQuestionCandidates.candidates ?? []) {
  if (!candidate.redditId || candidateIds.has(candidate.redditId)) failures.push(`Invalid or duplicate player question candidate: ${candidate.redditId}`);
  candidateIds.add(candidate.redditId);
  if (publishedRedditIds.has(candidate.redditId)) failures.push(`Published Reddit question remains in candidate queue: ${candidate.redditId}`);
  if (!candidate.url?.startsWith("https://www.reddit.com/r/Subnautica_2/comments/") || !candidate.title || !Number.isInteger(candidate.painScore)) failures.push(`Incomplete player question candidate: ${candidate.redditId}`);
  if (!candidate.review?.state || candidate.attention?.upvotes !== null) failures.push(`Candidate review or RSS attention boundary missing: ${candidate.redditId}`);
  if (Object.hasOwn(candidate, "body") || Object.hasOwn(candidate, "bodyText") || Object.hasOwn(candidate, "content")) failures.push(`Reddit post body was stored for candidate: ${candidate.redditId}`);
  if (!playerQuestionCandidateReport.includes(`](${candidate.url})`)) failures.push(`Candidate review report is missing: ${candidate.redditId}`);
}
for (const locale of ["", "en", "zh-cn", "ru"]) {
  const relative = locale ? path.join(locale, "questions.html") : "questions.html";
  const html = await readFile(path.join(root, relative), "utf8").catch(() => "");
  if (!html) failures.push(`Missing player question page: ${relative}`);
  for (const question of playerQuestions.questions) if (html && !html.includes(`id="${question.id}"`)) failures.push(`Player question page missing ${question.id}: ${relative}`);
}
for (const item of data.items.filter((entry) => entry.status === "wiki-backed")) {
  if (!sitemap.includes(`/guide/items/${item.id}.html`)) failures.push(`Sitemap missing page: ${item.id}`);
}

const entityIds = new Set();
for (const entity of entityData.entities) {
  const scopedId = `${entity.kind}:${entity.id}`;
  if (entityIds.has(scopedId)) failures.push(`Duplicate entity id: ${scopedId}`);
  entityIds.add(scopedId);
  if (!entity.source.revisionId || !entity.source.permanentUrl) failures.push(`Missing entity provenance: ${entity.title}`);
  if (entity.media && (!entity.media.url?.startsWith("https://wiki.subnautica.com/") || !entity.media.filePage?.startsWith("https://wiki.subnautica.com/") || !entity.media.width || !entity.media.height)) failures.push(`Invalid entity media: ${entity.title}`);
  if (entity.status === "wiki-backed") {
    await access(path.join(root, "guide", entity.kind, `${entity.id}.html`)).catch(() => failures.push(`Missing entity page: ${scopedId}`));
    if (!sitemap.includes(`/guide/${entity.kind}/${entity.id}.html`)) failures.push(`Sitemap missing entity: ${scopedId}`);
  }
}
if (entityData.publishedCount !== entityData.entities.filter((entity) => entity.status === "wiki-backed").length) failures.push("Entity published count mismatch");
if (entityData.excludedCount !== entityData.entities.filter((entity) => entity.status === "excluded").length) failures.push("Entity excluded count mismatch");
if (entityData.imageCount !== entityData.entities.filter((entity) => entity.status === "wiki-backed" && entity.media).length) failures.push("Entity image count mismatch");
for (const [kind, count] of Object.entries(entityData.counts)) {
  if (count !== entityData.entities.filter((entity) => entity.kind === kind && entity.status === "wiki-backed").length) failures.push(`Entity kind count mismatch: ${kind}`);
}

const entityByKey = new Map(entityData.entities.map((entity) => [`${entity.kind}:${entity.title}`, entity]));
const copper = entityByKey.get("resources:Copper");
if (!copper?.facts.biomes.includes("Shallows") || copper.facts.group !== "Raw Materials") failures.push("Golden entity mismatch: Copper");
const halfmoon = entityByKey.get("creatures:Halfmoon");
if (halfmoon?.facts.attitude !== "Passive" || !halfmoon.facts.biomes.includes("Coral Gardens")) failures.push("Golden entity mismatch: Halfmoon");
const tadpole = entityByKey.get("vehicles:Tadpole");
if (tadpole?.facts.speed !== "8m/s" || !tadpole.facts.depth.includes("250m")) failures.push("Golden entity mismatch: Tadpole");
const shallows = entityByKey.get("biomes:Shallows");
if (!shallows?.facts.depth.includes("224m")) failures.push("Golden entity mismatch: Shallows");

if (ledger.tracker.wikiBackedEntries !== data.publishedCount + entityData.publishedCount) failures.push("Ledger wiki-backed count mismatch");
const publishedFiles = ["index.html", "questions.html", "starter-planner.html", "starter-materials.html", "equipment-upgrades.html", "blueprints.html", "vehicle-planner.html", "locations.html", "story.html", "crafting.html", "oxygen.html", "base-building.html", "coop.html", "resources.html", "creatures.html", "vehicles.html", "biomes.html", "sources.html"];
for (const file of publishedFiles) {
  const html = await readFile(path.join(root, file), "utf8");
  if (html.includes("3026940")) failures.push(`Wrong Steam App ID in ${file}`);
}
const oxygenHtml = await readFile(path.join(root, "oxygen.html"), "utf8");
for (const title of ["Air Bladder", "High Capacity Air Tank", "Portable Oxygen Generator", "Rebreather", "Standard Air Tank", "Ultra High Capacity Air Tank"]) {
  if (!oxygenHtml.includes(title)) failures.push(`Oxygen topic missing: ${title}`);
}
const baseHtml = await readFile(path.join(root, "base-building.html"), "utf8");
if (!baseHtml.includes("Habitat Builder") || !baseHtml.includes("rev ")) failures.push("Base-building topic lacks structured source records");
const officialFacts = JSON.parse(await readFile(path.join(root, "data", "official-facts.json"), "utf8"));
const coopHtml = await readFile(path.join(root, "coop.html"), "utf8");
if (officialFacts.status !== "official-backed" || officialFacts.facts.length !== 4) failures.push("Co-op official facts dataset mismatch");
if (officialFacts.publicBuild?.id !== "23446003" || officialFacts.publicBuild?.branch !== "public") failures.push("Steam public build metadata mismatch");
for (const expected of ["Up to 4 players", "Optional online co-op", "Cross-Platform Multiplayer", "Still requires in-game verification"]) {
  if (!coopHtml.includes(expected)) failures.push(`Co-op page missing: ${expected}`);
}
if (!sitemap.includes("/coop.html")) failures.push("Sitemap missing co-op page");
if (ledger.tracker.withdrawnPages !== 0) failures.push("Ledger still reports withdrawn pages");
if (ledger.tracker.gameBuild !== "23446003 (Steam public)" || ledger.tracker.gameBuildEvidence?.status !== "metadata-only") failures.push("Ledger build evidence mismatch");
const plannerHtml = await readFile(path.join(root, "starter-planner.html"), "utf8");
for (const expected of ["Scanner", "Standard Air Tank", "Basic Fins", "Habitat Builder", "Repair Tool", "Recipe dependency graph", "Raw material total"]) {
  if (!plannerHtml.includes(expected)) failures.push(`Starter planner missing: ${expected}`);
}
if (/×\d+\.\d+/.test(plannerHtml)) failures.push("Starter planner contains fractional material amounts");
if (!sitemap.includes("/starter-planner.html")) failures.push("Sitemap missing starter planner");
const materialsHtml = await readFile(path.join(root, "starter-materials.html"), "utf8");
for (const expected of ["Acidic Raion Pouch", "Copper", "Fibrous Pulp", "Lucifer Rotsac", "Metal Salvage", "Quartz", "Silver", "Sulfur", "Not recorded"]) {
  if (!materialsHtml.includes(expected)) failures.push(`Starter materials missing: ${expected}`);
}
if (!sitemap.includes("/starter-materials.html")) failures.push("Sitemap missing starter materials");
const upgradesHtml = await readFile(path.join(root, "equipment-upgrades.html"), "utf8");
for (const expected of ["Standard Air Tank", "High Capacity Air Tank", "Ultra High Capacity Air Tank", "Basic Fins", "Improved Fins", "Scanner", "Bioscanner", "Dependency is proven; unlock timing is not"]) {
  if (!upgradesHtml.includes(expected)) failures.push(`Equipment upgrades missing: ${expected}`);
}
if (upgradesHtml.includes("No direct predecessor in recipe")) failures.push("Equipment upgrade chain lacks a direct recipe dependency");
if (!sitemap.includes("/equipment-upgrades.html")) failures.push("Sitemap missing equipment upgrades");
const blueprintsHtml = await readFile(path.join(root, "blueprints.html"), "utf8");
for (const expected of ["Blueprint", "Fragments", "Available by default", "Habitat Builder", "Coral Gardens", "complete story progression"]) {
  if (!blueprintsHtml.includes(expected)) failures.push(`Blueprint checklist missing: ${expected}`);
}
if (!sitemap.includes("/blueprints.html")) failures.push("Sitemap missing blueprints checklist");
const vehiclePlannerHtml = await readFile(path.join(root, "vehicle-planner.html"), "utf8");
for (const expected of ["Moonpool", "Vehicle Fabricator", "Tadpole Dock", "Tadpole Haul Chassis", "Tadpole Scout Ray Chassis", "250m", "450m", "800m", "not a claimed unlock order"]) {
  if (!vehiclePlannerHtml.includes(expected)) failures.push(`Vehicle planner missing: ${expected}`);
}
if (!sitemap.includes("/vehicle-planner.html")) failures.push("Sitemap missing vehicle planner");
const locationsHtml = await readFile(path.join(root, "locations.html"), "utf8");
for (const expected of ["Lifepod", "Welcome Center", "Control Room", "Hot Cave Basecamp", "Names and biome depth are not coordinates"]) {
  if (!locationsHtml.includes(expected)) failures.push(`Locations index missing: ${expected}`);
}
if (locationsHtml.includes("&amp;ndash;")) failures.push("Locations index contains undecoded depth entities");
if (!locationsHtml.includes('class="location-thumb"') || !locationsHtml.includes('loading="lazy"')) failures.push("Locations index lacks Wiki thumbnails");
if (!sitemap.includes("/locations.html")) failures.push("Sitemap missing locations index");
const storyHtml = await readFile(path.join(root, "story.html"), "utf8");
if (storyData.pages.length !== 12 || !storyData.pages.every((page) => page.revisionId && page.permanentUrl)) failures.push("Story dataset provenance mismatch");
for (const expected of ["Arrival", "Tensions Rise", "The Chase", "Sleep Bay 3", "Story background is not gameplay order"]) {
  if (!storyHtml.includes(expected)) failures.push(`Story index missing: ${expected}`);
}
if (!sitemap.includes("/story.html")) failures.push("Sitemap missing story index");
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${data.items.length} recipes and ${entityData.entities.length} entities with provenance.\n`);
}
