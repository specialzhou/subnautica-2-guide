import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = "https://wiki.subnautica.com/sn2/api.php";
const wikiBase = "https://wiki.subnautica.com/sn2/";
const license = { name: "CC BY-NC-SA 3.0", url: "https://creativecommons.org/licenses/by-nc-sa/3.0/" };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const permanentUrl = (title, revisionId) => `${wikiBase}index.php?title=${encodeURIComponent(title.replaceAll(" ", "_"))}&oldid=${revisionId}`;

async function request(values) {
  const url = new URL(api);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...values });
  const response = await fetch(url, { headers: { "User-Agent": "Subnautica2EvidenceGuide/0.1 (https://specialzhou.github.io/subnautica-2-guide/)" } });
  if (!response.ok) throw new Error(`Wiki request failed: ${response.status}`);
  return response.json();
}

const membersData = await request({ action: "query", list: "categorymembers", cmtitle: "Category:Story", cmnamespace: "0", cmlimit: "500" });
const titles = membersData.query.categorymembers.map((member) => member.title).sort((a, b) => a.localeCompare(b));
const pagesData = await request({ action: "query", titles: titles.join("|"), prop: "revisions", rvprop: "ids|timestamp|content", rvslots: "main" });
const pages = pagesData.query.pages.map((page) => {
  const revision = page.revisions[0];
  const content = revision.slots.main.content;
  return { title: page.title, revisionId: revision.revid, revisionTimestamp: revision.timestamp, permanentUrl: permanentUrl(page.title, revision.revid), sections: page.title === "Story" ? [...content.matchAll(/^==\s*([^=\n]+?)\s*==\s*$/gm)].map((match) => match[1].trim()) : [] };
}).sort((a, b) => a.title.localeCompare(b.title));
const previousPath = path.join(root, "data", "wiki-story.json");
let previous = null;
try { previous = JSON.parse(await readFile(previousPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const changed = !previous || pages.length !== previous.pages.length || pages.some((page) => previous.pages.find((old) => old.title === page.title)?.revisionId !== page.revisionId);
const generatedAt = changed ? new Date().toISOString() : previous.generatedAt;
await writeFile(previousPath, `${JSON.stringify({ schemaVersion: "1.0.0", generatedAt, category: "Story", license, pages }, null, 2)}\n`);

const story = pages.find((page) => page.title === "Story");
const sectionItems = story.sections.map((section, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(section)}</strong></li>`).join("");
const topicRows = pages.filter((page) => page.title !== "Story").map((page) => `<tr><td>${escapeHtml(page.title)}</td><td><a href="${escapeHtml(page.permanentUrl)}" rel="noopener noreferrer">rev ${page.revisionId}</a></td><td>${escapeHtml(page.revisionTimestamp.slice(0, 10))}</td></tr>`).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subnautica 2 story index | Evidence Guide</title><meta name="description" content="Spoiler-marked, revision-linked Subnautica 2 story section and topic index."><meta name="robots" content="index,follow"><meta name="theme-color" content="#071d24"><link rel="canonical" href="https://specialzhou.github.io/subnautica-2-guide/story.html"><link rel="icon" href="/subnautica-2-guide/favicon.svg"><link rel="stylesheet" href="/subnautica-2-guide/styles.css"><link rel="stylesheet" href="/subnautica-2-guide/guide.css"></head><body><a class="skip-link" href="#main-content">Skip to content</a><div class="notice"><div class="shell notice__inner"><span class="notice__mark notice__mark--wiki"></span>Spoiler warning: this page lists official Wiki story section and topic names.</div></div><header class="site-header"><div class="shell nav-wrap"><a class="wordmark" href="/subnautica-2-guide/"><span class="wordmark__kicker">Field notebook / 1962700</span><span>Subnautica 2<br>Evidence Guide</span></a><nav aria-label="Primary navigation"><a href="/subnautica-2-guide/starter-planner.html">Start</a><a href="/subnautica-2-guide/locations.html">Locations</a><a href="/subnautica-2-guide/sources.html">Sources</a></nav></div></header><main id="main-content" class="shell"><section class="entity-hero"><p class="eyebrow">Spoilers · Wiki Story category</p><h1>Story<br><em>index.</em></h1><p class="lede">A revision-linked index of the current Early Access narrative. Article prose is not copied and this is not presented as a mission walkthrough.</p><dl class="entity-meta"><div><dt>Story revision</dt><dd><a href="${escapeHtml(story.permanentUrl)}">${story.revisionId}</a></dd></div><div><dt>Wiki updated</dt><dd>${escapeHtml(story.revisionTimestamp.slice(0, 10))}</dd></div><div><dt>Topics</dt><dd>${pages.length - 1}</dd></div></dl></section><section class="recipe-block"><div class="recipe-block__heading"><p class="eyebrow">Narrative structure</p><h2>Story sections</h2></div><ol class="story-sections">${sectionItems}</ol></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Category members</p><h2>Related story topics</h2></div><div class="table-wrap"><table><thead><tr><th>Topic</th><th>Revision</th><th>Wiki updated</th></tr></thead><tbody>${topicRows}</tbody></table></div></section><section class="evidence-note"><p class="eyebrow">Evidence boundary</p><h2>Story background is not gameplay order</h2><p>The section sequence comes from the linked Story article. It does not claim objectives, triggers, coordinates, or the correct order for player actions.</p></section></main><footer class="footer"><div class="shell footer__inner"><p>Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.</p><p>Wiki attribution: <a href="https://wiki.subnautica.com/sn2/">Subnautica 2 Wiki</a> · <a href="${license.url}">${license.name}</a></p></div></footer></body></html>`;
await writeFile(path.join(root, "story.html"), html);
process.stdout.write(`Imported ${pages.length} story index records, revisions ${changed ? "changed" : "unchanged"}.\n`);
