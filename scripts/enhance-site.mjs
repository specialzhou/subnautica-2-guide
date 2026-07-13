import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "/subnautica-2-guide/";
const items = JSON.parse(await readFile(path.join(root, "data/wiki-items.json"), "utf8"));
const entities = JSON.parse(await readFile(path.join(root, "data/wiki-entities.json"), "utf8"));
const media = JSON.parse(await readFile(path.join(root, "data/media.json"), "utf8"));
const imageByPage = new Map(media.images.map((image) => [image.page, image]));
for (const item of items.items) {
  if (item.media) imageByPage.set(`guide/items/${item.id}.html`, { ...item.media, title: item.title });
}
for (const entity of entities.entities) {
  if (entity.media) imageByPage.set(`guide/${entity.kind}/${entity.id}.html`, { ...entity.media, title: entity.title });
}

const guides = [
  ["Start here", "Guide", "starter-planner.html", "Starter crafting planner Scanner oxygen tank fins repair tool"],
  ["Find starter materials", "Guide", "starter-materials.html", "Copper Quartz Silver Sulfur material locations"],
  ["Blueprint checklist", "Guide", "blueprints.html", "fragments unlock blueprints"],
  ["Equipment upgrades", "Guide", "equipment-upgrades.html", "oxygen equipment upgrade"],
  ["Tadpole vehicle planner", "Guide", "vehicle-planner.html", "vehicle depth module chassis"],
  ["Key locations", "Guide", "locations.html", "biomes points of interest locations"],
  ["Base building", "Guide", "base-building.html", "Habitat Builder base modules"],
  ["Co-op reference", "Guide", "coop.html", "multiplayer players co-op"],
].map(([title, type, href, terms]) => ({ title, type, href, terms }));

const searchItems = items.items.filter((item) => item.status === "wiki-backed").map((item) => ({
  title: item.title,
  type: "Item",
  href: `guide/items/${item.id}.html`,
  terms: [item.title, ...item.recipes.flatMap((recipe) => [recipe.station, ...recipe.ingredients.map((ingredient) => ingredient.item)]), item.unlock?.source, ...(item.unlock?.biomes ?? [])].filter(Boolean).join(" "),
}));
const searchEntities = entities.entities.filter((entity) => entity.status === "wiki-backed").map((entity) => ({
  title: entity.title,
  type: entity.kind === "resources" ? "Resource" : entity.kind === "creatures" ? "Creature" : entity.kind === "vehicles" ? "Vehicle" : "Biome",
  href: `guide/${entity.kind}/${entity.id}.html`,
  terms: [entity.title, ...Object.values(entity.facts).flat()].filter(Boolean).join(" "),
}));
const imageByTitle = new Map([
  ...media.images.map((image) => [image.title, image.url]),
  ...items.items.filter((item) => item.media).map((item) => [item.title, item.media.url]),
  ...entities.entities.filter((entity) => entity.media).map((entity) => [entity.title, entity.media.url]),
]);
const index = [...guides, ...searchItems, ...searchEntities].map((entry) => ({ ...entry, image: imageByTitle.get(entry.title) ?? null }));
const generatedAt = new Date(Math.max(new Date(items.generatedAt).getTime(), new Date(entities.generatedAt).getTime())).toISOString();
const coverage = {
  total: items.publishedCount + entities.publishedCount,
  crafting: items.publishedCount,
  resources: entities.counts.resources,
  creatures: entities.counts.creatures,
  biomes: entities.counts.biomes,
};
await writeFile(path.join(root, "data/search-index.json"), `${JSON.stringify({ generatedAt, count: index.length, entries: index }, null, 2)}\n`);

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const pagePaths = [...sitemap.matchAll(/<loc>https:\/\/specialzhou\.github\.io\/subnautica-2-guide\/([^<]*)<\/loc>/g)].map((match) => {
  const value = match[1];
  if (!value) return "index.html";
  return value.endsWith("/") ? `${value}index.html` : value;
});
const mediaFigure = (image, locale) => {
  const text = locale === "zh-cn"
    ? { alt: `${image.title} 的 Subnautica 2 Wiki 图片`, image: "Wiki 图片", source: "原始文件", boundary: "非实机验证截图" }
    : locale === "ru"
      ? { alt: `${image.title}: изображение из Subnautica 2 Wiki`, image: "Изображение Wiki", source: "исходный файл", boundary: "не снимок игровой проверки" }
      : { alt: `${image.title} image from the Subnautica 2 Wiki`, image: "Wiki image", source: "source file", boundary: "not an in-game verification capture" };
  return `<figure class="record-media"><a href="${image.filePage}" rel="noopener noreferrer"><img src="${image.url}" width="${image.width}" height="${image.height}" loading="lazy" alt="${text.alt}"></a><figcaption>${text.image} · <a href="${image.filePage}" rel="noopener noreferrer">${text.source}</a> · <a href="${media.license.url}" rel="license">${media.license.name}</a> · ${text.boundary}</figcaption></figure>`;
};
const mediaUnavailable = (locale) => {
  const text = locale === "zh-cn" ? "暂无可用的 Wiki 图片" : locale === "ru" ? "В Wiki нет доступного изображения" : "No Wiki image is available";
  return `<div class="record-media record-media--empty" data-image-status="unavailable"><span>${text}</span></div>`;
};

for (const pagePath of [...new Set(pagePaths)]) {
  const filePath = path.join(root, pagePath);
  let html = await readFile(filePath, "utf8");
  html = html
    .replace(`<link rel="stylesheet" href="${base}search.css">`, "")
    .replace(`<script defer src="${base}search.js"></script>`, "")
    .replace(/<button class="global-search-trigger"[^>]*>.*?<\/button>/, "")
    .replace(/<(figure|div) class="record-media[^"]*"[^>]*>.*?<\/\1>/s, "");
  html = html.replace("</head>", `<link rel="stylesheet" href="${base}search.css"></head>`);
  html = html.replace("</nav>", `<button class="global-search-trigger" type="button" aria-label="Search this guide"><span aria-hidden="true">⌕</span><span>Search</span><kbd>/</kbd></button></nav>`);
  const unlocalizedPath = pagePath.replace(/^(en|zh-cn|ru)\//, "");
  if (unlocalizedPath === "index.html") {
    html = html.replace(/(<div class="notice"[^>]*><div class="shell notice__inner"><span[^>]*><\/span>)\d+/, `$1${coverage.total}`);
    html = html.replace(/(<dd id="wiki-count">)\d+/, `$1${coverage.total}`);
    for (const [href, count] of [["crafting.html", coverage.crafting], ["resources.html", coverage.resources], ["creatures.html", coverage.creatures], ["biomes.html", coverage.biomes]]) {
      html = html.replace(new RegExp(`(<a href="${href}"><span>)\\d+`), `$1${count}`);
    }
  }
  const image = imageByPage.get(unlocalizedPath);
  const locale = pagePath.match(/^(en|zh-cn|ru)\//)?.[1] ?? "en";
  if (/<article class="entity-hero">/.test(html)) html = html.replace(/(<article class="entity-hero">.*?<p class="lede">.*?<\/p>)/s, `$1${image ? mediaFigure(image, locale) : mediaUnavailable(locale)}`);
  html = html.replace("</body>", `<script defer src="${base}search.js"></script></body>`);
  await writeFile(filePath, html);
}

process.stdout.write(`Enhanced ${new Set(pagePaths).size} pages and indexed ${index.length} records.\n`);
