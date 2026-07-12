import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiEndpoint = "https://wiki.subnautica.com/sn2/api.php";
const wikiBase = "https://wiki.subnautica.com/sn2/";
const license = {
  name: "CC BY-NC-SA 3.0",
  url: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
};
const craftingCategories = [
  "Crafted with Fabricator",
  "Crafted with Habitat Builder",
  "Crafted with Processor",
  "Crafted with Modification Station",
  "Crafted with Vehicle Fabricator",
  "Crafted with Metal Farm",
];
const excludedPattern = /\b(dnl|test|debug|placeholder|unobtainable|unused|removed|planned|developer)\b/i;

function params(values) {
  return new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...values });
}

async function wiki(values) {
  const url = `${apiEndpoint}?${params(values)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Subnautica2EvidenceTracker/0.1 (https://specialzhou.github.io/subnautica-2-guide/)" },
  });
  if (!response.ok) throw new Error(`Wiki request failed: ${response.status} ${url}`);
  return response.json();
}

async function readJsonIfExists(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function categoryMembers(category) {
  const titles = [];
  let continuation;
  do {
    const data = await wiki({
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmnamespace: "0",
      cmlimit: "500",
      ...(continuation ? { cmcontinue: continuation } : {}),
    });
    titles.push(...data.query.categorymembers.map((member) => member.title));
    continuation = data.continue?.cmcontinue;
  } while (continuation);
  return titles;
}

async function fetchPages(titles) {
  const pages = [];
  for (let index = 0; index < titles.length; index += 40) {
    const batch = titles.slice(index, index + 40);
    const data = await wiki({
      action: "query",
      titles: batch.join("|"),
      prop: "revisions|categories",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      cllimit: "max",
      redirects: "1",
    });
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
    if (boundary && boundary !== "|" && boundary !== "}" && !/\s/.test(boundary)) {
      cursor = start + needle.length;
      continue;
    }
    let depth = 0;
    let end = start;
    for (let index = start; index < source.length - 1; index += 1) {
      const pair = source.slice(index, index + 2);
      if (pair === "{{") {
        depth += 1;
        index += 1;
      } else if (pair === "}}") {
        depth -= 1;
        index += 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
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
    if (template[index] === "|" && templateDepth === 0 && linkDepth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += template[index];
    }
  }
  parts.push(current.trim());
  return parts;
}

function templateParameters(template) {
  const [, ...fields] = splitTemplate(template);
  return Object.fromEntries(fields.map((field) => {
    const separator = field.indexOf("=");
    return separator === -1 ? [field.trim(), ""] : [field.slice(0, separator).trim().toLowerCase(), field.slice(separator + 1).trim()];
  }));
}

function plain(value, pageTitle = "") {
  return String(value ?? "")
    .replace(/<!--[^]*?-->/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/{{\s*PAGENAME\s*}}/gi, pageTitle)
    .replace(/{{[^{}]*}}/g, "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/''+/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRecipe(template, pageTitle) {
  const fields = templateParameters(template);
  const ingredients = [];
  for (let index = 1; index <= 16; index += 1) {
    const item = plain(fields[`item${index}`] || (index === 1 ? fields.item : ""), pageTitle);
    if (!item) continue;
    ingredients.push({ item, count: plain(fields[`count${index}`] || (index === 1 ? fields.count : "") || "1", pageTitle) });
  }
  const result = plain(fields.result || pageTitle, pageTitle);
  const resultCount = plain(fields.resultcount || fields.resultcount1 || "1", pageTitle);
  return {
    station: plain(fields.machine || "Unknown", pageTitle),
    ingredients,
    result,
    resultCount,
    craftingTime: plain(fields.craftingtime || "", pageTitle) || null,
  };
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function permanentUrl(title, revisionId) {
  return `${wikiBase}index.php?title=${encodeURIComponent(title.replaceAll(" ", "_"))}&oldid=${revisionId}`;
}

function classify(page, source) {
  const categoryNames = (page.categories ?? []).map((category) => category.title.replace(/^Category:/, ""));
  const signals = [page.title, ...categoryNames].filter((value) => excludedPattern.test(value));
  if (/\bDNL\b|\btest\b/i.test(page.title)) signals.push("development-only title");
  if (/{{\s*(Planned|Unobtainable|Unused|Removed)/i.test(source)) signals.push("wiki status template");
  return { status: signals.length ? "excluded" : "wiki-backed", reasons: [...new Set(signals)], categories: categoryNames };
}

function normalizePage(page) {
  const revision = page.revisions?.[0];
  const source = revision?.slots?.main?.content ?? "";
  const classification = classify(page, source);
  const recipes = extractTemplates(source, "Recipe").map((template) => parseRecipe(template, page.title)).filter((recipe) => recipe.ingredients.length || recipe.station !== "Unknown");
  if (!recipes.length) return null;
  const infoboxTemplate = extractTemplates(source, "Infobox Item")[0];
  const infobox = infoboxTemplate ? templateParameters(infoboxTemplate) : {};
  const fragmentCount = Number.parseInt(plain(infobox.fragments, page.title), 10);
  const unlockBiomes = Object.entries(infobox).filter(([key, value]) => /^biome\d*$/.test(key) && value).map(([, value]) => plain(value, page.title)).filter(Boolean);
  return {
    id: slugify(page.title),
    title: page.title,
    status: classification.status,
    exclusionReasons: classification.reasons,
    categories: classification.categories,
    availableByDefault: /recipe is available at the start of the game/i.test(source),
    unlock: {
      source: plain(infobox.source, page.title) || null,
      fragments: Number.isFinite(fragmentCount) ? fragmentCount : null,
      biomes: [...new Set(unlockBiomes)],
    },
    recipes,
    source: {
      type: "official-community-wiki",
      pageUrl: `${wikiBase}${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
      permanentUrl: permanentUrl(page.title, revision.revid),
      revisionId: revision.revid,
      revisionTimestamp: revision.timestamp,
      fetchedAt: new Date().toISOString(),
      license,
    },
  };
}

