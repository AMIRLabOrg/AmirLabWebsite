---
name: amirlab-ui-consistency
description: Refine or review AMIRLab public and workspace UI using its existing shared design system. Use for layout, alignment, rails, headings, forms, empty/error states, and loading consistency in this repository.
---

# AMIRLab UI consistency

Fix a repeated design problem at its shared owner and inspect every caller. A screenshot is an example, not the complete audit scope. Keep this file concise; record reusable rules rather than individual screenshots.

## Existing owners

- Public layout: `frontend/src/components/ui/public-shell.tsx` (`PublicSection`, `PublicShell`, `CollectionHeading`, `FramedCollection`, `FramedRow`).
- Workspace layout: `ui/workspace-surface.tsx`, `workspace-record.tsx`, `workspace-page-shell.tsx`.
- Empty/error/filtered states: `state-panel.tsx`. Its required `frame` chooses public rail-to-rail (`true`), workspace bordered (`"workspace"`), or explicitly embedded (`false`).
- Forms: `FormField`, `InputControl`, `SelectControl`, `ButtonControl`; search: `ToolbarSearchField`.
- Loading: `lib/loading-style.ts`; apply placeholders to the real components. Reserve meaningful loading UI in Suspense.

## Visual rules

- Public collection dividers, rows, and empty/error panels must meet both inner rails. Padded text stays inside the gutter. Use FramedCollection rather than inventing negative margins or manually drawn borders.
- Similar collection sections retain a CollectionHeading (label, title, count/action) even with zero records. Distinguish an empty catalogue from a filtered-out result.
- Repeated editorial columns must share the same grid and gap. Compare heading start positions across sections, not only the outer container edges.
- Workspace pages share outer width, gutters, compact record headers, panel title scale and field spacing. Short fields form useful desktop pairs; long text spans a row; mobile stacks without overflow or stranded half-fields.
- Primary save/submit actions go right; related test controls stay together and align to the input baseline. Preserve usable touch targets and visible focus.
- Initial loads may show skeletons. Refreshes must keep controls mounted and preserve focus, draft input, pagination, and the last successful result when requests fail.

## Verification

Use browser inspection for the affected state and its sibling surfaces: home, people, departments, papers, datasets, projects, positions; include relevant workspace callers when shared components change. Check desktop and a narrow mobile viewport, both rails, heading columns, and overflow. Inspect DevTools insights instead of hiding them with `instant = false`.

When empty-database testing is requested, create a separately named local database, initialize schema without seeding, and run separate API/frontend ports with isolated frontend output and cache namespace. Never clear the populated database. Compare its counts before/after. Keep production untouched unless separately authorized.

Run checks proportionate to the change: typecheck and component/architecture verification for shared interfaces, focused behavioral regressions for logic, and screenshots for layout. Save screenshot proof and report exactly which states were checked. Do not claim the whole site was visually verified from one page.
