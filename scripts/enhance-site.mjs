import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "/subnautica-2-guide/";
const items = JSON.parse(await readFile(path.join(root, "data/wiki-items.json"), "utf8"));
const entities = JSON.parse(await readFile(path.join(root, "data/wiki-entities.json"), "utf8"));
const media = JSON.parse(await readFile(path.join(root, "data/media.json"), "utf8"));
const playerQuestions = JSON.parse(await readFile(path.join(root, "data/player-questions.json"), "utf8"));
const localizedNames = JSON.parse(await readFile(path.join(root, "data/localized-names.json"), "utf8")).names;
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
const guideTitles = {
  "Start here": { "zh-cn": "开局攻略", ru: "Начало игры" },
  "Find starter materials": { "zh-cn": "寻找开局材料", ru: "Поиск начальных материалов" },
  "Blueprint checklist": { "zh-cn": "蓝图清单", ru: "Список чертежей" },
  "Equipment upgrades": { "zh-cn": "装备升级", ru: "Улучшения снаряжения" },
  "Tadpole vehicle planner": { "zh-cn": "蝌蚪号载具规划", ru: "План транспорта «Головастик»" },
  "Key locations": { "zh-cn": "关键地点", ru: "Ключевые места" },
  "Base building": { "zh-cn": "基地建造", ru: "Строительство базы" },
  "Co-op reference": { "zh-cn": "联机参考", ru: "Кооператив" },
};

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
const nameEntries = Object.entries(localizedNames).sort(([a], [b]) => b.length - a.length);
const recordIndex = [...guides, ...searchItems, ...searchEntities].map((entry) => {
  const localizedTitles = guideTitles[entry.title] ?? {
    "zh-cn": localizedNames[entry.title]?.["zh-cn"],
    ru: localizedNames[entry.title]?.ru,
  };
  const searchable = `${entry.title} ${entry.terms}`;
  const localizedTerms = { "zh-cn": [], ru: [] };
  for (const [english, translations] of nameEntries) {
    if (!searchable.toLocaleLowerCase().includes(english.toLocaleLowerCase())) continue;
    localizedTerms["zh-cn"].push(translations["zh-cn"]);
    localizedTerms.ru.push(translations.ru);
  }
  return {
    ...entry,
    image: imageByTitle.get(entry.title) ?? null,
    localizedTitles,
    localizedTerms: { "zh-cn": localizedTerms["zh-cn"].join(" "), ru: localizedTerms.ru.join(" ") },
  };
});
const questionIndex = playerQuestions.questions.map((question) => ({
  title: question.question.en,
  type: "Question",
  href: `questions.html#${question.id}`,
  terms: `${question.searchTerms.en} ${question.answer.en} ${question.buildContext} ${question.category}`,
  image: null,
  localizedTitles: { "zh-cn": question.question["zh-cn"], ru: question.question.ru },
  localizedTerms: {
    "zh-cn": `${question.searchTerms["zh-cn"]} ${question.answer["zh-cn"]}`,
    ru: `${question.searchTerms.ru} ${question.answer.ru}`,
  },
  answer: question.answer.en,
  localizedAnswers: { "zh-cn": question.answer["zh-cn"], ru: question.answer.ru },
  resolution: question.resolution,
  featuredRank: question.featuredRank,
  attention: { upvotes: question.source.upvotes, comments: question.source.comments, approximate: question.source.approximate },
}));
const index = [...recordIndex, ...questionIndex];
const generatedAt = new Date(Math.max(new Date(items.generatedAt).getTime(), new Date(entities.generatedAt).getTime(), new Date(playerQuestions.collectedAt).getTime())).toISOString();
const coverage = {
  total: items.publishedCount + entities.publishedCount,
  crafting: items.publishedCount,
  resources: entities.counts.resources,
  creatures: entities.counts.creatures,
  biomes: entities.counts.biomes,
};
await writeFile(path.join(root, "data/search-index.json"), `${JSON.stringify({ generatedAt, count: index.length, entries: index }, null, 2)}\n`);