function layout({ title, description, canonical, body, robots = "index,follow" }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}"><meta name="theme-color" content="#071d24"><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" href="/subnautica-2-guide/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet"><link rel="stylesheet" href="/subnautica-2-guide/styles.css"><link rel="stylesheet" href="/subnautica-2-guide/guide.css"></head><body><a class="skip-link" href="#main-content">Skip to content</a><div class="notice"><div class="shell notice__inner"><span class="notice__mark notice__mark--wiki" aria-hidden="true"></span>Wiki-backed facts include a permanent revision link and are not labelled as in-game verified.</div></div><header class="site-header"><div class="shell nav-wrap"><a class="wordmark" href="/subnautica-2-guide/"><span class="wordmark__kicker">Field notebook / 1962700</span><span>Subnautica 2<br>Evidence Guide</span></a><nav aria-label="Primary navigation"><a href="/subnautica-2-guide/starter-planner.html">Start</a><a href="/subnautica-2-guide/blueprints.html">Blueprints</a><a href="/subnautica-2-guide/equipment-upgrades.html">Upgrades</a><a href="/subnautica-2-guide/crafting.html">Crafting</a><a href="/subnautica-2-guide/resources.html">Resources</a></nav></div></header><main id="main-content" class="shell">${body}</main><footer class="footer"><div class="shell footer__inner"><p>Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.</p><p>Wiki attribution: <a href="https://wiki.subnautica.com/sn2/">Subnautica 2 Wiki</a> · <a href="${license.url}">${license.name}</a></p></div></footer></body></html>`;
}

