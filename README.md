# Coin Toss — mini web game

Small “coin toss” game with Pixi.js animation, a mock API, sound effects, batch mode, and locally persisted result history.

## Features

- **Single toss**: pick Heads/Tails → flip animation → smooth settle to the API result → Win/Lose toast.
- **Batch tosses**: quick actions ×5 / ×10, or a custom count (up to 50) + **Stop**.
- **History**: Redux Toolkit + localStorage (capped length), preview + expandable list with pagination.
- **Sound**: “toss” and “landing” SFX with reliable mobile playback (unlock on first user interaction + a small audio element pool).
- **Resilience**: mock-API timeout/error shows an error toast, stops the round, and **does not write** to history.

## Tech

- Vite + React + TypeScript
- Pixi.js v8 + @pixi/react v8
- Redux Toolkit + react-redux
- ESLint + Prettier

## Quick start

### Requirements

- Node.js (preferably 18+)

### Install & run

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173).

### Useful scripts

```bash
npm run build     # production build
npm run preview   # preview production build
npm run lint      # eslint
npm run lint:fix  # eslint with auto-fixes
npm run format    # prettier
```

## Assets

Static files live in `public/`:

- `public/heads.png`, `public/tails.png` — coin face textures
- `public/coin-drop-sound.mp3`, `public/coin-landing-sound.mp3` — SFX

## Code structure (high level)

- `src/App.tsx` — UI, single/batch flow, history UI
- `src/api/mockCoinToss.ts` — mock API (random Heads/Tails), delay, AbortSignal
- `src/game/useCoinTossGame.ts` — round state machine, timeouts/errors, “animation + API” orchestration
- `src/pixi/CoinStage.tsx` — Pixi `<Application>` + responsive resize-to-container
- `src/pixi/Coin.tsx` — flip/settle animation (Pixi ticker) + `onLanding`/`onSettled` callbacks
- `src/pixi/useTexture.ts` — texture loading (Assets.load) with fallback
- `src/pixi/extendPixi.ts` — registers Pixi classes for JSX intrinsic elements; imported in `src/main.tsx`
- `src/hooks/useSfx.ts` — SFX hook (pool + `unlock()` + `play()`)
- `src/hooks/useElementSize.ts` — container measurement via ResizeObserver
- `src/store/historySlice.ts` — Redux history slice (capped length)
- `src/store/storage.ts` / `src/store/store.ts` — localStorage persistence and RTK store

## Key decisions (and why)

- **Pixi + @pixi/react v8**: fast canvas rendering with a React-friendly component model.
- **`extendPixi` for JSX intrinsic elements**: required in v8 so elements like `pixiGraphics` render correctly.
- **Avoid remounting `<Application>` on resize**: prevents canvas flicker during layout changes; use `resizeTo` instead.
- **ResizeObserver for sizing**: stable container measurements and avoids a “1×1 canvas” at startup.
- **Parallel “animation + API” flow**: the flip starts immediately, and the final settle happens after the API response, reducing perceived latency.
- **Mobile audio**: call `unlock()` on first user interaction + use an audio pool so rapid repeats (especially in batch mode) still play.
- **History via Redux + persistence**: predictable data model for UI (preview/pagination) and survives reloads; the **cap** prevents localStorage from growing indefinitely.
- **Batch mode without per-toss toasts**: suppresses message spam so UI stays stable and fast.
