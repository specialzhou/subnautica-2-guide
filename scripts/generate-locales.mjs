import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteBase = "https://specialzhou.github.io/subnautica-2-guide/";
const pathBase = "/subnautica-2-guide/";
const locales = {
  en: { label: "English", htmlLang: "en", dictionary: {} },
  "zh-cn": { label: "简体中文", htmlLang: "zh-CN", dictionary: {
    "Subnautica 2 Evidence Guide": "Subnautica 2 证据攻略",
    "Evidence Guide": "证据攻略",
    "Starter crafting planner": "开局制作规划",
    "Starter crafting": "开局制作",
    "Starter materials": "开局材料",
    "Equipment upgrades": "装备升级",
    "Blueprint checklist": "蓝图清单",
    "Vehicle planner": "载具规划",
    "Key locations": "关键地点",
    "Story index": "剧情索引",
    "Base building": "基地建造",
    "Crafting": "制作",
    "Resources": "资源",
    "Creatures": "生物",
    "Vehicles": "载具",
    "Biomes": "生态区",
    "Blueprints": "蓝图",
    "Upgrades": "升级",
    "Locations": "地点",
    "Sources": "来源",
    "Method": "方法",
    "Start": "开局",
    "Co-op": "联机",
    "Oxygen": "氧气",
    "Status": "状态",
    "Revision": "版本修订",
    "Wiki updated": "Wiki 更新时间",
    "Unlock": "解锁",
    "Recipe": "配方",
    "Ingredient": "材料",
    "Ingredients": "材料",
    "Amount": "数量",
    "Station": "工作台",
    "Source": "来源",
    "Name": "名称",
    "Structured facts": "结构化事实",
    "Fragments": "碎片数",
    "Speed": "速度",
    "Depth": "深度",
    "Item": "物品",
    "Inputs": "投入材料",
    "Result": "产物",
    "Step": "步骤",
    "Tier": "等级",
    "Role": "用途",
    "Biome": "生态区",
    "Point of interest": "关键地点",
    "Wiki-backed": "Wiki 支持",
    "Official-backed": "官方支持",
    "Available by default": "默认可用",
    "Available at game start (Wiki statement)": "游戏开始时可用（Wiki 说明）",
    "Not stated as default": "未说明默认可用",
    "Not recorded": "未记录",
    "No structured details": "没有结构化信息",
    "No ingredients listed": "未列出材料",
    "Crafting time": "制作时间",
    "Evidence boundary": "证据边界",
    "Reading the planner": "规划器说明",
    "Raw material total": "原料总量",
    "Loadout target": "装备目标",
    "Recipe dependency graph": "配方依赖图",
    "Recipe-linked chain": "配方关联升级链",
    "Direct recipe dependencies": "直接配方依赖",
    "Structured unlock fields": "结构化解锁字段",
    "Fragment unlocks": "碎片解锁",
    "Construction records": "建造记录",
    "Published vehicle records": "已发布载具记录",
    "Documented module ratings": "已记录模块深度",
    "Named points of interest": "已命名关键地点",
    "Narrative structure": "叙事结构",
    "Story sections": "剧情章节",
    "Related story topics": "相关剧情主题",
    "Spoiler warning": "剧透警告",
    "Spoilers": "剧透",
    "All published recipes": "全部已发布配方",
    "Filter records": "筛选记录",
    "records shown": "条记录",
    "Back to all crafting records": "返回全部制作记录",
    "Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.": "玩家制作，与 Unknown Worlds Entertainment 或 Krafton 无隶属关系。",
    "The official Wiki is a structured baseline, not a claim of independent gameplay verification.": "官方 Wiki 是结构化基线，不代表已经独立进行游戏内验证。",
    "Wiki-backed, not independently reproduced": "Wiki 支持，尚未独立复现",
    "Dependency is proven; unlock timing is not": "依赖关系已确认，解锁时机尚未确认",
    "This is a checklist, not a complete story progression": "这是清单，不是完整剧情流程",
    "Grouped records are not a claimed unlock order": "分组记录不代表解锁顺序",
    "Names and biome depth are not coordinates": "地点名称和生态区深度不等于坐标",
    "Story background is not gameplay order": "剧情背景不等于游戏流程顺序",
    "Language": "语言",
    "Searchable field guide": "可搜索的游戏攻略",
    "What are you trying<br><em>to do next?</em>": "你接下来<br><em>想做什么？</em>",
    "Find a recipe, material, creature, biome, or a focused guide. Facts stay linked to the exact Wiki revision they came from.": "搜配方、材料、生物、生态区或专题攻略。每条事实都保留对应的 Wiki 修订版本。",
    "I just started": "我刚开局",
    "I need materials": "我要找材料",
    "I want the Tadpole": "我要造 Tadpole",
    "Choose a task": "选一个目标",
    "Start with the problem, not the database": "先解决问题，不是先翻数据库",
    "Survive the opening": "度过开局",
    "Find materials": "找材料",
    "Build the Tadpole": "建造 Tadpole",
    "Track blueprints": "跟踪蓝图",
    "Plan a base": "规划基地",
    "Explore places": "探索地点",
    "Browse the guide": "浏览攻略",
    "Four ways into the world": "从四类内容开始",
    "How facts are checked": "事实如何核验",
    "Useful first. Traceable underneath.": "先好用，再保证可追溯。",
  } },
  ru: { label: "Русский", htmlLang: "ru", dictionary: {
    "Subnautica 2 Evidence Guide": "Subnautica 2 — проверенный справочник",
    "Evidence Guide": "Проверенный справочник",
    "Starter crafting planner": "План начального крафта",
    "Starter crafting": "Начальный крафт",
    "Starter materials": "Начальные материалы",
    "Equipment upgrades": "Улучшения снаряжения",
    "Blueprint checklist": "Список чертежей",
    "Vehicle planner": "План транспорта",
    "Key locations": "Ключевые места",
    "Story index": "Сюжетный указатель",
    "Base building": "Строительство базы",
    "Crafting": "Крафт",
    "Resources": "Ресурсы",
    "Creatures": "Существа",
    "Vehicles": "Транспорт",
    "Biomes": "Биомы",
    "Blueprints": "Чертежи",
    "Upgrades": "Улучшения",
    "Locations": "Места",
    "Sources": "Источники",
    "Method": "Методика",
    "Start": "Старт",
    "Co-op": "Кооператив",
    "Oxygen": "Кислород",
    "Status": "Статус",
    "Revision": "Ревизия",
    "Wiki updated": "Обновление Wiki",
    "Unlock": "Открытие",
    "Recipe": "Рецепт",
    "Ingredient": "Материал",
    "Ingredients": "Материалы",
    "Amount": "Количество",
    "Station": "Станция",
    "Source": "Источник",
    "Name": "Название",
    "Structured facts": "Структурированные данные",
    "Fragments": "Фрагменты",
    "Speed": "Скорость",
    "Depth": "Глубина",
    "Item": "Предмет",
    "Inputs": "Материалы",
    "Result": "Результат",
    "Step": "Шаг",
    "Tier": "Уровень",
    "Role": "Назначение",
    "Biome": "Биом",
    "Point of interest": "Место интереса",
    "Wiki-backed": "Подтверждено Wiki",
    "Official-backed": "Подтверждено официально",
    "Available by default": "Доступно сразу",
    "Available at game start (Wiki statement)": "Доступно с начала игры (по Wiki)",
    "Not stated as default": "Начальная доступность не указана",
    "Not recorded": "Не указано",
    "No structured details": "Нет структурированных данных",
    "No ingredients listed": "Материалы не указаны",
    "Crafting time": "Время крафта",
    "Evidence boundary": "Граница доказательств",
    "Reading the planner": "Как читать план",
    "Raw material total": "Всего сырья",
    "Loadout target": "Целевое снаряжение",
    "Recipe dependency graph": "Граф зависимостей рецептов",
    "Recipe-linked chain": "Цепочка рецептов",
    "Direct recipe dependencies": "Прямые зависимости рецептов",
    "Structured unlock fields": "Структурированные данные открытия",
    "Fragment unlocks": "Открытие фрагментами",
    "Construction records": "Данные строительства",
    "Published vehicle records": "Опубликованные данные транспорта",
    "Documented module ratings": "Задокументированные глубины модулей",
    "Named points of interest": "Именованные места",
    "Narrative structure": "Структура сюжета",
    "Story sections": "Разделы сюжета",
    "Related story topics": "Связанные сюжетные темы",
    "Spoiler warning": "Предупреждение о спойлерах",
    "Spoilers": "Спойлеры",
    "All published recipes": "Все опубликованные рецепты",
    "Filter records": "Фильтр записей",
    "records shown": "записей",
    "Back to all crafting records": "Ко всем рецептам",
    "Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.": "Фанатский сайт, не связанный с Unknown Worlds Entertainment или Krafton.",
    "The official Wiki is a structured baseline, not a claim of independent gameplay verification.": "Официальная Wiki служит структурированной основой и не означает независимую проверку в игре.",
    "Wiki-backed, not independently reproduced": "Подтверждено Wiki, но не воспроизведено независимо",
    "Dependency is proven; unlock timing is not": "Зависимость подтверждена, время открытия — нет",
    "This is a checklist, not a complete story progression": "Это список, а не полное сюжетное прохождение",
    "Grouped records are not a claimed unlock order": "Группировка не означает порядок открытия",
    "Names and biome depth are not coordinates": "Названия и глубина биома — не координаты",
    "Story background is not gameplay order": "Сюжетный фон — не порядок прохождения",
    "Language": "Язык",
    "Searchable field guide": "Поисковый справочник",
    "What are you trying<br><em>to do next?</em>": "Что вы хотите<br><em>сделать дальше?</em>",
    "I just started": "Я только начал",
    "I need materials": "Мне нужны материалы",
    "I want the Tadpole": "Я хочу Tadpole",
    "Choose a task": "Выберите задачу",
    "Start with the problem, not the database": "Начните с задачи, а не с базы данных",
    "Survive the opening": "Выжить в начале",
    "Find materials": "Найти материалы",
    "Build the Tadpole": "Построить Tadpole",
    "Track blueprints": "Отслеживать чертежи",
    "Plan a base": "Спланировать базу",
    "Explore places": "Исследовать места",
    "Browse the guide": "Разделы справочника",
    "Four ways into the world": "Четыре точки входа",
    "How facts are checked": "Как проверяются факты",
    "Useful first. Traceable underneath.": "Снача полезность. В основе — проверяемые источники.",
  } },
};