function itemPage(item, publishedIds) {
  const recipeSections = item.recipes.map((recipe, index) => `
    <section class="recipe-block" aria-labelledby="recipe-${index}"><div class="recipe-block__heading"><p class="eyebrow">Recipe ${item.recipes.length > 1 ? index + 1 : ""}</p><h2 id="recipe-${index}">${escapeHtml(recipe.station)}</h2></div><div class="table-wrap"><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${recipe.ingredients.map((ingredient) => { const ingredientName = escapeHtml(ingredient.item); return `<tr><td>${publishedIds.has(slugify(ingredient.item)) ? `<a href="/subnautica-2-guide/guide/items/${slugify(ingredient.item)}.html">${ingredientName}</a>` : ingredientName}</td><td>${escapeHtml(ingredient.count)}</td></tr>`; }).join("")}</tbody></table></div>${recipe.craftingTime ? `<p class="fact-note">Crafting time: <strong>${escapeHtml(recipe.craftingTime)}</strong></p>` : ""}</section>`).join("");
  const body = `<article class="entity-hero"><p class="eyebrow">Crafting record · Wiki-backed</p><h1>${escapeHtml(item.title)}</h1><p class="lede">This record reproduces structured recipe facts from a permanent revision of the official, community-maintained Subnautica 2 Wiki. It does not copy the Wiki article text.</p><dl class="entity-meta"><div><dt>Status</dt><dd><span class="status status--wiki">Wiki-backed</span></dd></div><div><dt>Revision</dt><dd><a href="${escapeHtml(item.source.permanentUrl)}" rel="noopener noreferrer">${item.source.revisionId}</a></dd></div><div><dt>Wiki updated</dt><dd>${escapeHtml(item.source.revisionTimestamp.slice(0, 10))}</dd></div><div><dt>Unlock</dt><dd>${item.availableByDefault ? "Available at game start (Wiki statement)" : "Not stated as default"}</dd></div></dl></article>${recipeSections}<section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>What this status means</h2><p>The recipe is backed by the linked Wiki revision. It has not yet been independently confirmed with an in-game capture and exact build number.</p><p><a href="/subnautica-2-guide/crafting.html">Back to all crafting records</a></p></section>`;
  return layout({ title: `${item.title} recipe | Subnautica 2`, description: `${item.title} crafting recipe with Wiki revision provenance for Subnautica 2.`, canonical: `https://specialzhou.github.io/subnautica-2-guide/guide/items/${item.id}.html`, body });
}

function craftingIndex(items, generatedAt) {
  const rows = items.map((item) => {
    const primary = item.recipes[0];
    const ingredients = primary.ingredients.map((ingredient) => `${ingredient.item} ×${ingredient.count}`).join(", ");
    const stations = [...new Set(item.recipes.map((recipe) => recipe.station))].join(" / ");
    const searchText = item.recipes.flatMap((recipe) => [recipe.station, ...recipe.ingredients.flatMap((ingredient) => [ingredient.item, ingredient.count])]).join(" ");
    const alternateLabel = item.recipes.length > 1 ? ` · ${item.recipes.length - 1} alternate ${item.recipes.length === 2 ? "recipe" : "recipes"}` : "";
    return `<tr data-entry data-search="${escapeHtml(`${item.title} ${searchText}`.toLowerCase())}"><td><a href="guide/items/${item.id}.html">${escapeHtml(item.title)}</a></td><td>${escapeHtml(stations)}</td><td>${escapeHtml(ingredients || "No ingredients listed")}${escapeHtml(alternateLabel)}</td><td><a href="${escapeHtml(item.source.permanentUrl)}" rel="noopener noreferrer">rev ${item.source.revisionId}</a></td></tr>`;
  }).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Official Wiki import · ${escapeHtml(generatedAt.slice(0, 10))}</p><h1>Crafting<br><em>records.</em></h1><p class="lede">${items.length} current recipe records imported from permanent Subnautica 2 Wiki revisions. Search by item, station, or ingredient.</p><label class="search-box"><span>Filter records</span><input id="crafting-search" type="search" placeholder="Scanner, Fabricator, Titanium…" autocomplete="off"></label></section><section class="ledger"><div class="section-heading section-heading--row"><div><p class="eyebrow">Wiki-backed dataset</p><h2>All published recipes</h2></div><p class="ledger__note"><span id="visible-count">${items.length}</span> records shown</p></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Item</th><th>Station</th><th>Ingredients</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></section><script>const input=document.getElementById("crafting-search"),rows=[...document.querySelectorAll("[data-entry]")],count=document.getElementById("visible-count");input.addEventListener("input",()=>{const q=input.value.trim().toLowerCase();let visible=0;rows.forEach(row=>{const show=!q||row.dataset.search.includes(q);row.hidden=!show;if(show)visible++});count.textContent=visible});</script>`;
  return layout({ title: "Subnautica 2 crafting recipes | Evidence Guide", description: `${items.length} source-linked Subnautica 2 crafting recipes imported from permanent official Wiki revisions.`, canonical: "https://specialzhou.github.io/subnautica-2-guide/crafting.html", body });
}

function topicIndex({ title, kicker, description, items, canonical, emptyMessage }) {
  const rows = items.flatMap((item) => item.recipes.map((recipe) => {
    const ingredients = recipe.ingredients.map((ingredient) => `${ingredient.item} ×${ingredient.count}`).join(", ");
    return `<tr><td><a href="guide/items/${item.id}.html">${escapeHtml(item.title)}</a></td><td>${escapeHtml(recipe.station)}</td><td>${escapeHtml(ingredients || emptyMessage)}</td><td><a href="${escapeHtml(item.source.permanentUrl)}" rel="noopener noreferrer">rev ${item.source.revisionId}</a></td></tr>`;
  })).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">${escapeHtml(kicker)} · Wiki-backed</p><h1>${escapeHtml(title)}<br><em>reference.</em></h1><p class="lede">${escapeHtml(description)}</p></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Structured records</p><h2>Source-linked equipment and recipes</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Item</th><th>Station</th><th>Ingredients</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>What this page does not claim</h2><p>This is a structured reference, not a progression walkthrough. Exact recommendations remain unpublished until they are checked in-game against a recorded build.</p></section>`;
  return layout({ title: `${title} | Subnautica 2 Evidence Guide`, description, canonical, body });
}

