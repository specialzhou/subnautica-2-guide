import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiEndpoint = "https://wiki.subnautica.com/sn2/api.php";
const wikiBase = "https://wiki.subnautica.com/sn2/";
const license = { name: "CC BY-NC-SA 3.0", url: "https://creativecommons.org/licenses/by-nc-sa/3.0/" };
const excludedPattern = /\b(dnl|test|debug|placeholder|unobtainable|unused|removed|planned|developer)\b/i;
const definitions = {
  resources: { label: "Resources", singular: "Resource", categories: ["Raw Materials", "Processed Materials"], template: "Infobox Item", output: "resources.html" },
  creatures: { label: "Creatures", singular: "Creature", categories: ["Foragers", "Predators", "Leviathans", "Lifeforms"], template: "Infobox Lifeform", output: "creatures.html" },
  vehicles: { label: "Vehicles", singular: "Vehicle", categories: ["Vehicles"], template: "Infobox Vehicle", output: "vehicles.html" },
  biomes: { label: "Biomes", singular: "Biome", categories: ["Biomes"], template: ["Infobox Biome", "Infobox_Biome"], output: "biomes.html" },
};

async function wiki(values) {
  const query = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...values });
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`${apiEndpoint}?${query}`, { headers: { "User-Agent": "Subnautica2EvidenceGuide/0.1 (https://specialzhou.github.io/subnautica-2-guide/)" } });
      if (!response.ok) throw new Error(`Wiki request failed: ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function readJsonIfExists(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function categoryMembers(category) {
  const titles = [];
  let continuation;
  do {
    const data = await wiki({ action: "query", list: "categorymembers", cmtitle: `Category:${category}`, cmnamespace: "0", cmlimit: "500", ...(continuation ? { cmcontinue: continuation } : {}) });
    titles.push(...data.query.categorymembers.map((member) => member.title));
    continuation = data.continue?.cmcontinue;
  } while (continuation);
  return titles;
}

async function fetchPages(titles) {
  const pages = [];
  for (let index = 0; index < titles.length; index += 40) {
    const data = await wiki({ action: "query", titles: titles.slice(index, index + 40).join("|"), prop: "revisions|categories", rvprop: "ids|timestamp|content", rvslots: "main", cllimit: "max", redirects: "1" });
    pages.push(...data.query.pages.filter((page) => !page.missing));
  }
  return pages;
}

function extractTemplates(source, templateName) {
  const templates = [];
  const needle = `{{${templateName}`.toLowerCase();
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.toLowerCase().indexOf(needle, cursor);
    if (start === -1) break;
    const boundary = source[start + needle.length];
    if (boundary && boundary !== "|" && boundary !== "}" && !/\s/.test(boundary)) { cursor = start + needle.length; continue; }
    let depth = 0;
    let end = start;
    for (let index = start; index < source.length - 1; index += 1) {
      const pair = source.slice(index, index + 2);
      if (pair === "{{") { depth += 1; index += 1; }
      else if (pair === "}}") { depth -= 1; index += 1; if (depth === 0) { end = index + 1; break; } }
    }
    if (end > start) templates.push(source.slice(start + 2, end - 2));
    cursor = end > start ? end : start + needle.length;
  }
  return templates;
}

function splitTemplate(template) {
  const parts = [];
  let current = "";
  let templateDepth = 0;
  let linkDepth = 0;
  for (let index = 0; index < template.length; index += 1) {
    const pair = template.slice(index, index + 2);
    if (pair === "{{") { templateDepth += 1; current += pair; index += 1; continue; }
    if (pair === "}}") { templateDepth -= 1; current += pair; index += 1; continue; }
    if (pair === "[[") { linkDepth += 1; current += pair; index += 1; continue; }
    if (pair === "]]" ) { linkDepth -= 1; current += pair; index += 1; continue; }
    if (template[index] === "|" && templateDepth === 0 && linkDepth === 0) { parts.push(current.trim()); current = ""; }
    else current += template[index];
  }
  parts.push(current.trim());
  return parts;
}

function templateParameters(template) {
  const [, ...fields] = splitTemplate(template);
  return Object.fromEntries(fields.map((field) => { const separator = field.indexOf("="); return separator === -1 ? [field.trim(), ""] : [field.slice(0, separator).trim().toLowerCase(), field.slice(separator + 1).trim()]; }));
}

function plain(value) {
  return String(value ?? "").replace(/<!--[^]*?-->/g, "").replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1").replace(/{{[^{}]*}}/g, "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, "").replace(/''+/g, "").replace(/&nbsp;/g, " ").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&amp;/g, "&").replace(/^\s*\*\s*/gm, "").replace(/\s+/g, " ").trim();
}

function linkedValues(value) {
  const links = [...String(value ?? "").matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g)].map((match) => plain(match[2] || match[1]));
  if (links.length) return [...new Set(links)];
  const fallback = plain(value);
  return fallback ? [fallback] : [];
}

function imageFile(value) {
  const raw = String(value ?? "").replace(/<!--[^]*?-->/g, "").trim();
  const linked = raw.match(/\[\[(?:File|Image):([^|\]]+)/i)?.[1];
  const candidate = (linked ?? raw.split("|")[0]).replace(/^(?:File|Image):/i, "").replaceAll("_", " ").trim();
  return /\.(?:png|jpe?g|webp|gif)$/i.test(candidate) ? candidate : "";
}

async function fetchImageMedia(fileNames) {
  const media = new Map();
  const names = [...new Set(fileNames.filter(Boolean))];
  for (let index = 0; index < names.length; index += 40) {
    const batch = names.slice(index, index + 40);
    const data = await wiki({
      action: "query",
      titles: batch.map((name) => `File:${name}`).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: "720",
      redirects: "1",
    });
    for (const page of data.query.pages) {
      const info = page.imageinfo?.[0];
      if (!info || !info.mime?.startsWith("image/")) continue;
      const fileName = page.title.replace(/^File:/i, "");
      media.set(fileName.toLowerCase(), {
        fileName,
        url: info.thumburl || info.url,
        filePage: info.descriptionurl,
        width: info.thumbwidth || info.width,
        height: info.thumbheight || info.height,
      });
    }
  }
  return media;
}

function slugify(value) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function permanentUrl(title, revisionId) { return `${wikiBase}index.php?title=${encodeURIComponent(title.replaceAll(" ", "_"))}&oldid=${revisionId}`; }

function normalizePage(kind, page) {
  const revision = page.revisions?.[0];
  const sourceText = revision?.slots?.main?.content ?? "";
  const templateNames = Array.isArray(definitions[kind].template) ? definitions[kind].template : [definitions[kind].template];
  const template = templateNames.flatMap((name) => extractTemplates(sourceText, name))[0];
  if (!template) return null;
  const fields = templateParameters(template);
  const categories = (page.categories ?? []).map((category) => category.title.replace(/^Category:/, ""));
  const excludedSignals = [page.title, ...categories].filter((value) => excludedPattern.test(value));
  if (/{{\s*(Planned|Unobtainable|Unused|Removed|Future)/i.test(sourceText)) excludedSignals.push("wiki status template");
  const base = {
    id: slugify(page.title), title: page.title, kind,
    imageFile: imageFile(fields.image || fields.image1 || fields.picture || fields.icon || fields.art),
    status: excludedSignals.length ? "excluded" : "wiki-backed",
    exclusionReasons: [...new Set(excludedSignals)], categories,
    source: { type: "official-community-wiki", pageUrl: `${wikiBase}${encodeURIComponent(page.title.replaceAll(" ", "_"))}`, permanentUrl: permanentUrl(page.title, revision.revid), revisionId: revision.revid, revisionTimestamp: revision.timestamp, fetchedAt: new Date().toISOString(), license },
  };
  if (kind === "resources") return { ...base, facts: { source: plain(fields.source), group: plain(fields.category), biomes: linkedValues(fields.biome) } };
  if (kind === "creatures") return { ...base, facts: { attitude: plain(fields.attitude), type: plain(fields.type), group: plain(fields.category), species: plain(fields.species), nutrition: plain(fields.nutrition), biomes: linkedValues(fields.biome) } };
  if (kind === "vehicles") return { ...base, facts: { speed: plain(fields.speed), depth: plain(fields.depth), health: plain(fields.health), source: plain(fields.source), fragments: plain(fields.fragments) } };
  return { ...base, facts: { depth: plain(fields.depth), pointsOfInterest: linkedValues(fields.poi) } };
}

function layout({ title, description, canonical, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="theme-color" content="#071d24"><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" href="/subnautica-2-guide/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet"><link rel="stylesheet" href="/subnautica-2-guide/styles.css"><link rel="stylesheet" href="/subnautica-2-guide/guide.css"></head><body><a class="skip-link" href="#main-content">Skip to content</a><div class="notice"><div class="shell notice__inner"><span class="notice__mark notice__mark--wiki" aria-hidden="true"></span>Structured facts retain a permanent official Wiki revision link.</div></div><header class="site-header"><div class="shell nav-wrap"><a class="wordmark" href="/subnautica-2-guide/"><span class="wordmark__kicker">Field notebook / 1962700</span><span>Subnautica 2<br>Evidence Guide</span></a><nav aria-label="Primary navigation"><a href="/subnautica-2-guide/starter-planner.html">Start</a><a href="/subnautica-2-guide/blueprints.html">Blueprints</a><a href="/subnautica-2-guide/crafting.html">Crafting</a><a href="/subnautica-2-guide/resources.html">Resources</a><a href="/subnautica-2-guide/biomes.html">Biomes</a></nav></div></header><main id="main-content" class="shell">${body}</main><footer class="footer"><div class="shell footer__inner"><p>Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.</p><p>Wiki attribution: <a href="https://wiki.subnautica.com/sn2/">Subnautica 2 Wiki</a> · <a href="${license.url}">${license.name}</a></p></div></footer></body></html>`;
}

function displayValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function entityPage(entity, related = {}) {
  const definition = definitions[entity.kind];
  const factRows = Object.entries(entity.facts).filter(([, value]) => Array.isArray(value) ? value.length : value).map(([key, value]) => `<tr><th>${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</th><td>${escapeHtml(displayValue(value))}</td></tr>`).join("");
  const relatedBlocks = Object.entries(related).filter(([, values]) => values.length).map(([label, values]) => `<section class="related-block"><p class="eyebrow">Related ${escapeHtml(label)}</p><ul class="entity-links">${values.map((entry) => `<li><a href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a></li>`).join("")}</ul></section>`).join("");
  const body = `<article class="entity-hero"><p class="eyebrow">${definition.singular} record · Wiki-backed</p><h1>${escapeHtml(entity.title)}</h1><p class="lede">Structured ${definition.singular.toLowerCase()} facts imported from a permanent revision of the official, community-maintained Subnautica 2 Wiki.</p><dl class="entity-meta"><div><dt>Status</dt><dd><span class="status status--wiki">Wiki-backed</span></dd></div><div><dt>Revision</dt><dd><a href="${entity.source.permanentUrl}" rel="noopener noreferrer">${entity.source.revisionId}</a></dd></div><div><dt>Wiki updated</dt><dd>${entity.source.revisionTimestamp.slice(0, 10)}</dd></div></dl></article><section class="recipe-block"><div class="recipe-block__heading"><p class="eyebrow">Structured facts</p><h2>Wiki record</h2></div><div class="table-wrap"><table><tbody>${factRows || `<tr><td>No structured fields were published.</td></tr>`}</tbody></table></div></section>${relatedBlocks}<section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>Wiki-backed, not independently reproduced</h2><p>These fields are tied to the linked revision. Exact coordinates, progression advice, and patch-sensitive behavior require stronger verification.</p><p><a href="/subnautica-2-guide/${definition.output}">Back to all ${definition.label.toLowerCase()}</a></p></section>`;
  return layout({ title: `${entity.title} | Subnautica 2 ${definition.singular}`, description: `Source-linked ${entity.title} ${definition.singular.toLowerCase()} facts for Subnautica 2.`, canonical: `https://specialzhou.github.io/subnautica-2-guide/guide/${entity.kind}/${entity.id}.html`, body });
}

function indexPage(kind, entities, generatedAt) {
  const definition = definitions[kind];
  const rows = entities.map((entity) => { const details = Object.values(entity.facts).flat().filter(Boolean).join(" "); return `<tr data-entry data-search="${escapeHtml(`${entity.title} ${details}`.toLowerCase())}"><td><span class="record-name">${entity.media ? `<a class="record-thumb" href="${escapeHtml(entity.media.filePage)}" rel="noopener noreferrer"><img src="${escapeHtml(entity.media.url)}" width="${entity.media.width}" height="${entity.media.height}" loading="lazy" alt="${escapeHtml(`${entity.title} Wiki image`)}"></a>` : `<span class="record-thumb record-thumb--empty" aria-label="No Wiki image">${definition.singular.slice(0, 1)}</span>`}<a href="guide/${kind}/${entity.id}.html">${escapeHtml(entity.title)}</a></span></td><td>${escapeHtml(details || "No structured details")}</td><td><a href="${entity.source.permanentUrl}" rel="noopener noreferrer">rev ${entity.source.revisionId}</a></td></tr>`; }).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Official Wiki import · ${generatedAt.slice(0, 10)}</p><h1>${definition.label}<br><em>records.</em></h1><p class="lede">${entities.length} source-linked ${definition.label.toLowerCase()} imported from permanent Subnautica 2 Wiki revisions.</p><label class="search-box"><span>Filter records</span><input id="entity-search" type="search" placeholder="Search ${definition.label.toLowerCase()}…" autocomplete="off"></label></section><section class="ledger"><div class="section-heading section-heading--row"><div><p class="eyebrow">Wiki-backed dataset</p><h2>All ${definition.label.toLowerCase()}</h2></div><p class="ledger__note"><span id="visible-count">${entities.length}</span> records shown</p></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Name</th><th>Structured facts</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></section><script>const input=document.getElementById("entity-search"),rows=[...document.querySelectorAll("[data-entry]")],count=document.getElementById("visible-count");input.addEventListener("input",()=>{const q=input.value.trim().toLowerCase();let visible=0;rows.forEach(row=>{const show=!q||row.dataset.search.includes(q);row.hidden=!show;if(show)visible++});count.textContent=visible});</script>`;
  return layout({ title: `Subnautica 2 ${definition.label} | Evidence Guide`, description: `${entities.length} source-linked Subnautica 2 ${definition.label.toLowerCase()} from permanent official Wiki revisions.`, canonical: `https://specialzhou.github.io/subnautica-2-guide/${definition.output}`, body });
}

function starterMaterialsPage(items, resources, biomes) {
  const required = ["Acidic Raion Pouch", "Copper", "Fibrous Pulp", "Lucifer Rotsac", "Metal Salvage", "Quartz", "Silver", "Sulfur"];
  const itemByTitle = new Map(items.map((item) => [item.title, item]));
  const resourceByTitle = new Map(resources.map((resource) => [resource.title, resource]));
  const biomeTitles = new Set(biomes.map((biome) => biome.title));
  const rows = required.map((title) => {
    const resource = resourceByTitle.get(title);
    const item = itemByTitle.get(title);
    const href = resource ? `guide/resources/${resource.id}.html` : item ? `guide/items/${item.id}.html` : null;
    const source = resource?.facts.source || "Not recorded in imported resource fields";
    const biomeList = resource?.facts.biomes.length ? resource.facts.biomes.map((biome) => biomeTitles.has(biome) ? `<a href="guide/biomes/${slugify(biome)}.html">${escapeHtml(biome)}</a>` : escapeHtml(biome)).join(", ") : "Not recorded";
    const provenance = resource?.source || item?.source;
    return `<tr><td>${href ? `<a href="${href}">${escapeHtml(title)}</a>` : escapeHtml(title)}</td><td>${escapeHtml(source)}</td><td>${biomeList}</td><td>${provenance ? `<a href="${escapeHtml(provenance.permanentUrl)}" rel="noopener noreferrer">rev ${provenance.revisionId}</a>` : "No imported record"}</td></tr>`;
  }).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Starter planner companion · Wiki-backed</p><h1>Starter materials<br><em>locator.</em></h1><p class="lede">Where the structured Wiki fields say the starter-planner inputs come from. Missing locations stay visibly unknown instead of being invented.</p></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Eight required inputs</p><h2>Source and biome evidence</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Material</th><th>Recorded source</th><th>Recorded biome</th><th>Revision</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>A biome is not a farming route</h2><p>This page proves only the imported source and biome fields. Exact coordinates, yield, respawn behavior, safety, and fastest path still require an in-game capture tied to a build.</p><p><a href="/subnautica-2-guide/starter-planner.html">Open the starter crafting planner</a></p></section>`;
  return layout({ title: "Subnautica 2 starter material locations | Evidence Guide", description: "Source-linked locations and known biome fields for materials used by the Subnautica 2 starter crafting planner.", canonical: "https://specialzhou.github.io/subnautica-2-guide/starter-materials.html", body });
}

function vehiclePlannerPage(items, vehicles) {
  const itemByTitle = new Map(items.map((item) => [item.title, item]));
  const recipeRow = (title, role) => {
    const item = itemByTitle.get(title);
    if (!item) return "";
    const recipe = item.recipes[0];
    return `<tr><td>${escapeHtml(role)}</td><td><a href="guide/items/${item.id}.html">${escapeHtml(item.title)}</a></td><td>${escapeHtml(recipe.station)}</td><td>${recipe.ingredients.map((ingredient) => `${escapeHtml(ingredient.item)} ×${escapeHtml(ingredient.count)}`).join(", ")}</td><td><a href="${escapeHtml(item.source.permanentUrl)}" rel="noopener noreferrer">rev ${item.source.revisionId}</a></td></tr>`;
  };
  const supportRows = [["Moonpool", "Base module"], ["Vehicle Fabricator", "Fabrication station"], ["Tadpole Dock", "Docking structure"], ["Tadpole", "Core vehicle"]].map(([title, role]) => recipeRow(title, role)).join("");
  const vehicleRows = vehicles.map((vehicle) => `<tr><td><a href="guide/vehicles/${vehicle.id}.html">${escapeHtml(vehicle.title)}</a></td><td>${escapeHtml(vehicle.facts.fragments || "Not recorded")}</td><td>${escapeHtml(vehicle.facts.speed || "Not recorded")}</td><td>${escapeHtml(vehicle.facts.depth || "Not recorded")}</td><td><a href="${escapeHtml(vehicle.source.permanentUrl)}" rel="noopener noreferrer">rev ${vehicle.source.revisionId}</a></td></tr>`).join("");
  const moduleRows = [["Tadpole Depth Module Mk. 1", "450m"], ["Tadpole Depth Module Mk. 2", "800m"]].map(([title, depth]) => recipeRow(title, `Depth rating ${depth}`)).join("");
  const chassisRows = [["Tadpole Haul Chassis", "Haul chassis"], ["Tadpole Scout Ray Chassis", "Scout Ray chassis"]].map(([title, role]) => recipeRow(title, role)).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Vehicle records and recipes · Wiki-backed</p><h1>Tadpole<br><em>vehicle planner.</em></h1><p class="lede">Construction inputs, fragment counts, chassis records, and documented depth ratings in one source-linked view.</p></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Construction records</p><h2>Vehicle-related structures and core</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Role</th><th>Record</th><th>Station</th><th>Inputs</th><th>Revision</th></tr></thead><tbody>${supportRows}</tbody></table></div></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Fragment and capability fields</p><h2>Published vehicle records</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Vehicle</th><th>Fragments</th><th>Speed</th><th>Depth</th><th>Revision</th></tr></thead><tbody>${vehicleRows}</tbody></table></div></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Depth recipes</p><h2>Documented module ratings</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Rating</th><th>Module</th><th>Station</th><th>Inputs</th><th>Revision</th></tr></thead><tbody>${moduleRows}</tbody></table></div></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Chassis recipes</p><h2>Alternative chassis records</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Role</th><th>Chassis</th><th>Station</th><th>Inputs</th><th>Revision</th></tr></thead><tbody>${chassisRows}</tbody></table></div></section><section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>Grouped records are not a claimed unlock order</h2><p>The page groups related structured facts. It does not infer fragment coordinates, mandatory construction order, module compatibility behavior, or the best chassis.</p></section>`;
  return layout({ title: "Subnautica 2 Tadpole vehicle planner | Evidence Guide", description: "Source-linked Tadpole recipes, fragments, chassis, and depth module ratings for Subnautica 2.", canonical: "https://specialzhou.github.io/subnautica-2-guide/vehicle-planner.html", body });
}

function locationsPage(biomes) {
  const withPoints = biomes.filter((biome) => biome.facts.pointsOfInterest.length).sort((a, b) => a.title.localeCompare(b.title));
  const rows = withPoints.flatMap((biome) => biome.facts.pointsOfInterest.map((point, index) => `<tr>${index === 0 ? `<td class="location-biome-cell" rowspan="${biome.facts.pointsOfInterest.length}">${biome.media ? `<a class="location-thumb" href="${escapeHtml(biome.media.filePage)}" rel="noopener noreferrer"><img src="${escapeHtml(biome.media.url)}" width="${biome.media.width}" height="${biome.media.height}" loading="lazy" alt="${escapeHtml(`${biome.title} Wiki image`)}"></a>` : `<span class="location-thumb location-thumb--empty">No Wiki image</span>`}<a href="guide/biomes/${biome.id}.html">${escapeHtml(biome.title)}</a></td>` : ""}<td>${escapeHtml(point)}</td><td>${escapeHtml(biome.facts.depth || "Not recorded")}</td><td><a href="${escapeHtml(biome.source.permanentUrl)}" rel="noopener noreferrer">rev ${biome.source.revisionId}</a></td></tr>`)).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Biome infobox POIs · Wiki-backed</p><h1>Key locations<br><em>index.</em></h1><p class="lede">${withPoints.reduce((count, biome) => count + biome.facts.pointsOfInterest.length, 0)} named points of interest grouped under ${withPoints.length} biome records.</p><p class="fact-note location-naming-note">In-game proper names stay in English when no verified localized name is available.</p></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Structured location fields</p><h2>Named points of interest</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Biome</th><th>Point of interest</th><th>Biome depth</th><th>Revision</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>Names and biome depth are not coordinates</h2><p>The Wiki infobox connects each name to a biome record. This page does not infer exact coordinates, route order, entrance position, or travel safety.</p></section>`;
  return layout({ title: "Subnautica 2 key locations index | Evidence Guide", description: "Source-linked Subnautica 2 points of interest grouped by biome and documented depth.", canonical: "https://specialzhou.github.io/subnautica-2-guide/locations.html", body });
}

function relatedFor(entity, publishedByKind) {
  if (entity.kind === "resources") return { biomes: entity.facts.biomes.filter((name) => publishedByKind.biomes.has(name)).map((name) => ({ title: name, href: `/subnautica-2-guide/guide/biomes/${slugify(name)}.html` })) };
  if (entity.kind === "creatures") return { biomes: entity.facts.biomes.filter((name) => publishedByKind.biomes.has(name)).map((name) => ({ title: name, href: `/subnautica-2-guide/guide/biomes/${slugify(name)}.html` })) };
  if (entity.kind === "biomes") {
    const resources = [...publishedByKind.resources.values()].filter((entry) => entry.facts.biomes.includes(entity.title)).map((entry) => ({ title: entry.title, href: `/subnautica-2-guide/guide/resources/${entry.id}.html` }));
    const creatures = [...publishedByKind.creatures.values()].filter((entry) => entry.facts.biomes.includes(entity.title)).map((entry) => ({ title: entry.title, href: `/subnautica-2-guide/guide/creatures/${entry.id}.html` }));
    return { resources, creatures };
  }
  return {};
}

function fullSitemap(items, entities, generatedAt) {
  const urls = ["", "starter-planner.html", "starter-materials.html", "equipment-upgrades.html", "blueprints.html", "vehicle-planner.html", "locations.html", "story.html", "crafting.html", "oxygen.html", "base-building.html", "coop.html", "resources.html", "creatures.html", "vehicles.html", "biomes.html", "sources.html"].map((page, index) => `  <url><loc>https://specialzhou.github.io/subnautica-2-guide/${page}</loc><lastmod>${generatedAt.slice(0, 10)}</lastmod><priority>${index === 0 ? "1.0" : "0.9"}</priority></url>`);
  urls.push(...items.map((item) => `  <url><loc>https://specialzhou.github.io/subnautica-2-guide/guide/items/${item.id}.html</loc><lastmod>${item.source.revisionTimestamp.slice(0, 10)}</lastmod><priority>0.7</priority></url>`));
  urls.push(...entities.map((entity) => `  <url><loc>https://specialzhou.github.io/subnautica-2-guide/guide/${entity.kind}/${entity.id}.html</loc><lastmod>${entity.source.revisionTimestamp.slice(0, 10)}</lastmod><priority>0.7</priority></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

async function main() {
  const checkedAt = new Date().toISOString();
  const dataPath = path.join(root, "data", "wiki-entities.json");
  const previousData = await readJsonIfExists(dataPath);
  const previousByKey = new Map((previousData?.entities ?? []).map((entity) => [`${entity.kind}:${entity.id}`, entity]));
  const allEntities = [];
  for (const [kind, definition] of Object.entries(definitions)) {
    const lists = await Promise.all(definition.categories.map(categoryMembers));
    const pages = await fetchPages([...new Set(lists.flat())].sort());
    allEntities.push(...pages.map((page) => normalizePage(kind, page)).filter(Boolean));
  }
  const mediaByFile = await fetchImageMedia(allEntities.map((entity) => entity.imageFile));
  for (const entity of allEntities) {
    entity.media = entity.imageFile ? mediaByFile.get(entity.imageFile.toLowerCase()) ?? null : null;
    delete entity.imageFile;
  }
  const deduped = [...new Map(allEntities.map((entity) => [`${entity.kind}:${entity.id}`, entity])).values()].map((entity) => {
    const previous = previousByKey.get(`${entity.kind}:${entity.id}`);
    if (previous?.source.revisionId === entity.source.revisionId) entity.source.fetchedAt = previous.source.fetchedAt;
    return entity;
  }).sort((a, b) => a.title.localeCompare(b.title));
  const revisionsChanged = !previousData || deduped.length !== previousData.entities.length || deduped.some((entity) => {
    const previous = previousByKey.get(`${entity.kind}:${entity.id}`);
    return !previous || previous.source.revisionId !== entity.source.revisionId || previous.status !== entity.status;
  });
  const generatedAt = revisionsChanged ? checkedAt : previousData.generatedAt;
  const published = deduped.filter((entity) => entity.status === "wiki-backed");
  const excluded = deduped.filter((entity) => entity.status === "excluded");
  const publishedByKind = Object.fromEntries(Object.keys(definitions).map((kind) => [kind, new Map(published.filter((entity) => entity.kind === kind).map((entity) => [entity.title, entity]))]));

  for (const kind of Object.keys(definitions)) {
    const directory = path.join(root, "guide", kind);
    await mkdir(directory, { recursive: true });
    const oldFiles = await readdir(directory);
    await Promise.all(oldFiles.filter((file) => file.endsWith(".html")).map((file) => unlink(path.join(directory, file))));
    const entities = [...publishedByKind[kind].values()];
    await Promise.all(entities.map((entity) => writeFile(path.join(directory, `${entity.id}.html`), entityPage(entity, relatedFor(entity, publishedByKind)))));
    await writeFile(path.join(root, definitions[kind].output), indexPage(kind, entities, generatedAt));
  }

  await writeFile(dataPath, `${JSON.stringify({ schemaVersion: "1.1.0", generatedAt, source: apiEndpoint, license, publishedCount: published.length, excludedCount: excluded.length, counts: Object.fromEntries(Object.keys(definitions).map((kind) => [kind, publishedByKind[kind].size])), imageCount: published.filter((entity) => entity.media).length, entities: deduped }, null, 2)}\n`);
  const itemsData = JSON.parse(await readFile(path.join(root, "data", "wiki-items.json"), "utf8"));
  await writeFile(path.join(root, "starter-materials.html"), starterMaterialsPage(itemsData.items.filter((item) => item.status === "wiki-backed"), [...publishedByKind.resources.values()], [...publishedByKind.biomes.values()]));
  await writeFile(path.join(root, "vehicle-planner.html"), vehiclePlannerPage(itemsData.items.filter((item) => item.status === "wiki-backed"), [...publishedByKind.vehicles.values()]));
  await writeFile(path.join(root, "locations.html"), locationsPage([...publishedByKind.biomes.values()]));
  const siteGeneratedAt = new Date(Math.max(new Date(itemsData.generatedAt).getTime(), new Date(generatedAt).getTime())).toISOString();
  await writeFile(path.join(root, "sitemap.xml"), fullSitemap(itemsData.items.filter((item) => item.status === "wiki-backed"), published, siteGeneratedAt));
  const ledgerPath = path.join(root, "data", "ledger.json");
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  ledger.tracker.wikiBackedEntries = itemsData.publishedCount + published.length;
  ledger.tracker.inReview = itemsData.excludedCount + excluded.length;
  ledger.tracker.withdrawnPages = 1;
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  process.stdout.write(`Imported ${deduped.length} entity pages: ${published.length} published, ${excluded.length} excluded, revisions ${revisionsChanged ? "changed" : "unchanged"}.\n`);
}

await main();
