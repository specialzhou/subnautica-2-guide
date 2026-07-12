# Subnautica 2 Evidence Guide

A static, source-linked Subnautica 2 guide. It currently generates 204 recipe records, 92 resource/creature/vehicle/biome records, official-backed co-op facts, and a dependency-based starter crafting planner. Verification strength is always visible.

## Status model

- `wiki-backed`: parsed from a permanent Wiki revision with source ID and timestamp.
- `cross-checked`: consistent with an official patch note or announcement.
- `in-game verified`: independently reproduced in a recorded game build.
- `excluded`: planned, removed, unobtainable, test, debug, or development-only content.

Wiki-backed does not mean independently tested in game.

## Import and validate

```bash
npm run import:wiki
npm run validate
```

The importer:

1. lists pages from the Wiki's crafting categories;
2. fetches wikitext, categories, revision IDs, and timestamps through the MediaWiki API;
3. parses structured `Recipe` templates;
4. filters non-current content;
5. writes `data/wiki-items.json`;
6. generates topic indexes, individual records, the starter planner, ledger counters, and sitemap;
7. imports official product facts for the co-op reference;
8. keeps permanent source links on every published record.

Validation also crawls every generated HTML file for required metadata and broken internal links.

## Content and licensing boundary

The Wiki declares `CC BY-NC-SA 3.0`. Generated pages attribute the Wiki and link to the exact revision. The importer uses structured recipe facts; it does not copy article prose or Wiki images. Review licensing separately before commercial use.

Official Wiki: <https://wiki.subnautica.com/sn2/>

## Publishing rule

Never promote a record beyond its evidence. On a game patch, re-import changed Wiki revisions and mark affected independently verified entries stale until retested.