function translate(html, dictionary) {
  const attributes = [];
  const protectedHtml = html.replace(/\b(?:href|src)="[^"]*"|\bcontent="https?:\/\/[^"]*"/g, (attribute) => {
    const token = `__URL_ATTRIBUTE_${attributes.length}__`;
    attributes.push(attribute);
    return token;
  });
  const translated = Object.entries(dictionary).sort(([a], [b]) => b.length - a.length).reduce((output, [source, target]) => output.replaceAll(source, target), protectedHtml);
  return attributes.reduce((output, attribute, index) => output.replace(`__URL_ATTRIBUTE_${index}__`, attribute), translated);
}

function stripLocaleMetadata(html) {
  return html
    .replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]+">/g, "")
    .replace(/<link rel="stylesheet" href="\/subnautica-2-guide\/locale\.css">/g, "")
    .replace(/<link rel="stylesheet" href="\/subnautica-2-guide\/(?:en\/|zh-cn\/|ru\/)?search\.css">/g, "")
    .replace(/<script defer src="\/subnautica-2-guide\/(?:en\/|zh-cn\/|ru\/)?search\.js"><\/script>/g, "")
    .replace(/<button class="global-search-trigger"[^>]*>.*?<\/button>/g, "")
    .replace(/<figure class="record-media">.*?<\/figure>/gs, "")
    .replace(/<span class="language-switcher"[^>]*>.*?<\/span>/g, "");
}

