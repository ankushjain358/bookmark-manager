# Developer Agent Rules & Guide

If you are a coding agent working on LinkHub, you MUST adhere to the architecture, rules, and guidelines outlined below.

---

## 1. Project Structure Overview

```
src/
├── main.tsx             <- Standard entry
├── index.css            <- Design tokens, Tailwind directives, glassmorphic styles
├── App.tsx              <- Root coordinator, FlexSearch bootstrapper, empty state hero
├── utils.ts             <- Classname merger utility (cn)
├── db/
│   ├── schema.ts        <- Dexie database declaration (LinkHubDB)
│   ├── operations.ts    <- Database CRUD actions and index updates
│   └── favicon.ts       <- Favicon caching and download helper
├── platform/
│   ├── types.ts         <- PlatformAdapter interface
│   ├── platform.web.ts  <- Standalone web resolver
│   └── platform.extension.ts <- Chrome Extension API resolver
├── search/
│   └── index.ts         <- FlexSearch wrapper index
├── import-export/
│   ├── json.ts          <- JSON lossless importer/exporter
│   ├── netscape.ts      <- Netscape Bookmark HTML importer/exporter
│   └── dedup.ts         <- Merge and duplicate filter logic
└── components/
    ├── ui/              <- Radix/Tailwind custom primitives
    ├── Layout.tsx       <- Header bar, search bar, sortable page tab bar
    ├── PageGrid.tsx     <- Sortable section grid list
    ├── SectionCard.tsx  <- Sortable link card list, move-to-page dialog
    ├── LinkItem.tsx     <- Link card display, edit/delete actions
    └── SettingsDialog.tsx <- Import/Export tabs, merge options, hard reset
```

---

## 2. Platform Adapter Isolation Boundary

> [!CRITICAL]
> **Rule**: Shared application logic (anything outside `src/platform/`) MUST NEVER import `chrome.*` APIs directly, nor references them.
>
> All extension-specific behaviors must be wrapped inside the `PlatformAdapter` interface in `src/platform/types.ts`. 
> During development and compilation, components must import from `@platform` (defined as an alias in `vite.config.ts` and `tsconfig.app.json` that resolves to either `platform.web.ts` or `platform.extension.ts` at build time).

---

## 3. Dexie.js Schema Migrations

When modifying or adding database schema stores or indexes in `src/db/schema.ts`, follow Dexie's migration rules:
1. Increment the version number: `this.version(X)`
2. Add the modified stores to the list. Do not delete past versions; Dexie requires past versions to be declared in order to upgrade successfully.
3. Example:
   ```typescript
   // Version 1
   this.version(1).stores({
     pages: '++id, order',
     sections: '++id, pageId, order',
     links: '++id, sectionId, normalizedUrl, order',
     faviconCache: 'domain'
   });

   // Version 2 (new migration)
   this.version(2).stores({
     links: '++id, sectionId, normalizedUrl, order, *tags' // added tag indexing
   }).upgrade(tx => {
     // Optional database upgrade migration script
   });
   ```

---

## 4. Testing & Running Both Build Targets

Before making commits, verify both build targets compile without any linting or TypeScript compilation errors:

- Run development server (web target):
  ```bash
  npm run dev
  ```
- Build and compile both targets:
  ```bash
  npm run build
  ```
  Ensure `dist/standalone` and `dist/extension` folders are compiled. Check that `dist/extension/manifest.json` is correctly copied.

---

## 5. Import Deduplication & Flattening Invariants

If you refactor the import-export layer, you MUST preserve the following requirements:
1. **Name Matching**: Pages and Sections must be matched by case-insensitive name inside their parent page scope. Re-importing bookmarks must merge new links into existing pages/sections instead of appending duplicate workspaces (e.g. "Bookmarks Bar (2)").
2. **URL Normalization**: Links must be matched and deduplicated by their `normalizedUrl`. This treats `http://google.com` and `https://google.com/` as equal, lowercases hostnames, removes default ports (80, 443), and strips trailing slashes.
3. **HTML Flattening**: During Netscape HTML imports, folder structures deeper than 2 levels must be flattened into the nearest ancestor section, and the sub-folders path (e.g., `Coding/TypeScript`) must be added to the link's `tags` array to avoid data loss.
