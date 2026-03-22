# AI Log

## 2026-03-22

- Reviewed project docs (`00-README`, `01-ARCHITECTURE`, `07-DEVELOPMENT-LOG`, `10-AGENT-LOG-MAINTENANCE`).
- Working rule confirmed:
  - Only UI files should be changed for UI requests.
  - Do not modify backend/API/connectivity/integration logic unless explicitly requested.
- Logging rule confirmed:
  - Every AI change should be recorded in this file (`docs/AI-LOG.md`).

## 2026-03-22 (UI Dark Mode + Gradient Borders)

- Implemented dark mode across dashboard UI pages only.
- Added gradient border utility class `.gradient-card` in `app/globals.css`.
- Updated UI files only:
  - `app/layout.tsx` (set root html dark class)
  - `components/DashboardLayout.tsx`
  - `app/dashboard/page.tsx`
  - `app/dashboard/connections/page.tsx`
  - `app/dashboard/content/page.tsx`
  - `app/dashboard/comments/page.tsx`
  - `app/dashboard/reports/page.tsx`
  - `app/dashboard/settings/page.tsx`
  - `app/globals.css`
- Explicitly avoided backend/API/connectivity changes.

## 2026-03-22 (Reports + Settings UX updates)

- Updated reports experience:
  - Added sentiment pie chart and platform distribution pie chart.
  - Added multi-line platform trend graph (YouTube, Instagram, Facebook) with x-axis driven by selected day range (`7d`, `30d`, `90d`).
  - Removed horizontal scrollbar from trend graph.
  - Enabled hover interaction from Sentiment Breakdown:
    - Hover `Positive` / `Neutral` / `Negative` to filter values in existing Platform Distribution and Platform Comments Trend graphs.
  - Updated section titles to show filter state inline, e.g. `Platform Distribution (Positive Sentiment)`.
- Updated reports text rendering:
  - HTML entity decoding for questions/concerns and comments-side strings.
  - Hidden zero-activity days in Recent Activity (days where comments = 0 and replies = 0).
- Updated settings page UX:
  - Visual polish of sections/cards/inputs in dark mode.
  - Dropdown dark styling improvements.
  - Removed spinner arrows from numeric inputs.
- Files updated during this cycle include:
  - `app/dashboard/reports/page.tsx`
  - `app/api/reports/route.ts`
  - `app/dashboard/settings/page.tsx`
  - `app/globals.css`

## 2026-03-22 (Demo dataset integration for Facebook/Instagram)

- Added a fake comments fixture for demo/testing:
  - `data/fixtures/facebook-instagram-comments.json`
  - Includes Instagram + Facebook comments with fields: `id`, `platform`, `contentId`, `contentTitle`, `author`, `text`, `publishedAt`, `sentiment`, `status`.

- Added demo fixture loader utility:
  - `lib/demo/fixture-comments.ts`
  - Responsibilities:
    - load JSON fixture from disk,
    - validate basic shape,
    - cache loaded records in memory,
    - expose `isDemoFixtureEnabled()` flag check.

- Integrated fixture data into APIs (merge mode):
  - `app/api/comments/route.ts`
    - When demo flag is enabled, fixture comments are appended to normal API response.
  - `app/api/reports/route.ts`
    - When demo flag is enabled, fixture comments are included in reports aggregates
      (sentiment breakdown, platform distribution, platform trends, sentiment-filtered platform aggregates).

- Feature toggle:
  - Enabled by either env var:
    - `ENABLE_DEMO_FIXTURES=true`
    - `NEXT_PUBLIC_ENABLE_DEMO_FIXTURES=true`
  - Default behavior remains unchanged when flags are not set.

- Demo impact:
  - Faster presentation setup without requiring live Facebook/Instagram traffic.
  - Deterministic sample data for chart demos and filters.
