import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSitemapContents } from "./sitemap-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemap = await readSitemapContents(root);
const localeData = JSON.parse(await readFile(path.join(root, "data", "locales.json"), "utf8"));
const playerQuestions = JSON.parse(await readFile(path.join(root, "data", "player-questions.json"), "utf8"));
const failures = [];
const locales = localeData.locales;
const localeVariants = locales.map((locale) => ({ ...locale, pathPrefix: locale.code === "en" ? "" : `${locale.code}/` }));
const rootPages = [...sitemap.matchAll(/<loc>https:\/\/specialzhou\.github\.io\/subnautica-2-guide\/([^<]*)<\/loc>/g)].map((match) => match[1] || "index.html").filter((page) => !/^(en|zh-cn|ru)\//.test(page));

if (locales.map((locale) => locale.code).join(",") !== "en,zh-cn,ru") failures.push("Unexpected locale registry");
if (rootPages.length !== localeData.pageCountPerLocale) failures.push("Locale page count metadata mismatch");

for (const locale of localeVariants) {
  for (const page of rootPages) {
    const file = path.join(root, locale.pathPrefix, page);
    await access(file).catch(() => failures.push(`Missing localized page: ${locale.pathPrefix}${page}`));
    const html = await readFile(file, "utf8");
    if (!html.includes(`<html lang="${locale.htmlLang}">`)) failures.push(`Wrong html lang: ${locale.code}/${page}`);
    if (!html.includes(`rel="canonical" href="https://specialzhou.github.io/subnautica-2-guide/${locale.pathPrefix}${page === "index.html" ? "" : page}"`)) failures.push(`Wrong canonical: ${locale.code}/${page}`);
    for (const alternate of ["x-default", "en", "zh-CN", "ru"]) if (!html.includes(`hreflang="${alternate}"`)) failures.push(`Missing hreflang ${alternate}: ${locale.code}/${page}`);
    if (!html.includes(`href="/subnautica-2-guide/${locale.pathPrefix}${page === "index.html" ? "" : page}" aria-current="page"`)) failures.push(`Wrong active language: ${locale.code}/${page}`);
    if (/\/subnautica-2-guide\/(?:en|zh-cn|ru)\/(?:en|zh-cn|ru)\//.test(html)) failures.push(`Nested locale path: ${locale.code}/${page}`);
  }
}

const zh = await readFile(path.join(root, "zh-cn", "starter-planner.html"), "utf8");
for (const phrase of ["开局制作", "配方依赖图", "规划器说明", "简体中文"]) if (!zh.includes(phrase)) failures.push(`Chinese translation smoke test missing: ${phrase}`);
const zhHome = await readFile(path.join(root, "zh-cn", "index.html"), "utf8");
for (const phrase of ["按 / 搜索", "查看默认配方和已记录的碎片需求", "Wiki 图片", "不是本站的实机验证截图"]) if (!zhHome.includes(phrase)) failures.push(`Chinese homepage translation missing: ${phrase}`);
for (const phrase of ["Press / to search", "See default recipes and documented fragment requirements.", "Unknown Worlds"] ) if (phrase === "Unknown Worlds" ? !zhHome.includes(phrase) : zhHome.includes(phrase)) failures.push(`Chinese homepage leakage or protected name failure: ${phrase}`);
if (!zhHome.includes('class="task-card task-card--wide" href="blueprints.html"')) failures.push("Blueprint task does not fill the desktop grid");
if ((zhHome.match(/class="task-card[^>]*"[^>]*>[\s\S]*?<img /g) || []).length !== 6) failures.push("Chinese homepage does not show six illustrated tasks");
const zhScanner = await readFile(path.join(root, "zh-cn", "guide", "items", "scanner.html"), "utf8");
for (const phrase of ["扫描仪（Scanner）", "装配台（Fabricator）", "钛（Titanium）", "Wiki 图片", "非实机验证截图"]) if (!zhScanner.includes(phrase)) failures.push(`Chinese detail translation missing: ${phrase}`);
if (zhScanner.includes("未知 Worlds")) failures.push("Company name was partially translated");
if (zhScanner.includes("类型=\"") || !zhScanner.includes('type="image/svg+xml"')) failures.push("HTML type attribute was translated");
const searchScript = await readFile(path.join(root, "search.js"), "utf8");
for (const phrase of ['Guide: "攻略"', 'Question: "玩家问题"', 'Item: "物品"', 'entry.localizedTitles?.[locale]', 'entry.localizedTerms?.[locale]', 'entry.localizedAnswers?.[locale]', 'entry.type === "Guide"', 'entry.type === "Question"']) if (!searchScript.includes(phrase)) failures.push(`Localized search behavior missing: ${phrase}`);
if (searchScript.includes('<small lang="en">${entry.title}</small>')) failures.push("Localized search still renders a separate English subtitle");
const ru = await readFile(path.join(root, "ru", "starter-planner.html"), "utf8");
for (const phrase of ["Начальный крафт", "Граф зависимостей рецептов", "Как читать план", "Русский"]) if (!ru.includes(phrase)) failures.push(`Russian translation smoke test missing: ${phrase}`);
const ruHome = await readFile(path.join(root, "ru", "index.html"), "utf8");
for (const phrase of ["Нажмите / для поиска", "Просмотр стартовых рецептов", "Scanner_Station.png", "task-card--scene"]) if (!ruHome.includes(phrase)) failures.push(`Russian homepage translation or image missing: ${phrase}`);
for (const phrase of ["Find a recipe, material", "Search the complete guide", "Current coverage", "These are reference images"]) if (ruHome.includes(phrase)) failures.push(`Russian homepage template leakage: ${phrase}`);
const ruScanner = await readFile(path.join(root, "ru", "guide", "items", "scanner.html"), "utf8");
for (const phrase of ["Запись рецепта", "Что означает этот статус", "Изображение Wiki"]) if (!ruScanner.includes(phrase)) failures.push(`Russian detail translation missing: ${phrase}`);
for (const phrase of ["Crafting record", "This record reproduces", "What this status means"]) if (ruScanner.includes(phrase)) failures.push(`Russian detail template leakage: ${phrase}`);
const zhQuestions = await readFile(path.join(root, "zh-cn", "questions.html"), "utf8");
const ruQuestions = await readFile(path.join(root, "ru", "questions.html"), "utf8");
for (const phrase of ["玩家真正卡住的地方", "当前答案", "证据边界", "关注度快照", "不杀水蛞蝓也能制作水吗？"]) if (!zhQuestions.includes(phrase)) failures.push(`Chinese player question page missing: ${phrase}`);
for (const phrase of ["Где игроки действительно застревают", "Текущий ответ", "Граница доказательств", "Снимок внимания"]) if (!ruQuestions.includes(phrase)) failures.push(`Russian player question page missing: ${phrase}`);
for (const [locale, html] of [["zh-cn", zhQuestions], ["ru", ruQuestions]]) for (const question of playerQuestions.questions) if (!html.includes(`id="${question.id}"`)) failures.push(`${locale} player question missing: ${question.id}`);
const zhLocations = await readFile(path.join(root, "zh-cn", "locations.html"), "utf8");
const ruLocations = await readFile(path.join(root, "ru", "locations.html"), "utf8");
for (const [locale, html, note] of [["zh-cn", zhLocations, "避免臆造翻译"], ["ru", ruLocations, "нет проверенного перевода"]]) {
  if ((html.match(/class="location-thumb"/g) || []).length < 8) failures.push(`${locale} locations index lacks biome thumbnails`);
  if (!html.includes(note)) failures.push(`${locale} locations index lacks proper-name policy`);
}
const searchIndex = JSON.parse(await readFile(path.join(root, "data", "search-index.json"), "utf8"));
const searchImageCount = searchIndex.entries.filter((entry) => entry.image).length;
if (searchImageCount < Math.floor(searchIndex.entries.length * 0.5)) failures.push("Search image coverage fell below 50%");
const questionSearchEntries = searchIndex.entries.filter((entry) => entry.type === "Question");
if (questionSearchEntries.length !== playerQuestions.questions.length) failures.push("Player questions are missing from search index");
if (!questionSearchEntries.every((entry) => entry.answer && entry.localizedAnswers?.["zh-cn"] && entry.localizedAnswers?.ru && entry.attention)) failures.push("Question search results lack answers or attention data");
if (!questionSearchEntries.every((entry) => /^questions\/[a-z0-9-]+\.html$/.test(entry.href))) failures.push("Question search results do not use independent landing pages");
for (const question of playerQuestions.questions) {
  for (const [locale, phrase] of [["zh-cn", question.question["zh-cn"]], ["ru", question.question.ru]]) {
    const detail = await readFile(path.join(root, locale, "questions", `${question.id}.html`), "utf8");
    if (!detail.includes(phrase) || !detail.includes('"@type":"Article"')) failures.push(`Localized question detail is incomplete: ${locale}/${question.id}`);
  }
}
const itemData = JSON.parse(await readFile(path.join(root, "data", "wiki-items.json"), "utf8"));
const entityData = JSON.parse(await readFile(path.join(root, "data", "wiki-entities.json"), "utf8"));
const localizedNames = JSON.parse(await readFile(path.join(root, "data", "localized-names.json"), "utf8").catch(() => "{\"names\":{}}"));
const recordNames = [...new Set([
  ...itemData.items.filter((item) => item.status === "wiki-backed").map((item) => item.title),
  ...entityData.entities.filter((entity) => entity.status === "wiki-backed").map((entity) => entity.title),
])];
for (const name of recordNames) {
  for (const locale of ["zh-cn", "ru"]) {
    if (!localizedNames.names?.[name]?.[locale] || localizedNames.names[name][locale] === name) failures.push(`Missing localized record name: ${locale}/${name}`);
  }
}
for (const entry of searchIndex.entries) {
  for (const locale of ["zh-cn", "ru"]) {
    if (!entry.localizedTitles?.[locale]) failures.push(`Search entry lacks localized title: ${locale}/${entry.title}`);
  }
}
const zhCrafting = await readFile(path.join(root, "zh-cn", "crafting.html"), "utf8");
const ruCrafting = await readFile(path.join(root, "ru", "crafting.html"), "utf8");
if (!zhCrafting.includes("酒精（Alcohol）")) failures.push("Chinese crafting list does not localize Alcohol");
if (!ruCrafting.includes("Спирт (Alcohol)")) failures.push("Russian crafting list does not localize Alcohol");
for (const [locale, html] of [["zh-cn", zhCrafting], ["ru", ruCrafting]]) {
  for (const phrase of [">Basic ", ">Modification 站", ">Modification Станция", "alternate recipe", ">Vehicle 制造", ">Транспорт Fabricator"]) {
    if (html.includes(phrase)) failures.push(`Mixed-language crafting label: ${locale}/${phrase}`);
  }
}
const guideCss = await readFile(path.join(root, "guide.css"), "utf8");
const genericTaskImage = guideCss.lastIndexOf(".task-card img{");
const sceneTaskImage = guideCss.lastIndexOf(".task-card.task-card--scene img{");
if (sceneTaskImage < genericTaskImage || !guideCss.slice(sceneTaskImage, sceneTaskImage + 140).includes("width:100%;height:100%;object-fit:cover")) failures.push("Homepage scene image can be overridden by generic task image sizing");
if (!guideCss.includes(".task-card.task-card--tall{grid-row:span 1!important}")) failures.push("Desktop Tadpole card still creates an empty grid row");
for (const locale of localeVariants) {
  const home = await readFile(path.join(root, locale.pathPrefix, "index.html"), "utf8");
  for (const count of [itemData.publishedCount + entityData.publishedCount, itemData.publishedCount, entityData.counts.resources, entityData.counts.creatures, entityData.counts.biomes]) if (!home.includes(`>${count}<`)) failures.push(`Stale homepage coverage count: ${locale.code}/${count}`);
}
for (const locale of localeVariants) {
  for (const page of rootPages.filter((entry) => entry.startsWith("guide/"))) {
    const html = await readFile(path.join(root, locale.pathPrefix, page), "utf8");
    if (!html.includes('class="record-media')) failures.push(`Missing media or explicit fallback: ${locale.code}/${page}`);
  }
}
for (const page of rootPages) {
  const html = await readFile(path.join(root, "zh-cn", page), "utf8");
  for (const phrase of ["来源-linked", "分类ed", "re来源", "un来源"]) if (html.includes(phrase)) failures.push(`Broken Chinese mixed translation in ${page}: ${phrase}`);
}
const functionalLeakPhrases = [
  "Exact dependency chains and raw-material totals",
  "A fragment checklist generated from item infoboxes",
  "Where the structured Wiki fields say",
  "Three upgrade paths derived only when",
  "Vehicle-related structures and core",
  "What this page does not claim",
  "Confirmed multiplayer facts from the official",
  "A revision-linked index of the current",
  "Evidence policy active from",
  "Wiki-backed facts include a permanent revision link",
];
for (const locale of ["zh-cn", "ru"]) {
  for (const page of rootPages.filter((entry) => !entry.startsWith("guide/"))) {
    const html = await readFile(path.join(root, locale, page), "utf8");
    for (const phrase of functionalLeakPhrases) if (html.includes(phrase)) failures.push(`Untranslated functional copy: ${locale}/${page}/${phrase}`);
    if (html.includes('class="global-search-trigger" type="button" aria-label="Search this guide"')) failures.push(`Server-rendered search control is English: ${locale}/${page}`);
  }
}

const expectedSitemapUrls = rootPages.length * locales.length;
if ((sitemap.match(/<url>/g) || []).length !== expectedSitemapUrls) failures.push("Localized sitemap URL count mismatch");
if ((sitemap.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length !== expectedSitemapUrls) failures.push("Localized sitemap lastmod coverage mismatch");

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Checked ${rootPages.length} pages across ${locales.length} locales and ${expectedSitemapUrls} sitemap URLs.\n`);
}
