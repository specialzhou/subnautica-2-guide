import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pathBase = "/subnautica-2-guide/";
const siteBase = "https://specialzhou.github.io/subnautica-2-guide/";
const data = JSON.parse(await readFile(path.join(root, "data", "player-questions.json"), "utf8"));

const locales = {
  en: {
    htmlLang: "en",
    label: "English",
    copy: {
      title: "Player problems — Subnautica 2 Guide",
      description: "Real Subnautica 2 player questions, attention counts, current answers, and evidence boundaries.",
      kicker: "Player problem library",
      heading: "What players are actually stuck on",
      lede: "Questions are collected from public community discussions. Vote and comment counts are snapshots, and every answer states whether it is solved, partial, or still open.",
      search: "Search",
      nav: ["Start", "Crafting", "Resources", "Creatures", "Vehicles", "Biomes"],
      status: { solved: "Solved", partial: "Partial", open: "Open" },
      answer: "Current answer",
      evidence: "Evidence boundary",
      attention: "Attention snapshot",
      votes: "upvotes",
      comments: "comments",
      observed: "observed",
      source: "Open Reddit discussion",
      related: "Related guide records",
      footer: "Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.",
      method: "Sources & methodology"
    }
  },
  "zh-cn": {
    htmlLang: "zh-CN",
    label: "简体中文",
    copy: {
      title: "玩家问题库 — Subnautica 2 攻略",
      description: "收集真实的 Subnautica 2 玩家问题、关注数、当前答案和证据边界。",
      kicker: "玩家问题库",
      heading: "玩家真正卡住的地方",
      lede: "问题来自公开社区讨论。点赞与评论数是采集时快照；每条答案都会标明已解决、部分解决或仍待解决。",
      search: "搜索",
      nav: ["开局", "制作", "资源", "生物", "载具", "生态区"],
      status: { solved: "已解决", partial: "部分解决", open: "仍待解决" },
      answer: "当前答案",
      evidence: "证据边界",
      attention: "关注度快照",
      votes: "赞",
      comments: "条评论",
      observed: "采集于",
      source: "查看 Reddit 原讨论",
      related: "相关攻略资料",
      footer: "玩家制作，与 Unknown Worlds Entertainment 或 Krafton 无关联。",
      method: "来源与方法"
    }
  },
  ru: {
    htmlLang: "ru",
    label: "Русский",
    copy: {
      title: "Вопросы игроков — гайд Subnautica 2",
      description: "Реальные вопросы игроков Subnautica 2, показатели внимания, ответы и границы доказательств.",
      kicker: "Библиотека проблем игроков",
      heading: "Где игроки действительно застревают",
      lede: "Вопросы собраны из открытых обсуждений. Голоса и комментарии — снимок на дату сбора; каждый ответ помечен как решённый, частичный или открытый.",
      search: "Поиск",
      nav: ["Начало", "Крафт", "Ресурсы", "Существа", "Транспорт", "Биомы"],
      status: { solved: "Решено", partial: "Частично", open: "Открыто" },
      answer: "Текущий ответ",
      evidence: "Граница доказательств",
      attention: "Снимок внимания",
      votes: "голосов",
      comments: "комментариев",
      observed: "собрано",
      source: "Открыть обсуждение Reddit",
      related: "Связанные записи гайда",
      footer: "Фанатский проект, не связан с Unknown Worlds Entertainment или Krafton.",
      method: "Источники и методика"
    }
  }
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const localePrefix = (locale) => locale === "root" ? pathBase : `${pathBase}${locale}/`;
const localeCode = (locale) => locale === "root" ? "en" : locale;
const questionUrl = (locale) => locale === "root" ? `${siteBase}questions.html` : `${siteBase}${locale}/questions.html`;
const homeUrl = (locale) => locale === "root" ? pathBase : `${pathBase}${locale}/`;

const categoryLabels = {
  crafting: { en: "Crafting", "zh-cn": "制作", ru: "Крафт" },
  "base-building": { en: "Base building", "zh-cn": "基地建造", ru: "Строительство базы" },
  locations: { en: "Locations", "zh-cn": "地点", ru: "Локации" },
  "story-bug": { en: "Story bug", "zh-cn": "剧情故障", ru: "Сюжетный баг" },
  "bioscan-bug": { en: "Bioscan bug", "zh-cn": "生物扫描故障", ru: "Баг биосканирования" },
  blueprints: { en: "Blueprints", "zh-cn": "蓝图", ru: "Чертежи" },
  vehicles: { en: "Vehicles", "zh-cn": "载具", ru: "Транспорт" },
  "story-location": { en: "Story location", "zh-cn": "剧情地点", ru: "Сюжетная локация" },
  creatures: { en: "Creatures", "zh-cn": "生物", ru: "Существа" },
  crashes: { en: "Crash troubleshooting", "zh-cn": "崩溃排查", ru: "Диагностика вылетов" }
};

const relatedPageLabels = {
  "guide/items/water.html": { en: "Water", "zh-cn": "水", ru: "Вода" },
  "base-building.html": { en: "Base building", "zh-cn": "基地建造", ru: "Строительство базы" },
  "locations.html": { en: "Key locations", "zh-cn": "关键地点", ru: "Ключевые места" },
  "story.html": { en: "Story reference", "zh-cn": "剧情参考", ru: "Сюжет" },
  "guide/items/strong-acid.html": { en: "Strong Acid", "zh-cn": "强酸", ru: "Сильная кислота" },
  "equipment-upgrades.html": { en: "Equipment upgrades", "zh-cn": "装备升级", ru: "Улучшения снаряжения" },
  "guide/items/wall-rack.html": { en: "Wall Rack", "zh-cn": "墙壁挂架", ru: "Настенная стойка" },
  "blueprints.html": { en: "Blueprints", "zh-cn": "蓝图", ru: "Чертежи" },
  "guide/items/tadpole-scout-ray-chassis.html": { en: "Tadpole Scout Ray Chassis", "zh-cn": "蝌蚪号 Scout Ray 底盘", ru: "Шасси Scout Ray" },
  "vehicle-planner.html": { en: "Tadpole planner", "zh-cn": "蝌蚪号规划", ru: "План Головастика" },
  "guide/items/hanging-tailing-jar.html": { en: "Hanging Tailing Jar", "zh-cn": "悬挂式 Tailing 培养罐", ru: "Подвесная банка Tailing" },
  "guide/creatures/sandspear.html": { en: "Sandspear", "zh-cn": "潜沙矛（Sandspear）", ru: "Копейник (Sandspear)" }
};

function languageSwitcher(active) {
  const current = active === "root" ? "en" : active;
  return `<span class="language-switcher" aria-label="Language">${Object.entries(locales).map(([code, config]) => `<a href="${pathBase}${code}/questions.html"${code === current ? ' aria-current="page"' : ""}>${config.label}</a>`).join("")}</span>`;
}

function relatedLinks(question, locale) {
  const prefix = localePrefix(locale);
  const code = localeCode(locale);
  return question.relatedPages.map((href) => {
    const fallback = href.split("/").at(-1).replace(".html", "").replaceAll("-", " ");
    return `<a href="${prefix}${escapeHtml(href)}">${escapeHtml(relatedPageLabels[href]?.[code] ?? fallback)}</a>`;
  }).join("");
}

function questionArticle(question, locale, index) {
  const code = localeCode(locale);
  const copy = locales[code].copy;
  const status = copy.status[question.resolution];
  const category = categoryLabels[question.category]?.[code] ?? question.category;
  const related = relatedLinks(question, locale);
  return `<article class="question-record question-record--${question.resolution}" id="${escapeHtml(question.id)}">
    <div class="question-record__rail"><span>${String(index + 1).padStart(2, "0")}</span><span class="question-status question-status--${question.resolution}">${status}</span></div>
    <div class="question-record__body">
      <div class="question-record__heading"><div><p class="question-record__tags">${escapeHtml(category)} · ${escapeHtml(question.buildContext)}</p><h2>${escapeHtml(question.question[code])}</h2></div><dl class="question-attention" aria-label="${copy.attention}"><div><dt>↑</dt><dd>${question.source.upvotes}</dd></div><div><dt>↳</dt><dd>${question.source.comments}</dd></div></dl></div>
      <div class="question-record__answer"><p class="eyebrow">${copy.answer}</p><p>${escapeHtml(question.answer[code])}</p></div>
      <div class="question-record__evidence"><div><strong>${copy.evidence}</strong><p>${escapeHtml(question.evidenceNote[code])}</p></div><div><strong>${copy.attention}</strong><p>${question.source.upvotes} ${copy.votes} · ${question.source.comments} ${copy.comments} · ${copy.observed} ${question.source.observedAt}</p></div></div>
      <div class="question-record__links"><a href="${escapeHtml(question.source.url)}" rel="noopener noreferrer">${copy.source} →</a>${related ? `<span>${copy.related}: ${related}</span>` : ""}</div>
    </div>
  </article>`;
}

function renderPage(locale) {
  const code = localeCode(locale);
  const config = locales[code];
  const copy = config.copy;
  const prefix = localePrefix(locale);
  const sorted = [...data.questions].sort((a, b) => (b.source.upvotes + b.source.comments) - (a.source.upvotes + a.source.comments));
  const alternates = [`<link rel="alternate" hreflang="x-default" href="${siteBase}questions.html">`, ...Object.entries(locales).map(([entryCode, entry]) => `<link rel="alternate" hreflang="${entry.htmlLang}" href="${siteBase}${entryCode}/questions.html">`)].join("");
  const navHrefs = ["starter-planner.html", "crafting.html", "resources.html", "creatures.html", "vehicles.html", "biomes.html"];
  return `<!doctype html>
<html lang="${config.htmlLang}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${copy.title}</title><meta name="description" content="${copy.description}"><meta name="theme-color" content="#071d24">
  <link rel="canonical" href="${questionUrl(locale)}">${alternates}<link rel="icon" href="${pathBase}favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${pathBase}styles.css"><link rel="stylesheet" href="${pathBase}guide.css"><link rel="stylesheet" href="${pathBase}locale.css"><link rel="stylesheet" href="${pathBase}questions.css?v=1"><link rel="stylesheet" href="${pathBase}search.css?v=4">
</head>
<body class="questions-page">
  <a class="skip-link" href="#main-content">${code === "zh-cn" ? "跳到正文" : code === "ru" ? "К содержанию" : "Skip to content"}</a>
  <header class="site-header"><div class="shell nav-wrap"><a class="wordmark" href="${homeUrl(locale)}" aria-label="Subnautica 2 Guide home"><span class="wordmark__kicker">${copy.kicker} / 1962700</span><span>Subnautica 2<br>${code === "zh-cn" ? "证据攻略" : code === "ru" ? "Доказательный гайд" : "Guide"}</span></a><nav aria-label="Primary navigation">${navHrefs.map((href, index) => `<a href="${prefix}${href}">${copy.nav[index]}</a>`).join("")}${languageSwitcher(locale)}<button class="global-search-trigger" type="button" aria-label="${copy.search}"><span aria-hidden="true">⌕</span><span>${copy.search}</span><kbd>/</kbd></button></nav></div></header>
  <main id="main-content" class="shell">
    <section class="question-opening"><p class="eyebrow">${copy.kicker} · ${data.questions.length}</p><h1>${copy.heading}</h1><p class="lede">${copy.lede}</p><dl class="question-summary"><div><dt>${copy.status.solved}</dt><dd>${data.questions.filter((entry) => entry.resolution === "solved").length}</dd></div><div><dt>${copy.status.partial}</dt><dd>${data.questions.filter((entry) => entry.resolution === "partial").length}</dd></div><div><dt>${copy.status.open}</dt><dd>${data.questions.filter((entry) => entry.resolution === "open").length}</dd></div></dl></section>
    <section class="question-library" aria-label="${copy.heading}">${sorted.map((question, index) => questionArticle(question, locale, index)).join("\n")}</section>
  </main>
  <footer class="footer"><div class="shell footer__inner"><p>${copy.footer}</p><p><a href="${prefix}sources.html">${copy.method}</a></p></div></footer>
  <script src="${pathBase}app.js"></script><script defer src="${pathBase}search.js?v=4"></script>
</body></html>\n`;
}

for (const locale of ["root", ...Object.keys(locales)]) {
  const output = locale === "root" ? path.join(root, "questions.html") : path.join(root, locale, "questions.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderPage(locale));
}

const sitemapPath = path.join(root, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
if (!sitemap.includes(`${siteBase}questions.html`)) {
  sitemap = sitemap.replace("</urlset>", `  <url><loc>${siteBase}questions.html</loc><priority>0.9</priority></url>\n</urlset>`);
  await writeFile(sitemapPath, sitemap);
}

process.stdout.write(`Generated player question library with ${data.questions.length} records across ${Object.keys(locales).length} locales.\n`);
