# Feature Documentation

Design documents for the major features. Each document records the
problem, goals, non-goals, behavior and history of one feature; the
plain how-to lives in the [usage guide](../usage.md).

> **Version note.** The repository has no Git tags or GitHub Releases
> yet (see [CHANGELOG](../../../CHANGELOG.md)). All features below were
> first published with the aggregated **v1.2.0** entry; only features
> added after that entry will carry a later version.

| Feature | Introduced | Status | Description |
| --- | --- | --- | --- |
| [Generation engine](./generation-engine.md) | v1.2.0 | Stable | Seeded, rules-based crossword layout with best-of-N selection |
| [Article extraction & cloze](./article-extraction-cloze.md) | v1.2.0 | Stable | Local article → ranked candidate words + offline cloze clues |
| [AI clue writing](./ai-clues.md) | v1.2.0 | Stable | Optional clues via any OpenAI-compatible endpoint |
| [Share links](./share-links.md) | v1.2.0 | Stable | Whole puzzle in a gzip-compressed URL hash |
| [Donation dialog](./donation.md) | v1.2.0 | Stable | Footer ☕ → Alipay/WeChat dialog with live in-browser QR |
