# EnhanceResume

A self-hosted, multi-tenant resume builder with live preview, drag & drop editing, 10 templates, full design control and server-side PDF export. Ships as a single Docker container.

![Dashboard](docs/screenshots/dashboard.png)

![Editor with live preview and drag & drop sections](docs/screenshots/editor.png)

![Dark mode with a dark resume theme and photo](docs/screenshots/dark-mode.png)

| Design controls | Templates |
|---|---|
| ![Design tab](docs/screenshots/design.png) | ![Templates tab](docs/screenshots/templates.png) |

## Run

```bash
git clone https://github.com/amurikurthy/enhanceresume.git && cd enhanceresume
docker compose up -d --build     # then open http://localhost:3000
```

Common commands: `docker compose logs -f` (logs), `docker compose down` (stop; data is kept), `docker compose down -v` (stop and **delete all data**), `docker compose up -d --build` (rebuild after pulling updates).

### docker-compose.yml

The repo ships this file; edit the environment values to suit:

```yaml
services:
  enhanceresume:
    build: .
    image: enhanceresume:latest
    container_name: enhanceresume
    restart: unless-stopped
    ports:
      - "3000:3000"            # host:container, change the left side to use another port
    environment:
      ALLOW_REGISTRATION: "true"   # "false" closes sign-ups
      COOKIE_SECURE: "false"       # "true" when served over HTTPS
      # TRUST_PROXY: "true"        # enable behind nginx/traefik
      MAX_RESUMES_PER_USER: "50"
      PDF_CONCURRENCY: "3"
    volumes:
      - er-data:/data          # SQLite database persists here
    shm_size: "512mb"          # Chromium needs shared memory for PDF rendering
volumes:
  er-data:
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

- **Templates**: Classic Duo, Modern Sidebar, Executive Serif, Bold Banner, Minimal Plain, Compact Pro, Creative Teal, Elegant Rose, Midnight Dark, Charcoal Gold – previewed with your own content.
- **Dark mode**: the app UI follows your system setting with a toggle (☾/☀) in the top bar. Resumes have their own light & dark themes (Midnight, Charcoal, Forest, Plum, Paper, Mist) plus 12 accent colors, applied from the Design tab.
- **Photos**: upload a profile photo (auto square-cropped) from *Header & contact*; choose circle / rounded / square, left or right, and size in *Design → Header*, or hide it.
- **Drag & drop**: reorder sections, move them between main column and sidebar, reorder entries, bullets, skill groups, skills/tags, contacts.
- **Sections**: summary, experience, education, projects, volunteering, publications, skills (chips/pills/commas/pipes), certifications (with icons), achievements, interests, languages (dots/bars/text), custom text. Entries support logos, links, `**bold**`/`*italic*` markup.
- **Design**: 12 color themes + full custom colors, 20 bundled fonts (offline), margins, spacing, font size, line height, column width, sidebar fill, header styles (left/center/banner), photo shape/size/position, heading styles, bullet styles, date styles, background patterns (dots, grid, lines, diagonal, crosshatch, circles, waves, zigzag, triangles) for header or whole page, A4 / US Letter.
- **PDF**: real vector PDF with selectable text and clickable links, rendered by headless Chromium from the exact same renderer as the preview; margins repeat on every page.
- **Multi-tenancy**: every query is scoped to the signed-in account; scrypt password hashing, HttpOnly SameSite sessions, CSRF header, login rate limiting. Resume JSON import/export on the dashboard.

## Layout

`shared/` renderer, templates and CSS (used by browser and server) · `server/` Express + SQLite + PDF · `public/` single-page app · `test/` smoke tests (`npm test`).

Note: the preview's red dashed lines mark *approximate* page breaks; the PDF is authoritative (it keeps entries and bullets together across pages).
