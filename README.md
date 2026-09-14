# Field Notes - Fashion Companion

Personal, mobile-first PWA for building outfits from a private wardrobe. It is intentionally local-first: no login, backend, Firebase or paid API is required.

## V2 features

- Anchor-piece outfit generation: the anchor never changes when generating variations.
- Interactive outfit builder with per-layer Lock, Swap and direct replacement.
- Manual outfit builder: choose your own pieces and evaluate the result.
- Four controlled variation moods: Safe, Rugged, Clean and Interesting.
- Outfit scoring split into Color (55%), Silhouette (35%) and Context (10%).
- Color engine with perceptual matching, garment visual weight and protagonist/accent control.
- Silhouette engine with fit volume, structure, garment length, visual weight and layering rules.
- Context filters for Hot/Mild/Cold, Dry/Rain and Casual/Smart/Any.
- Wardrobe CRUD: add, edit, archive or delete pieces.
- Optional garment photos stored locally in IndexedDB.
- Detailed garment metadata, including seasons and pants-specific rise/leg shape.
- Camera color capture with up to three robust samples; highlights and deep shadows are reduced before calculating the final color.
- Curated Wada-Sanzo-inspired palette studies that can now build outfits from the real wardrobe.
- Saved outfits with Wear Again.
- JSON import/export backup.
- Installable/offline PWA ready for GitHub Pages.

## Stack

- React + TypeScript
- Vite
- vite-plugin-pwa
- Dexie / IndexedDB
- Native Canvas and Camera/File APIs
- Custom CSS; no UI framework

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown by Vite, normally `http://localhost:5173`.

## Production check

```bash
npm run build
npm run preview
```

## GitHub Pages

The repository includes `.github/workflows/deploy.yml`.

1. Push the project to the `main` branch of a GitHub repository.
2. Open **Settings > Pages** in GitHub.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`; the included workflow installs dependencies, builds the PWA and deploys `dist`.

Vite uses a relative base (`./`), so the same project can be deployed under a GitHub Pages repository subpath without hard-coding the repository name.

## Data model

Wardrobe data is stored in IndexedDB on the current browser/device. A JSON export includes wardrobe items, garment photos and saved outfits. Keep a backup before clearing site data or changing phones.

The demo wardrobe is seeded only once. Clearing or editing it will not make the demo data reappear automatically.
