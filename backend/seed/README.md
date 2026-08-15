# Canonical AMIR Lab seed

`amirl-site.json` is the only public-content rebuild input for the backend.

It is intentionally **schema-shaped**, not a dump of the live HTML. AMIRL's current site represents many person fields as prose/tabs/tables, while this backend stores explicit `Person`, `PersonLink`, `PersonProfileSection`, `Department`, `ResearchItem`, `Paper`, `Project`, `Position`, and `SiteSetting` records.

## Provenance

- Current public roster and organization facts were checked against `https://amirl.org/` on 2026-08-14.
- Detailed profile text, links, profile sections and publication evidence are normalized from the AMIR Lab source material supplied with this project.
- Each person, department, paper and project retains neutral `sourceId` / `sourceUrl` provenance in this JSON. During import these map to the original backend’s `legacySourceId` / `legacyUrl` Prisma fields so existing API consumers remain compatible.
- `assets/people/` contains the preserved original people images supplied with the project. These files are source material only.

## Runtime images

Do not link the source images directly from the application. `pnpm run db:rebuild` processes available originals through Sharp and creates WebP `Asset` files under `storage/peoples/`, then attaches those assets to the imported `Person` records.

Three current people do not have an image in the supplied source set, so they intentionally rebuild with `avatarId = null`.

## Validation

```bash
pnpm run seed:validate
pnpm run db:rebuild
pnpm run db:verify
```

## Normalization decisions

- The public team page supplies current roster/category/affiliation facts; detailed profile tabs are converted into `profileSections` rather than stored as raw HTML.
- The live Open Positions page is converted into five `Position` records with explicit `OPEN` / `CLOSED` status and schema rank/type values.
- The Volunteer Internship Program and the image-only Achievement page are preserved as reviewed `SiteSetting` content (`site.training-programs` and `site.achievement`).
- The older Founder Message page contains role/publication counts that conflict with the newer founder profile. It is retained in source provenance but is **not** allowed to overwrite the newer person record.
- The home page currently shows three "Collaborated Universities" as unlabeled images. No `University` records are invented from those images because the live HTML does not provide reliable names or identifiers.
