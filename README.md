# Trickster — a trickster-god roguelike deckbuilder

Prototype. TypeScript + Vite + Phaser 4.

You are a trickster god gaslighting a village of NPCs. **Lie cards** rewrite
reality — but every lie adds **Paradox**. Contradict yourself and the villagers
get Suspicious; lean in and they become Devoted (or Paranoid). Shapeshift
between forms to change how the village sees you.

## Dev

```bash
npm install
npm run dev
```

Open http://localhost:5173 — press SPACE to draw, drag cards into the play zone.

## Build

```bash
npm run build
```

Static output in `dist/` — host anywhere. Vite `base` is `./` so it works on
any subpath (including GitHub Pages project sites).

## Deploy

Push to `main` → GitHub Actions builds and deploys `dist/` to GitHub Pages
(see `.github/workflows/deploy.yml`). Enable Pages once: repo Settings →
Pages → Source: **GitHub Actions**.
