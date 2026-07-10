# LinkHub: Local-First Link Organizer

LinkHub is a beautiful, local-first start-page and bookmark manager inspired by start.me. It organizes links in a **Pages → Sections → Links** hierarchy and stores all data locally in the browser's IndexedDB.

It builds into two separate targets from a single shared codebase:
1. **Chrome Extension (Manifest V3)** — Overrides the browser's New Tab page.
2. **Standalone Web App** — A standard static site runnable without extension APIs.

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server (Web Sandbox)
```bash
npm run dev
```

### 3. Build Both Targets
```bash
npm run build
```
This produces two output directories:
- `dist/standalone/` — Static web dashboard.
- `dist/extension/` — Chrome extension override files (including `manifest.json`).

---

## Deploy & Run Targets

### Chrome Extension (Manifest V3)
1. Build the extension target: `npm run build:extension`
2. Open Chrome and go to `chrome://extensions/`
3. Toggle **Developer mode** (top-right corner).
4. Click **Load unpacked** (top-left corner).
5. Select the `dist/extension` folder.
6. Open a new tab to see LinkHub load!

### Standalone Web App
1. Build the web target: `npm run build:web`
2. Run using any local static file server (avoid opening `file://` directly as browser IndexedDB behavior is inconsistent under file paths):
   ```bash
   npx http-server dist/standalone
   ```
3. Open the localhost address printed in the terminal.
