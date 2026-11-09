# EnhanceResume

A self-hosted, multi-tenant resume builder in the style of Enhancv: live preview, drag & drop editing, 8 templates, full design control and server-side PDF export. Ships as a single Docker container.

## Run

```bash
docker compose up --build        # then open http://localhost:3000
```

Create an account on the sign-in page. Data (SQLite) lives in the `er-data` volume at `/data`.

| Env var | Default | Purpose |
|---|---|---|
| `ALLOW_REGISTRATION` | `true` | set `false` to close sign-ups |
| `COOKIE_SECURE` | auto | `true` when served over HTTPS |
| `TRUST_PROXY` | – | `true` behind a reverse proxy (correct client IPs for rate limits) |
| `MAX_RESUMES_PER_USER` | `50` | per-account cap |
| `PDF_CONCURRENCY` | `3` | simultaneous Chromium renders |

Without Docker: `npm ci && npm run build:assets && npm start` (Node ≥ 22.13, Chromium via `CHROME_PATH`).

## Features

- **Templates**: Classic Duo, Modern Sidebar, Executive Serif, Bold Banner, Minimal Plain, Compact Pro, Creative Teal, Elegant Rose – previewed with your own content.
- **Drag & drop**: reorder sections, move them between main column and sidebar, reorder entries, bullets, skill groups, skills/tags, contacts.
- **Sections**: summary, experience, education, projects, volunteering, publications, skills (chips/pills/commas/pipes), certifications (with icons), achievements, interests, languages (dots/bars/text), custom text. Entries support logos, links, `**bold**`/`*italic*` markup.
- **Design**: 12 color themes + full custom colors, 20 bundled fonts (offline), margins, spacing, font size, line height, column width, sidebar fill, header styles (left/center/banner), photo shape/size/position, heading styles, bullet styles, date styles, background patterns (dots, grid, lines, diagonal, crosshatch, circles, waves, zigzag, triangles) for header or whole page, A4 / US Letter.
- **PDF**: real vector PDF with selectable text and clickable links, rendered by headless Chromium from the exact same renderer as the preview; margins repeat on every page.
- **Multi-tenancy**: every query is scoped to the signed-in account; scrypt password hashing, HttpOnly SameSite sessions, CSRF header, login rate limiting. Resume JSON import/export on the dashboard.

## Layout

`shared/` renderer, templates and CSS (used by browser and server) · `server/` Express + SQLite + PDF · `public/` single-page app · `test/` smoke tests (`npm test`).

Note: the preview's red dashed lines mark *approximate* page breaks; the PDF is authoritative (it keeps entries and bullets together across pages).
