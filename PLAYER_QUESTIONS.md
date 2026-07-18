# Player question workflow

The site separates discovery from publication so an automated feed cannot turn an unverified Reddit reply into guide advice.

## Daily discovery

`.github/workflows/collect-player-questions.yml` reads the public `r/Subnautica_2` Atom feed once per day. It scores titles and post text for help, location, crafting, progression, save, control, and bug signals. It stores only the post title, link, dates, matched signals, and review metadata in `data/player-question-candidates.json`; Reddit post bodies are not retained. A readable review table is generated at `data/player-question-candidates.md`.

For at most four candidates per run, the collector reads the post Atom feed and counts comment entries. This is an approximate discussion count. RSS does not expose upvotes, so `upvotes` remains `null` until a reviewer observes it manually.

The scheduled job updates a draft review PR. It never edits `data/player-questions.json`, generated pages, homepage recommendations, or answers.

## Review gate

Before promoting a candidate:

1. Open the Reddit discussion and record current upvotes, comments, and observation date.
2. Identify whether the question is solved, partially solved, or still open.
3. Verify the answer against a permanent Wiki revision, official build note, reproducible in-game evidence, or clearly labelled community consensus.
4. Add English, Simplified Chinese, and Russian question, answer, evidence boundary, and search terms.
5. Add related guide pages and a build context.
6. Run the gated promotion command. It rejects missing locales, attention counts, evidence URLs, invalid related pages, duplicate IDs, and unresolved duplicate warnings.

## Local commands

- `npm run collect:questions` — fetch the current feed and check four discussion counts with polite delays.
- `npm run test:collector` — run deterministic parser, scoring, deduplication, and count tests without network access.
- `npm run review:question -- --reddit-id=<id>` — create a review template without publishing anything.
- `npm run promote:question -- --review=data/player-question-reviews/<id>.json` — validate, archive the review, update both datasets, regenerate all locales, and run the complete test suite.
- `npm run traffic:opportunities` — match reviewed public answers to different Reddit candidate threads, deduplicate by guide page, and generate UTM reply drafts without posting them.
- `.github/workflows/traffic-opportunities.yml` runs daily at 07:17 UTC and updates one fixed `traffic-opportunity` issue for final human review.
- `npm run questions` — regenerate localized question pages, homepage recommendations, and search data.
- `npm run validate` — verify the candidate boundary, published questions, localization, links, and search index.
