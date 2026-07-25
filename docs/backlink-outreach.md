# Backlink / Digital PR Playbook — Subnautica 2 Evidence Guide

> Source of truth: `data/outreach-targets.json` (who/where/priority) + `data/backlink-tracker.json` (status).
> This doc is the human playbook. Outreach is **manual relationship work** — the agent builds the assets and the kit; you send the messages.

## Why backlinks, why now
- Google organic ≈ 0 sessions (GA: Google = 1 user in the window; Reddit drives the traffic). Reddit ref is **nofollow**, so it does not build domain authority.
- The single highest-leverage unlock for a new fan site is **earned backlinks from trusted communities** (wiki, Reddit subs, Discord). They pass authority and de-risk Google indexing.
- Our differentiator: **every fact carries a permanent wiki revision link** (CC BY-NC-SA attributed). That is a real, defensible reason for wikis/communities to link us — we are a *complement*, not a rip-off.

## Linkable assets we are pitching
| Asset | URL | Type | Best for |
|---|---|---|---|
| Tadpole build calculator | `/tools/tadpole-calculator.html` | Interactive, iframe-embeddable, shareable deep-link | Reddit/Discord/YouTube/wiki "tools" |
| Vehicle planner | `/vehicle-planner.html` | Static, wiki-attributed reference | wiki "external resources" |
| Starter planner | `/starter-planner.html` | Static, wiki-attributed reference | wiki / Steam guides |

## Outreach sequence (by priority)
1. **Wiki** (`wiki-subnautica`) — lowest friction, highest trust. Lead with the attribution we already give them.
2. **Reddit subs** (`reddit-subnautica`, `reddit-subnautica_2`) — modmail for sidebar; meanwhile drop the calculator in help threads (extends the existing acquisition loop).
3. **Discord** (`discord-subnautica`) — ask mods for a fan-tools pin; share in #guides. Discord renders OG cards, so the calculator's image pops.
4. **YouTube / Steam** — medium priority, slower, manual.
5. **Gaming blogs** — lowest yield at DR~0; revisit after community links exist.

## Embed snippet (for wiki / blogs that allow iframes)
```html
<iframe
  src="https://specialzhou.github.io/subnautica-2-guide/tools/tadpole-calculator.html"
  title="Subnautica 2 Tadpole build calculator"
  width="100%" height="640" style="border:0;border-radius:12px"
  loading="lazy"></iframe>
```
Plain link alternative (always safe):
`https://specialzhou.github.io/subnautica-2-guide/tools/tadpole-calculator.html`

## Pitch templates
Copy, personalize the bracketed bits, send. Keep it short and lead with *their* benefit.

### English
> Hi [name/mods],
> I help maintain a fan-made, unaffiliated Subnautica 2 reference that attributes every fact to a permanent wiki revision (CC BY-NC-SA). I built a small **interactive Tadpole build calculator** — pick a chassis and depth modules, and it shows total crafting inputs, max depth, and speed, all source-linked.
> If it's useful, feel free to link it from a tools/resources section (or drop it in a help thread). No strings attached — just thought the community might like a verified, ad-free tool.
> [URL]

### 中文
> 你好 [名字/版主]，
> 我维护一个非官方的《Subnautica 2》参考站，每条数据都标注了 Wiki 的永久修订号（CC BY-NC-SA 署名）。我做了一个**可交互的 Tadpole 载具配置器**——选底盘和深度模块，就能实时算出总材料、最大下潜深度和速度，全部带出处。
> 如果觉得有用，欢迎在"工具/资源"区挂个链接（或直接发到求助帖里）。完全无附加条件，只是觉得社区会喜欢这种有出处、无广告的小工具。
> [URL]

### Русский
> Здравствуйте, [имя/модераторы].
> Я веду фанатский, неофициальный справочник по Subnautica 2, где каждый факт ссылается на постоянную ревизию вики (CC BY-NC-SA). Я сделал **интерактивный калькулятор постройки Tadpole** — выбираете шасси и модули глубины, и он показывает общие ресурсы, максимальную глубину и скорость, со ссылками на источник.
> Если будет полезно, можете разместить ссылку в разделе «инструменты/ресурсы» (или кинуть в тему с вопросами). Без условий — просто подумал, что сообществу понравится проверенный инструмент без рекламы.
> [URL]

## Using the tracker
- `data/backlink-tracker.json` has one row per target with `status`, `lastTouch`, `nextAction`, `linkedBack`.
- Update `status` as you progress: `identified → contacted → replied → linked → (declined|monitoring)`.
- Set `linkedBack: true` only after you confirm a real link exists (manual check, or a future GitHub Action could crawl targets for our domain).
- Keep this file as the single source of truth; the strategy doc stays human-readable.

## Honest caveats
- This is **earned**, not bought. No PBNs, no link schemes — they violate search guidelines and would hurt us.
- Results compound over weeks/months, not days. The Reddit loop is the near-term traffic engine; backlinks are the long-term authority engine.
- "Linked" from a nofollow community (Reddit/Discord) still drives direct clicks and trust, even if it passes less PageRank. Treat community links and followed links as both valuable.
