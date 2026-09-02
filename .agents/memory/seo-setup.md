---
name: SEO setup (SPA meta injection)
description: How openradio.io serves per-route SEO metadata despite being a client-rendered SPA
---

# SEO setup

The frontend is an SSR-less Vite SPA, so crawlers/unfurlers must get correct metadata from the raw HTML — client-side head mutation alone is not enough.

- **Server-side injection is the source of truth for crawlers:** the api-server SPA fallback rewrites the built index.html per route (title, description, canonical, OG/Twitter, robots) via `renderIndexHtml` in api-server `lib/seo-meta.ts`. JSON-LD (SoftwareApplication + FAQPage) is injected only for `/`.
- **Client `useSeo` hook** (voiceover-tool `lib/seo.ts`) only keeps the head correct during client-side navigation; its cleanup restores the FULL baseline (title/desc/canonical/OG/robots) so app routes never keep a marketing page's canonical.
- **Keep in sync:** PAGE_META in seo-meta.ts must mirror the per-page `useSeo` calls, and the server FAQ_ITEMS must mirror landing.tsx FAQ_ITEMS.
- **Policy:** `/login` + `/register` are noindex and excluded from sitemap.xml; unknown routes (app/private pages) get noindex automatically. sitemap.xml + robots.txt live in voiceover-tool `public/`.
- **Why:** architect review confirmed crawlers that skip JS previously saw homepage canonical/meta on every route, which would have canonicalized all pages to `/`.
