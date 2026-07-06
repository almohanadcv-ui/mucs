# MCS — MAB United Control System

A premium, single-page **gateway** to every MAB United operational system.

> MCS is **only** a landing page. It has **no** backend, no auth, no database, and
> no API. It introduces each independent system and redirects the user to it.
> Existing systems are never modified, embedded, or coupled — MCS just links out.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (light/dark tokens, no config file)
- **Framer Motion** (scroll-reveal, hero, micro-interactions)
- **Lucide** icons
- **next-themes** (system-aware light/dark with persisted manual override)

## Getting started

```bash
pnpm install     # or npm install / yarn
pnpm dev         # http://localhost:3000
pnpm build && pnpm start
```

## Adding / editing a system

Everything on the page is generated from **one file**: [`src/config/systems.ts`](src/config/systems.ts).

Systems are bilingual — every text field carries `{ en, ar }`. To add a new
system, append one object to the `systems` array (its section is generated in
both languages automatically):

```ts
{
  id: "assets",                 // anchor slug (#assets)
  name: "Assets",
  eyebrow: { en: "Inventory", ar: "المخزون" },
  description: { en: "…", ar: "…" },
  features: { en: ["…", "…"], ar: ["…", "…"] },
  url: "https://assets.mucs.online",
  icon: Boxes,                  // any lucide-react icon
  color: "#e0567a",             // accent (themes preview + button)
  status: "live",               // live | beta | maintenance | coming-soon
  preview: "table",             // analytics | table | kanban | form
  // image: "/previews/assets.webp",  // optional real screenshot
}
```

The page automatically renders a new full-height section for it, alternating
image-left / image-right, with scroll-in animations. **No component changes needed.**

### Current systems (order = order on the page)

| # | System | Source folder | Env override |
|---|--------|---------------|--------------|
| 1 | IT Support | `../IT SUPPORT` | `NEXT_PUBLIC_SUPPORT_URL` |
| 2 | GET PASS | `../GET PASS` | `NEXT_PUBLIC_GETPASS_URL` |
| 3 | MICA | `../MICA` | `NEXT_PUBLIC_MICA_URL` |
| 4 | Evaluation | `../evaluation` | `NEXT_PUBLIC_EVALUATION_URL` |

## Replacing preview images

Each section renders a generated dashboard mockup by default. To use a real
screenshot, drop a WebP into `public/previews/` and set `image` on the system.
Images are lazy-loaded and optimized by `next/image`.

## Redirect targets

Default URLs live in the config and can be overridden per environment with
`NEXT_PUBLIC_*` variables — see [`.env.example`](.env.example). Recommended
architecture is one landing origin that links out to each system's own
subdomain, keeping every system fully independent.

## Notes

- Fully responsive (mobile → ultrawide), stacks vertically on tablet/mobile.
- Accessible: skip link, focus-visible rings, semantic landmarks, reduced-motion aware.
- SEO: metadata, OpenGraph/Twitter, theme-color, robots.
