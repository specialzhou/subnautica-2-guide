import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkedAt = "2026-07-12";
const publicBuild = { id: "23446003", branch: "public", builtAt: "2026-05-28T06:42:56Z", updatedAt: "2026-06-01T20:06:33Z", source: "https://steamdb.info/app/1962700/depots/", sourceType: "third-party Steam metadata tracker" };
const facts = [
  { label: "Mode", value: "Optional online co-op", source: "https://subnautica.com/en", evidence: "The official game page says the game can be played alone or in online multiplayer co-op." },
  { label: "Party size", value: "Up to 4 players", source: "https://subnautica.com/en", evidence: "The official game page says play alone or with up to three friends." },
  { label: "Solo support", value: "Yes", source: "https://store.steampowered.com/app/1962700/Subnautica_2/", evidence: "The official Steam listing describes co-op as optional and lists Single-player." },
  { label: "Store features", value: "Online Co-op; Cross-Platform Multiplayer", source: "https://store.steampowered.com/app/1962700/Subnautica_2/", evidence: "These capabilities are listed in the Steam store feature panel." },
];

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const rows = facts.map((fact) => `<tr><td>${escapeHtml(fact.label)}</td><td><strong>${escapeHtml(fact.value)}</strong></td><td>${escapeHtml(fact.evidence)}</td><td><a href="${escapeHtml(fact.source)}" rel="noopener noreferrer">Official source</a></td></tr>`).join("");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subnautica 2 co-op | Evidence Guide</title><meta name="description" content="Officially confirmed Subnautica 2 online co-op facts, player count, solo support, and evidence boundaries."><meta name="robots" content="index,follow"><meta name="theme-color" content="#071d24"><link rel="canonical" href="https://specialzhou.github.io/subnautica-2-guide/coop.html"><link rel="icon" href="/subnautica-2-guide/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet"><link rel="stylesheet" href="/subnautica-2-guide/styles.css"><link rel="stylesheet" href="/subnautica-2-guide/guide.css"></head><body><a class="skip-link" href="#main-content">Skip to content</a><div class="notice"><div class="shell notice__inner"><span class="notice__mark" aria-hidden="true"></span>Official-backed facts checked ${checkedAt}; undocumented session behavior is not inferred.</div></div><header class="site-header"><div class="shell nav-wrap"><a class="wordmark" href="/subnautica-2-guide/"><span class="wordmark__kicker">Field notebook / 1962700</span><span>Subnautica 2<br>Evidence Guide</span></a><nav aria-label="Primary navigation"><a href="/subnautica-2-guide/crafting.html">Crafting</a><a href="/subnautica-2-guide/sources.html">Sources</a></nav></div></header><main id="main-content" class="shell"><section class="entity-hero"><p class="eyebrow">Official game pages · Cross-checked</p><h1>Co-op<br><em>reference.</em></h1><p class="lede">Confirmed multiplayer facts from the official Subnautica site and official Steam listing. This page intentionally stops where the sources stop.</p></section><section class="ledger"><div class="section-heading"><p class="eyebrow">Confirmed capabilities</p><h2>What is officially documented</h2></div><div class="table-wrap"><table class="crafting-table"><thead><tr><th>Fact</th><th>Answer</th><th>Evidence</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="evidence-note"><p class="eyebrow">Still requires in-game verification</p><h2>Joining, hosting, saves, progression, and disconnect behavior</h2><p>The official pages used here do not document those operational details. They remain unpublished rather than being filled from assumptions or unsourced player comments.</p></section></main><footer class="footer"><div class="shell footer__inner"><p>Fan-made, unaffiliated with Unknown Worlds Entertainment or Krafton.</p><p><a href="https://subnautica.com/en">Official game page</a> · <a href="https://store.steampowered.com/app/1962700/Subnautica_2/">Official Steam listing</a></p></div></footer></body></html>`;

await writeFile(path.join(root, "data", "official-facts.json"), `${JSON.stringify({ schemaVersion: "1.0.0", checkedAt, topic: "co-op", status: "official-backed", publicBuild, facts }, null, 2)}\n`);
await writeFile(path.join(root, "coop.html"), html);

const ledgerPath = path.join(root, "data", "ledger.json");
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
ledger.tracker.withdrawnPages = 0;
ledger.tracker.gameBuild = `${publicBuild.id} (Steam public)`;
ledger.tracker.gameBuildEvidence = { status: "metadata-only", source: publicBuild.source, checkedAt };
ledger.reviewQueue = ledger.reviewQueue.filter((entry) => entry.category !== "Progression guides");
if (!ledger.sourceRegistry.some((source) => source.id === "official-game-site")) ledger.sourceRegistry.splice(1, 0, { id: "official-game-site", name: "Official Subnautica 2 game page", type: "Primary product source", url: "https://subnautica.com/en", allowedUse: "Published game features and multiplayer claims only.", lastChecked: checkedAt });
if (!ledger.sourceRegistry.some((source) => source.id === "steamdb-build")) ledger.sourceRegistry.push({ id: "steamdb-build", name: "SteamDB public branch metadata", type: "Third-party version metadata", url: publicBuild.source, allowedUse: "Public Steam branch Build ID only. This does not count as an in-game verification capture.", lastChecked: checkedAt });
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
process.stdout.write(`Generated ${facts.length} official-backed co-op facts.\n`);