const questionCopy = {
  en: { kicker: "Live player problems", title: "Answers players need right now", all: "Browse all player questions", solved: "Solved", partial: "Partial", open: "Open", comments: "comments", placeholder: "Where is the blueprint? Why won't it craft? Ask a player problem…" },
  "zh-cn": { kicker: "实时玩家痛点", title: "玩家现在最需要的答案", all: "查看全部玩家问题", solved: "已解决", partial: "部分解决", open: "仍待解决", comments: "条评论", placeholder: "蓝图在哪里？为什么无法制造？直接搜索玩家问题…" },
  ru: { kicker: "Проблемы игроков", title: "Ответы, которые нужны игрокам сейчас", all: "Все вопросы игроков", solved: "Решено", partial: "Частично", open: "Открыто", comments: "комментариев", placeholder: "Где чертёж? Почему не создаётся? Найдите проблему…" },
};
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const featuredQuestions = playerQuestions.questions.filter((question) => Number.isInteger(question.featuredRank)).sort((a, b) => a.featuredRank - b.featuredRank);
const questionStatus = (question, locale) => questionCopy[locale][question.resolution];
const questionMetrics = (question, locale) => `↑ ${question.source.upvotes} · ${question.source.comments} ${questionCopy[locale].comments}`;
const homepageQuestionSection = (locale) => {
  const copy = questionCopy[locale];
  const [lead, ...rest] = featuredQuestions;
  return `<section class="player-pain-section" aria-labelledby="player-pain-title"><div class="player-pain__heading"><div><p class="eyebrow">${copy.kicker} · ${playerQuestions.questions.length}</p><h2 id="player-pain-title">${copy.title}</h2></div><a href="questions.html">${copy.all} →</a></div><div class="player-pain__grid"><a class="pain-feature" href="questions.html#${lead.id}"><span class="pain-status pain-status--${lead.resolution}">${questionStatus(lead, locale)}</span><div><h3>${escapeHtml(lead.question[locale])}</h3><p class="pain-feature__answer">${escapeHtml(lead.answer[locale])}</p></div><span class="pain-meta"><span>Reddit</span><span>${questionMetrics(lead, locale)}</span><span>${lead.buildContext}</span></span></a><div class="pain-stack">${rest.map((question) => `<a class="pain-row" href="questions.html#${question.id}"><div><span class="pain-status pain-status--${question.resolution}">${questionStatus(question, locale)}</span><h3>${escapeHtml(question.question[locale])}</h3></div><p>${escapeHtml(question.answer[locale])}</p><span class="pain-row__arrow" aria-hidden="true">→</span><span class="pain-meta"><span>${questionMetrics(question, locale)}</span><span>${question.buildContext}</span></span></a>`).join("")}</div></div></section>`;
};
const homepageQuickLinks = (locale) => `<div class="quick-links">${featuredQuestions.slice(0, 3).map((question) => `<a href="questions.html#${question.id}">${escapeHtml(question.question[locale])} <span>→</span></a>`).join("")}</div>`;

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
    .replace(new RegExp(`<link rel="stylesheet" href="${base}search\\.css(?:\\?v=\\d+)?">`, "g"), "")
    .replace(new RegExp(`<link rel="stylesheet" href="${base}questions\\.css(?:\\?v=\\d+)?">`, "g"), "")
    .replace(new RegExp(`<script defer src="${base}search\\.js(?:\\?v=\\d+)?"></script>`, "g"), "")
    .replace(/<button class="global-search-trigger"[^>]*>.*?<\/button>/, "")
    .replace(/<section class="player-pain-section"[\s\S]*?<\/section>/, "")
    .replace(/<(figure|div) class="record-media[^"]*"[^>]*>.*?<\/\1>/s, "");
  const locale = pagePath.match(/^(en|zh-cn|ru)\//)?.[1] ?? "en";
  const searchCopy = locale === "zh-cn" ? "搜索" : locale === "ru" ? "Поиск" : "Search";
  html = html.replace("</head>", `<link rel="stylesheet" href="${base}questions.css?v=1"><link rel="stylesheet" href="${base}search.css?v=4"></head>`);
  html = html.replace("</nav>", `<button class="global-search-trigger" type="button" aria-label="${searchCopy}"><span aria-hidden="true">⌕</span><span>${searchCopy}</span><kbd>/</kbd></button></nav>`);
  const unlocalizedPath = pagePath.replace(/^(en|zh-cn|ru)\//, "");
  if (unlocalizedPath === "index.html") {
    html = html.replace(/<div class="quick-links">[\s\S]*?<\/div>/, homepageQuickLinks(locale));
    html = html.replace(/(<input data-global-search type="search" placeholder=")[^"]+(" autocomplete="off">)/, `$1${questionCopy[locale].placeholder}$2`);
    html = html.replace(/(<section class="guide-hero"[\s\S]*?<\/section>)/, `$1${homepageQuestionSection(locale)}`);
    html = html.replace(/(<div class="notice"[^>]*><div class="shell notice__inner"><span[^>]*><\/span>)\d+/, `$1${coverage.total}`);
    html = html.replace(/(<dd id="wiki-count">)\d+/, `$1${coverage.total}`);
    for (const [href, count] of [["crafting.html", coverage.crafting], ["resources.html", coverage.resources], ["creatures.html", coverage.creatures], ["biomes.html", coverage.biomes]]) {
      html = html.replace(new RegExp(`(<a href="${href}"><span>)\\d+`), `$1${count}`);
    }
  }
  const image = imageByPage.get(unlocalizedPath);
  if (/<article class="entity-hero">/.test(html)) html = html.replace(/(<article class="entity-hero">.*?<p class="lede">.*?<\/p>)/s, `$1${image ? mediaFigure(image, locale) : mediaUnavailable(locale)}`);
  html = html.replace("</body>", `<script defer src="${base}search.js?v=4"></script></body>`);
  await writeFile(filePath, html);
}

process.stdout.write(`Enhanced ${new Set(pagePaths).size} pages and indexed ${index.length} records.\n`);
