// 生成 guide/{items,resources,creatures,biomes,vehicles}/index.html 实体总览页。
// 两个动机：
// 1) llms.txt 和站内一直把这些目录 URL 当入口，但线上实际是 404（目录里没有 index.html）。
// 2) Google 目前只收录了 23 个页面，305 个实体页缺少一个可被抓取到的枢纽入口，
//    这 5 个页面同时承担「全部物品/全部生物」这类列表查询的着陆页。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "/subnautica-2-guide/";
const SITE = "https://specialzhou.github.io/subnautica-2-guide/";
const license = { name: "CC BY-NC-SA 3.0", url: "https://creativecommons.org/licenses/by-nc-sa/3.0/" };

const items = JSON.parse(await readFile(path.join(root, "data", "wiki-items.json"), "utf8"));
const entities = JSON.parse(await readFile(path.join(root, "data", "wiki-entities.json"), "utf8"));
const media = JSON.parse(await readFile(path.join(root, "data", "media.json"), "utf8"));

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 页面标题/导语放在这里，多语言整句由 scripts/seo-meta.mjs 的 corePageMeta 覆盖 head 元信息，
// 正文本身保持短句、避免字典替换产生中英混排词。
const kinds = {
  items: { heading: "All craftable items", intro: "Every item with a documented recipe, each linked to the record that lists its ingredients and station.", imagePage: "guide/items/scanner.html" },
  resources: { heading: "All resources", intro: "Raw materials, what produces them, and which crafted items consume them.", imagePage: "guide/resources/titanium.html" },
  creatures: { heading: "All creatures", intro: "Each creature with its recorded biome list, attitude toward the player, and nutrition value.", imagePage: "guide/creatures/blackthorn.html" },
  biomes: { heading: "All biomes", intro: "Mapped areas with their depth range and the points of interest recorded inside them.", imagePage: "guide/biomes/shallow-reds.html" },
  vehicles: { heading: "All vehicles", intro: "Craftable vehicles with speed, depth, health and the fragments needed to unlock them.", imagePage: "guide/vehicles/tadpole.html" },
};

const publishedItems = items.items.filter((item) => item.status === "wiki-backed").sort((a, b) => a.title.localeCompare(b.title));
const publishedEntities = entities.entities.filter((entity) => entity.status === "wiki-backed");
const imageByPage = new Map(media.images.map((image) => [image.page, image]));
for (const item of items.items) if (item.media) imageByPage.set(`guide/items/${item.id}.html`, { ...item.media, title: item.title });
for (const entity of entities.entities) if (entity.media) imageByPage.set(`guide/${entity.kind}/${entity.id}.html`, { ...entity.media, title: entity.title });

function rowsFor(kind) {
  if (kind === "items") {
    return publishedItems.map((item) => {
      const recipe = item.recipes[0];
      const station = recipe?.station && recipe.station !== "Unknown" ? recipe.station : "Not stated";
      return { href: `${base}guide/items/${item.id}.html`, label: item.title, note: station };
    });
  }
  return publishedEntities
    .filter((entity) => entity.kind === kind)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((entity) => {
      const f = entity.facts ?? {};
      const note = kind === "creatures" ? (f.attitude ?? f.type ?? "") : kind === "biomes" ? (f.depth ?? "") : kind === "vehicles" ? (f.depth ?? "") : (f.source ?? f.group ?? "");
      return { href: `${base}guide/${kind}/${entity.id}.html`, label: entity.title, note: note || "—" };
    });
}

function page(kind, config) {
  const rows = rowsFor(kind);
  const image = imageByPage.get(config.imagePage) ?? imageByPage.get(rows[0] ? config.imagePage : null);
  const figure = image
    ? `<figure class="record-media"><a href="${escapeHtml(image.filePage)}" rel="noopener noreferrer"><img src="${escapeHtml(image.url)}" width="${image.width}" height="${image.height}" loading="lazy" alt="${escapeHtml(image.title)}"></a><figcaption>Wiki image · <a href="${escapeHtml(image.filePage)}" rel="noopener noreferrer">source file</a> · <a href="${license.url}" rel="license">${license.name}</a></figcaption></figure>`
    : `<div class="record-media record-media--empty" data-image-status="unavailable"><span>No Wiki image is available</span></div>`;
  const letterGroups = new Map();
  for (const row of rows) {
    const letter = (row.label[0] ?? "#").toUpperCase();
    if (!letterGroups.has(letter)) letterGroups.set(letter, []);
    letterGroups.get(letter).push(row);
  }
  const sections = [...letterGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, entries]) => `<section class="ledger"><div class="section-heading"><p class="eyebrow">${letter}</p><h2>${entries.length} entries</h2></div><ul class="entity-links">${entries.map((row) => `<li><a href="${row.href}">${escapeHtml(row.label)}</a>${row.note && row.note !== "—" ? ` <span class="fact-note">${escapeHtml(row.note)}</span>` : ""}</li>`).join("")}</ul></section>`).join("");
  const body = `<article class="entity-hero"><p class="eyebrow">Subnautica 2 · Wiki-backed index</p><h1>${escapeHtml(config.heading)}</h1><p class="lede">${escapeHtml(config.intro)}</p></article><section class="evidence-note"><p class="eyebrow">Coverage</p><h2>${rows.length} pages in this index</h2><p>Each entry links to a record that names the Wiki revision it came from. Anything not confirmed in-game is labelled as wiki-backed rather than verified.</p></section>${sections}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(config.heading)} | Subnautica 2 Evidence Guide</title><meta name="description" content="${escapeHtml(config.intro)}"><meta name="robots" content="index,follow"><meta name="theme-color" content="#071d24"><link rel="canonical" href="${SITE}guide/${kind}/index.html"><link rel="icon" href="${base}favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="${base}styles.css"><link rel="stylesheet" href="${base}guide.css"></head><body><a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="shell nav-wrap"><a class="wordmark" href="${base}"><span class="wordmark__kicker">Field notebook / 1962700</span><span>Subnautica 2<br>Evidence Guide</span></a><nav aria-label="Primary navigation"><a href="${base}starter-planner.html">Start</a><a href="${base}crafting.html">Crafting</a><a href="${base}resources.html">Resources</a><a href="${base}creatures.html">Creatures</a><a href="${base}vehicles.html">Vehicles</a><a href="${base}biomes.html">Biomes</a></nav></div></header><main id="main-content" class="shell">${body}</main><footer class="footer"><div class="shell footer__inner"><p>Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.</p><p>Wiki attribution: <a href="https://wiki.subnautica.com/sn2/">Subnautica 2 Wiki</a> · <a href="${license.url}">${license.name}</a></p></div></footer></body></html>`;
}

for (const [kind, config] of Object.entries(kinds)) {
  await mkdir(path.join(root, "guide", kind), { recursive: true });
  await writeFile(path.join(root, "guide", kind, "index.html"), page(kind, config));
}
process.stdout.write(`Generated ${Object.keys(kinds).length} entity index pages (items ${publishedItems.length}, entities ${publishedEntities.length}).\n`);
