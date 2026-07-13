import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const localeData = JSON.parse(await readFile(path.join(root, "data", "locales.json"), "utf8"));
const failures = [];
const locales = localeData.locales;
const rootPages = [...sitemap.matchAll(/<loc>https:\/\/specialzhou\.github\.io\/subnautica-2-guide\/([^<]*)<\/loc>/g)].map((match) => match[1] || "index.html").filter((page) => !/^(en|zh-cn|ru)\//.test(page));

if (locales.map((locale) => locale.code).join(",") !== "en,zh-cn,ru") failures.push("Unexpected locale registry");
if (rootPages.length !== localeData.pageCountPerLocale) failures.push("Locale page count metadata mismatch");

for (const locale of locales) {
  for (const page of rootPages) {
    const file = path.join(root, locale.code, page);
    await access(file).catch(() => failures.push(`Missing localized page: ${locale.code}/${page}`));
    const html = await readFile(file, "utf8");
    if (!html.includes(`<html lang="${locale.htmlLang}">`)) failures.push(`Wrong html lang: ${locale.code}/${page}`);
    if (!html.includes(`rel="canonical" href="https://specialzhou.github.io/subnautica-2-guide/${locale.code}/${page === "index.html" ? "" : page}"`)) failures.push(`Wrong canonical: ${locale.code}/${page}`);
    for (const alternate of ["x-default", "en", "zh-CN", "ru"]) if (!html.includes(`hreflang="${alternate}"`)) failures.push(`Missing hreflang ${alternate}: ${locale.code}/${page}`);
    if (!html.includes(`href="/subnautica-2-guide/${locale.code}/${page === "index.html" ? "" : page}" aria-current="page"`)) failures.push(`Wrong active language: ${locale.code}/${page}`);
    if (/\/subnautica-2-guide\/(?:en|zh-cn|ru)\/(?:en|zh-cn|ru)\//.test(html)) failures.push(`Nested locale path: ${locale.code}/${page}`);
  }
}

const zh = await readFile(path.join(root, "zh-cn", "starter-planner.html"), "utf8");
for (const phrase of ["开局制作", "配方依赖图", "规划器说明", "简体中文"]) if (!zh.includes(phrase)) failures.push(`Chinese translation smoke test missing: ${phrase}`);
const zhHome = await readFile(path.join(root, "zh-cn", "index.html"), "utf8");
for (const phrase of ["按 / 搜索", "查看默认配方和已记录的碎片需求", "Wiki 图片", "不是本站的实机验证截图"]) if (!zhHome.includes(phrase)) failures.push(`Chinese homepage translation missing: ${phrase}`);
for (const phrase of ["Press / to search", "See default recipes and documented fragment requirements.", "Unknown Worlds"] ) if (phrase === "Unknown Worlds" ? !zhHome.includes(phrase) : zhHome.includes(phrase)) failures.push(`Chinese homepage leakage or protected name failure: ${phrase}`);
if (!zhHome.includes('class="task-card task-card--wide" href="blueprints.html"')) failures.push("Blueprint task does not fill the desktop grid");
const zhScanner = await readFile(path.join(root, "zh-cn", "guide", "items", "scanner.html"), "utf8");
for (const phrase of ["扫描仪（Scanner）", "制造台（Fabricator）", "钛（Titanium）", "Wiki 图片", "非实机验证截图"]) if (!zhScanner.includes(phrase)) failures.push(`Chinese detail translation missing: ${phrase}`);
if (zhScanner.includes("未知 Worlds")) failures.push("Company name was partially translated");
if (zhScanner.includes("类型=\"") || !zhScanner.includes('type="image/svg+xml"')) failures.push("HTML type attribute was translated");
const searchScript = await readFile(path.join(root, "search.js"), "utf8");
for (const phrase of ['Guide: "攻略"', 'Item: "物品"', 'Scanner: "扫描仪"', 'entry.type === "Guide"']) if (!searchScript.includes(phrase)) failures.push(`Localized search behavior missing: ${phrase}`);
const ru = await readFile(path.join(root, "ru", "starter-planner.html"), "utf8");
for (const phrase of ["Начальный крафт", "Граф зависимостей рецептов", "Как читать план", "Русский"]) if (!ru.includes(phrase)) failures.push(`Russian translation smoke test missing: ${phrase}`);

const expectedSitemapUrls = rootPages.length * (locales.length + 1);
if ((sitemap.match(/<url>/g) || []).length !== expectedSitemapUrls) failures.push("Localized sitemap URL count mismatch");

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Checked ${rootPages.length} pages across ${locales.length} locales and ${expectedSitemapUrls} sitemap URLs.\n`);
}