function localPath(pagePath, locale) {
  return `${pathBase}${locale}/${pagePath === "index.html" ? "" : pagePath}`;
}

function decorate(sourceHtml, pagePath, locale) {
  const config = locales[locale];
  let html = stripLocaleMetadata(sourceHtml).replace(/<html lang="[^"]+">/, `<html lang="${config.htmlLang}">`);
  if (locale !== "en") html = translate(html, config.dictionary);
  html = html.replaceAll(pathBase, `${pathBase}${locale}/`)
    .replaceAll(`${pathBase}${locale}/styles.css`, `${pathBase}styles.css`)
    .replaceAll(`${pathBase}${locale}/guide.css`, `${pathBase}guide.css`)
    .replaceAll(`${pathBase}${locale}/favicon.svg`, `${pathBase}favicon.svg`)
    .replaceAll(`${pathBase}${locale}/app.js`, `${pathBase}app.js`)
    .replaceAll(`${pathBase}${locale}/data/`, `${pathBase}data/`)
    .replaceAll('href="favicon.svg"', `href="${pathBase}favicon.svg"`)
    .replaceAll('href="styles.css"', `href="${pathBase}styles.css"`)
    .replaceAll('href="guide.css"', `href="${pathBase}guide.css"`)
    .replaceAll('src="app.js"', `src="${pathBase}app.js"`)
    .replaceAll('href="data/', `href="${pathBase}data/`)
    .replaceAll('fetch("data/', `fetch("${pathBase}data/`);
  html = html.replace(/<link rel="canonical" href="[^"]+">/, `<link rel="canonical" href="${siteBase}${locale}/${pagePath === "index.html" ? "" : pagePath}">`);
  const alternates = [`<link rel="alternate" hreflang="x-default" href="${siteBase}${pagePath === "index.html" ? "" : pagePath}">`, ...Object.keys(locales).map((code) => `<link rel="alternate" hreflang="${locales[code].htmlLang}" href="${siteBase}${code}/${pagePath === "index.html" ? "" : pagePath}">`)].join("");
  html = html.replace("</head>", `<link rel="stylesheet" href="${pathBase}locale.css">${alternates}</head>`);
  const switcher = `<span class="language-switcher" aria-label="Language">${Object.entries(locales).map(([code, value]) => `<a href="${localPath(pagePath, code)}"${code === locale ? ' aria-current="page"' : ""}>${value.label}</a>`).join("")}</span>`;
  html = html.replace("</nav>", `${switcher}</nav>`);
  return html;
}

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const pagePaths = [...sitemap.matchAll(/<loc>https:\/\/specialzhou\.github\.io\/subnautica-2-guide\/([^<]*)<\/loc>/g)].map((match) => match[1] || "index.html").filter((value) => !/^(en|zh-cn|ru)\//.test(value));
for (const locale of Object.keys(locales)) {
  await rm(path.join(root, locale), { recursive: true, force: true });
  for (const pagePath of pagePaths) {
    const sourcePath = path.join(root, pagePath);
    const outputPath = path.join(root, locale, pagePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const sourceHtml = await readFile(sourcePath, "utf8");
    await writeFile(outputPath, decorate(sourceHtml, pagePath, locale));
  }
}

for (const pagePath of pagePaths) {
  const sourcePath = path.join(root, pagePath);
  let html = stripLocaleMetadata(await readFile(sourcePath, "utf8"));
  const alternates = [`<link rel="alternate" hreflang="x-default" href="${siteBase}${pagePath === "index.html" ? "" : pagePath}">`, ...Object.keys(locales).map((code) => `<link rel="alternate" hreflang="${locales[code].htmlLang}" href="${siteBase}${code}/${pagePath === "index.html" ? "" : pagePath}">`)].join("");
  html = html.replace("</head>", `<link rel="stylesheet" href="${pathBase}locale.css">${alternates}</head>`).replace("</nav>", `<span class="language-switcher" aria-label="Language">${Object.entries(locales).map(([code, value]) => `<a href="${localPath(pagePath, code)}"${code === "en" ? ' aria-current="page"' : ""}>${value.label}</a>`).join("")}</span></nav>`);
  await writeFile(sourcePath, html);
}

const rootUrls = pagePaths.map((pagePath) => `  <url><loc>${siteBase}${pagePath === "index.html" ? "" : pagePath}</loc><priority>${pagePath === "index.html" ? "1.0" : "0.8"}</priority></url>`);
const localeUrls = Object.keys(locales).flatMap((locale) => pagePaths.map((pagePath) => `  <url><loc>${siteBase}${locale}/${pagePath === "index.html" ? "" : pagePath}</loc><priority>${pagePath === "index.html" ? "0.9" : "0.7"}</priority></url>`));
await writeFile(path.join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...rootUrls, ...localeUrls].join("\n")}\n</urlset>\n`);
await writeFile(path.join(root, "data", "locales.json"), `${JSON.stringify({ schemaVersion: "1.0.0", defaultLocale: "en", locales: Object.entries(locales).map(([code, value]) => ({ code, label: value.label, htmlLang: value.htmlLang })), pageCountPerLocale: pagePaths.length }, null, 2)}\n`);
process.stdout.write(`Generated ${pagePaths.length} pages for ${Object.keys(locales).length} locales.\n`);