function starterPlanner(items) {
  const byTitle = new Map(items.map((item) => [item.title, item]));
  const targets = ["Scanner", "Standard Air Tank", "Basic Fins", "Habitat Builder", "Repair Tool"].map((title) => byTitle.get(title)).filter(Boolean);
  const expand = (title, amount, steps, raw, trail = new Set()) => {
    const item = byTitle.get(title);
    if (!item?.recipes.length || trail.has(title)) { raw.set(title, (raw.get(title) || 0) + amount); return; }
    const recipe = item.recipes[0];
    const outputCount = Number(recipe.resultCount || 1);
    const crafts = Math.ceil(amount / outputCount);
    steps.push({ item, amount, crafts, outputCount, recipe });
    const nextTrail = new Set(trail).add(title);
    for (const ingredient of recipe.ingredients) expand(ingredient.item, Number(ingredient.count) * crafts, steps, raw, nextTrail);
  };
  const sections = targets.map((target) => {
    const steps = [], raw = new Map();
    expand(target.title, 1, steps, raw);
    const stepRows = [...steps].reverse().map((step, index) => `<tr><td>${index + 1}</td><td><a href="guide/items/${step.item.id}.html">${escapeHtml(step.item.title)}</a>${step.crafts > 1 ? ` · ${step.crafts} batches` : ""}${step.outputCount > step.amount ? ` · yields ${step.outputCount}` : ""}</td><td>${escapeHtml(step.recipe.station)}</td><td>${step.recipe.ingredients.map((ingredient) => `${escapeHtml(ingredient.item)} ×${Number(ingredient.count) * step.crafts}`).join(", ")}</td><td><a href="${escapeHtml(step.item.source.permanentUrl)}" rel="noopener noreferrer">rev ${step.item.source.revisionId}</a></td></tr>`).join("");
    const rawList = [...raw.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `<li><strong>${escapeHtml(name)}</strong> ×${escapeHtml(count)}</li>`).join("");
    return `<section class="ledger"><div class="section-heading section-heading--row"><div><p class="eyebrow">Loadout target</p><h2>${escapeHtml(target.title)}</h2></div><ul class="raw-list" aria-label="Raw material total">${rawList}</ul></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Step</th><th>Craft</th><th>Station</th><th>Inputs</th><th>Source</th></tr></thead><tbody>${stepRows}</tbody></table></div></section>`;
  }).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Recipe dependency graph · Wiki-backed</p><h1>Starter crafting<br><em>planner.</em></h1><p class="lede">Exact dependency chains and raw-material totals for five useful equipment targets. Steps are computed from the imported primary recipe, not written by AI.</p></section><section class="evidence-note"><p class="eyebrow">Reading the planner</p><h2>Craft bottom-up; gather the listed raw total first</h2><p>“Step” is dependency order only. It does not claim unlock timing, biome route, or the best gameplay priority. Where an item has alternate recipes, this planner deliberately uses the first Wiki recipe and the item page shows every alternative.</p></section>${sections}`;
  return layout({ title: "Subnautica 2 starter crafting planner | Evidence Guide", description: "Source-linked dependency chains and raw material totals for Subnautica 2 starter equipment.", canonical: "https://specialzhou.github.io/subnautica-2-guide/starter-planner.html", body });
}

function equipmentUpgrades(items) {
  const byTitle = new Map(items.map((item) => [item.title, item]));
  const chains = [
    { label: "Air tanks", titles: ["Standard Air Tank", "High Capacity Air Tank", "Ultra High Capacity Air Tank"] },
    { label: "Fins", titles: ["Basic Fins", "Improved Fins"] },
    { label: "Scanners", titles: ["Scanner", "Bioscanner"] },
  ];
  const sections = chains.map((chain) => {
    const records = chain.titles.map((title) => byTitle.get(title)).filter(Boolean);
    const rows = records.map((item, index) => {
      const recipe = item.recipes[0];
      const predecessor = index ? chain.titles[index - 1] : null;
      const predecessorIngredient = recipe.ingredients.find((ingredient) => ingredient.item === predecessor);
      const additional = recipe.ingredients.filter((ingredient) => ingredient.item !== predecessor).map((ingredient) => `${ingredient.item} ×${ingredient.count}`).join(", ");
      const relationship = predecessor ? (predecessorIngredient ? `<a href="guide/items/${slugify(predecessor)}.html">${escapeHtml(predecessor)}</a> ×${escapeHtml(predecessorIngredient.count)}` : "No direct predecessor in recipe") : "Base recipe";
      return `<tr><td>${index + 1}</td><td><a href="guide/items/${item.id}.html">${escapeHtml(item.title)}</a></td><td>${relationship}</td><td>${escapeHtml(additional || "None")}</td><td>${escapeHtml(recipe.station)}</td><td><a href="${escapeHtml(item.source.permanentUrl)}" rel="noopener noreferrer">rev ${item.source.revisionId}</a></td></tr>`;
    }).join("");
    return `<section class="ledger"><div class="section-heading"><p class="eyebrow">Recipe-linked chain</p><h2>${escapeHtml(chain.label)}</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Tier</th><th>Result</th><th>Required prior item</th><th>Additional inputs</th><th>Station</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Direct recipe dependencies · Wiki-backed</p><h1>Equipment<br><em>upgrade chains.</em></h1><p class="lede">Three upgrade paths derived only when a later recipe explicitly consumes the earlier equipment.</p></section><section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>Dependency is proven; unlock timing is not</h2><p>The tier order below follows direct recipe inputs. It does not claim when blueprints unlock, which upgrade is optimal, or where to gather materials.</p></section>${sections}`;
  return layout({ title: "Subnautica 2 equipment upgrade chains | Evidence Guide", description: "Source-linked Subnautica 2 air tank, fins, and scanner upgrade dependencies derived from Wiki recipes.", canonical: "https://specialzhou.github.io/subnautica-2-guide/equipment-upgrades.html", body });
}

function blueprintChecklist(items) {
  const fragmentItems = items.filter((item) => item.unlock.fragments).sort((a, b) => a.title.localeCompare(b.title));
  const rows = fragmentItems.map((item) => `<tr><td><a href="guide/items/${item.id}.html">${escapeHtml(item.title)}</a></td><td>${item.unlock.fragments}</td><td>${escapeHtml(item.unlock.biomes.join(", ") || "Not recorded in infobox")}</td><td>${escapeHtml(item.unlock.source || "Not recorded")}</td><td><a href="${escapeHtml(item.source.permanentUrl)}" rel="noopener noreferrer">rev ${item.source.revisionId}</a></td></tr>`).join("");
  const defaultItems = items.filter((item) => item.availableByDefault).sort((a, b) => a.title.localeCompare(b.title));
  const defaultLinks = defaultItems.map((item) => `<li><a href="guide/items/${item.id}.html">${escapeHtml(item.title)}</a></li>`).join("");
  const body = `<section class="entity-hero"><p class="eyebrow">Structured unlock fields · Wiki-backed</p><h1>Blueprint<br><em>checklist.</em></h1><p class="lede">A fragment checklist generated from item infoboxes, plus recipes explicitly marked available at game start.</p></section><section class="recipe-block"><div class="recipe-block__heading"><p class="eyebrow">Available by default</p><h2>${defaultItems.length} recipes</h2></div><ul class="entity-links">${defaultLinks}</ul></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Fragment unlocks</p><h2>${fragmentItems.length} documented blueprints</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Blueprint</th><th>Fragments</th><th>Infobox biome</th><th>Recorded source</th><th>Revision</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>This is a checklist, not a complete story progression</h2><p>Only structured infobox fields and explicit “available at start” statements are included. Unlock descriptions found only in article prose remain excluded until a dedicated parser and review rule exist.</p></section>`;
  return layout({ title: "Subnautica 2 blueprint fragment checklist | Evidence Guide", description: "Source-linked Subnautica 2 blueprint fragment counts, recorded biomes, and default recipes.", canonical: "https://specialzhou.github.io/subnautica-2-guide/blueprints.html", body });
}

function sitemap(items, generatedAt) {
  const fixedPages = [
    ["", "1.0", generatedAt.slice(0, 10)],
    ["crafting.html", "0.9", generatedAt.slice(0, 10)],
    ["sources.html", "0.8", generatedAt.slice(0, 10)],
  ];
  const urls = fixedPages.map(([page, priority, lastModified]) => `  <url><loc>https://specialzhou.github.io/subnautica-2-guide/${page}</loc><lastmod>${lastModified}</lastmod><priority>${priority}</priority></url>`);
  urls.push(...items.map((item) => `  <url><loc>https://specialzhou.github.io/subnautica-2-guide/guide/items/${item.id}.html</loc><lastmod>${item.source.revisionTimestamp.slice(0, 10)}</lastmod><priority>0.7</priority></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

async function updateLedger(published, excluded, generatedAt) {
  const ledgerPath = path.join(root, "data", "ledger.json");
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  ledger.tracker.lastReview = generatedAt.slice(0, 10);
  ledger.tracker.wikiBackedEntries = published.length;
  ledger.tracker.inReview = excluded.length;
  ledger.tracker.withdrawnPages = 1;
  ledger.reviewQueue = [
    { category: "Progression guides", requirement: "Build oxygen, base, and co-op guidance from structured records and official patch context." },
    { category: "In-game sampling", requirement: "Promote high-traffic recipes and routes after capture against an exact game build." },
    { category: "Incremental updates", requirement: "Compare Wiki revision IDs and rebuild only records changed after patches." },
  ];
  ledger.sourceRegistry = ledger.sourceRegistry.filter((source) => !["community-leads", "official-wiki"].includes(source.id));
  ledger.sourceRegistry.unshift({
    id: "official-wiki",
    name: "Official, community-maintained Subnautica 2 Wiki",
    type: "Structured baseline",
    url: "https://wiki.subnautica.com/sn2/",
    allowedUse: "Structured facts are imported with permanent revision links. Article prose and images are not copied. Wiki-backed is distinct from in-game verified.",
    lastChecked: generatedAt.slice(0, 10),
    license,
  });
  for (const source of ledger.sourceRegistry) {
    if (source.id === "official-steam-listing") source.url = "https://store.steampowered.com/app/1962700/Subnautica_2/";
    if (source.id === "official-steam-news") source.url = "https://store.steampowered.com/news/app/1962700";
    if (source.id === "in-game-capture") source.allowedUse = "Required to promote a Wiki-backed gameplay fact to in-game verified. Must include the exact game build.";
  }
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

async function main() {
  const checkedAt = new Date().toISOString();
  const dataPath = path.join(root, "data", "wiki-items.json");
  const previousData = await readJsonIfExists(dataPath);
  const previousById = new Map((previousData?.items ?? []).map((item) => [item.id, item]));
  const titleLists = await Promise.all(craftingCategories.map(categoryMembers));
  const titles = [...new Set(titleLists.flat())].sort((a, b) => a.localeCompare(b));
  const pages = await fetchPages(titles);
  const items = pages.map(normalizePage).filter(Boolean).map((item) => {
    const previous = previousById.get(item.id);
    if (previous?.source.revisionId === item.source.revisionId) item.source.fetchedAt = previous.source.fetchedAt;
    return item;
  }).sort((a, b) => a.title.localeCompare(b.title));
  const revisionsChanged = !previousData || items.length !== previousData.items.length || items.some((item) => {
    const previous = previousById.get(item.id);
    return !previous || previous.source.revisionId !== item.source.revisionId || previous.status !== item.status;
  });
  const changedItems = previousData ? [
    ...items.flatMap((item) => { const previous = previousById.get(item.id); return !previous || previous.source.revisionId !== item.source.revisionId || previous.status !== item.status ? [{ id: item.id, title: item.title, change: previous ? "updated" : "added", previousRevisionId: previous?.source.revisionId ?? null, revisionId: item.source.revisionId, previousStatus: previous?.status ?? null, status: item.status }] : []; }),
    ...previousData.items.filter((previous) => !items.some((item) => item.id === previous.id)).map((previous) => ({ id: previous.id, title: previous.title, change: "removed", previousRevisionId: previous.source.revisionId, revisionId: null, previousStatus: previous.status, status: null })),
  ] : [];
  const generatedAt = revisionsChanged ? checkedAt : previousData.generatedAt;
  const published = items.filter((item) => item.status === "wiki-backed");
  const excluded = items.filter((item) => item.status === "excluded");

  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(path.join(root, "guide", "items"), { recursive: true });
  const generatedDirectory = path.join(root, "guide", "items");
  const oldGeneratedFiles = await readdir(generatedDirectory);
  await Promise.all(oldGeneratedFiles.filter((file) => file.endsWith(".html")).map((file) => unlink(path.join(generatedDirectory, file))));
  await writeFile(dataPath, `${JSON.stringify({ schemaVersion: "1.0.0", generatedAt, source: apiEndpoint, license, categories: craftingCategories, publishedCount: published.length, excludedCount: excluded.length, items }, null, 2)}\n`);
  if (changedItems.length) await writeFile(path.join(root, "data", "wiki-change-report.json"), `${JSON.stringify({ schemaVersion: "1.0.0", detectedAt: checkedAt, changes: changedItems }, null, 2)}\n`);
  const publishedIds = new Set(published.map((item) => item.id));
  await Promise.all(published.map((item) => writeFile(path.join(root, "guide", "items", `${item.id}.html`), itemPage(item, publishedIds))));
  await writeFile(path.join(root, "crafting.html"), craftingIndex(published, generatedAt));
  await writeFile(path.join(root, "starter-planner.html"), starterPlanner(published));
  await writeFile(path.join(root, "equipment-upgrades.html"), equipmentUpgrades(published));
  await writeFile(path.join(root, "blueprints.html"), blueprintChecklist(published));
  const oxygenItems = published.filter((item) => /air tank|rebreather|oxygen|air bladder/i.test(item.title));
  const habitatItems = published.filter((item) => item.recipes.some((recipe) => recipe.station === "Habitat Builder"));
  await writeFile(path.join(root, "oxygen.html"), topicIndex({ title: "Oxygen", kicker: "Survival equipment", description: `${oxygenItems.length} oxygen-related equipment records selected from the imported crafting dataset.`, items: oxygenItems, canonical: "https://specialzhou.github.io/subnautica-2-guide/oxygen.html", emptyMessage: "No ingredients listed" }));
  await writeFile(path.join(root, "base-building.html"), topicIndex({ title: "Base building", kicker: "Habitat Builder catalog", description: `${habitatItems.length} construction records whose Wiki recipe names Habitat Builder as the station.`, items: habitatItems, canonical: "https://specialzhou.github.io/subnautica-2-guide/base-building.html", emptyMessage: "No ingredients listed" }));
  await writeFile(path.join(root, "sitemap.xml"), sitemap(published, generatedAt));
  await updateLedger(published, excluded, generatedAt);
  process.stdout.write(`Imported ${items.length} recipe pages: ${published.length} published, ${excluded.length} excluded, revisions ${revisionsChanged ? "changed" : "unchanged"}.\n`);
}

await main();
