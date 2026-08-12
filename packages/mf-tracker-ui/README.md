# mf-tracker-ui

Shared **design tokens** and **product chrome** for MasterFabric Tracker clients (`mf-web`, `mf-desktop`).

Visual language follows [masterfabric.co](https://masterfabric.co): **Inter**, slate-800 mark (`#1E293B`), gray-900 body, white/slate surfaces — product chrome, not a marketing clone.

## Imports

```css
@import "mf-tracker-ui/tokens.css";
@import "mf-tracker-ui/chrome.css";
```

JS hex constants (docs / Expo alignment):

```ts
import { mfBrand } from "mf-tracker-ui/tokens";
```

## Ownership

| File | Contents |
|------|----------|
| `tokens.css` | `:root` / `.dark` semantic + `--mf-*` brand vars |
| `chrome.css` | Shared utilities (sidebar brand, buttons, panels, nav ink bar) |
| App globals | `@theme` mapping, auth/marketing extras (desktop), shadcn |

App-specific CSS (auth shell motion, dashboard ops modules) stays in `mf-desktop` / `mf-web` until those surfaces are shared.
