---
name: nextjs16-check
description: Pre-flight checklist for Next.js 16 + React 19 patterns specific to whatascrap. Consult before writing route handlers, hooks, or polling components in frontend/src.
user-invocable: false
---

# Next 16 / React 19 gotchas in this repo

The `frontend/AGENTS.md` warning is real: this Next.js version post-dates the training cutoff. When unsure of an API, read the relevant guide in `frontend/node_modules/next/dist/docs/01-app/03-api-reference/` before writing code.

## Route handlers — params are async

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

Do NOT write `params: { id: string }` — that's the old shape and will silently mistype.

## React 19 hook rules (lint will reject)

- `react-hooks/set-state-in-effect`: never call `setState` from `useEffect` to derive state from props. Use the **reset-by-key** trick instead — see `SelectableGrid` in `frontend/src/components/LibraryClient.tsx` for the canonical pattern.
- `react-hooks/refs`: refs are read-only outside lifecycle callbacks. Don't write `ref.current` during render.

## Known-bad files — leave alone unless asked

- `frontend/src/components/JobsPanel.tsx`
- `frontend/src/components/Sidebar.tsx`

These have pre-existing lint errors documented in `CLAUDE.md`.

## Polling

Two patterns exist; both use `fetch` + `setState`. Never call `router.refresh()` from a `setInterval` — it races with navigation and bounces between routes.
