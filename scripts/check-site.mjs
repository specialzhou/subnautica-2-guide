import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", "node_modules"]);
const failures = [];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) files.push(...await collect(path.join(directory, entry.name)));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path.join(directory, entry.name));
  }
  return files;
}

const htmlFiles = await collect(root);
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (!/<title>[^<]+<\/title>/.test(html)) failures.push(`${relative}: missing title`);
  if (!/<link rel="canonical" href="https:\/\/specialzhou\.github\.io\/subnautica-2-guide\//.test(html)) failures.push(`${relative}: missing canonical`);
  if (!/<main\b/.test(html)) failures.push(`${relative}: missing main landmark`);
  if (!html.includes('src="/subnautica-2-guide/analytics.js?v=1"')) failures.push(`${relative}: missing shared analytics`);
  if (html.includes("googletagmanager.com/gtag/js?id=G-7R7JWG7M2S")) failures.push(`${relative}: duplicate inline analytics loader`);
  if (/questions\/[^/]+\.html$/.test(relative)) {
    if (!html.includes('type="application/ld+json"') || !html.includes('"@type":"BreadcrumbList"') || !html.includes('"@type":"QAPage"')) failures.push(`${relative}: missing QAPage structured data`);
    if (!/<meta name="description" content="[^"]+">/.test(html)) failures.push(`${relative}: missing detail description`);
  }
  const entityMatch = relative.match(/^(?:en[\\/]|zh-cn[\\/]|ru[\\/])?guide\/(?:items|creatures|vehicles|biomes|resources)\/[^/]+\.html$/);
  if (entityMatch) {
    const section = html.match(/<section class="related-records"[^>]*>[\s\S]*?<\/section>/);
    if (!section) {
      failures.push(`${relative}: missing related-records internal links section`);
    } else {
      const internalLinks = [...section[0].matchAll(/<a\s+[^>]*href="([^"]+\.html)(?:#[^"]*)?"/g)].filter((match) => !/^https?:/.test(match[1])).length;
      if (internalLinks < 2) failures.push(`${relative}: related-records section has too few internal links (${internalLinks})`);
    }
    const hasEntityLd = /<script type="application\/ld\+json">/.test(html) && html.includes('"@type":"Article"') && html.includes('"dateModified"');
    if (!hasEntityLd) failures.push(`${relative}: missing entity JSON-LD (Article with dateModified)`);
    const faqSection = html.match(/<section class="entity-faq"[^>]*>[\s\S]*?<\/section>/);
    if (!faqSection) {
      failures.push(`${relative}: missing entity-faq FAQ section`);
    } else {
      const faqCount = (faqSection[0].match(/<div class="faq__item">/g) || []).length;
      if (faqCount < 2) failures.push(`${relative}: entity-faq has too few Q&A (${faqCount})`);
    }
    if (!html.includes('"@type":"FAQPage"')) failures.push(`${relative}: missing FAQPage structured data`);
  }
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (href.includes("${")) continue;
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const clean = href.split("#")[0].split("?")[0];
    if (!clean || clean.startsWith("data:")) continue;
    const target = clean.startsWith("/subnautica-2-guide/") ? path.join(root, clean.slice("/subnautica-2-guide/".length)) : path.resolve(path.dirname(file), clean);
    await access(target || root).catch(() => failures.push(`${relative}: broken link ${href}`));
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Checked ${htmlFiles.length} HTML pages: metadata and internal links valid.\n`);
}
