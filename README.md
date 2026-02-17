# Coin Toss — Mini Web Game

Interactive "Coin Toss" game built for the Frontend Developer (Web Games) test.

## Tech Stack

- Vite + React + TypeScript
- Pixi.js + @pixi/react
- Animations via Pixi built-in ticker (`useTick`)
- Mock API: `Math.random()` + 500–1500ms latency

## Gameplay

1. Choose **Heads** or **Tails**.
2. A mock API request is fired in parallel with the coin flip animation.
3. When the API responds, the coin smoothly settles on the returned side.
4. A popup shows **You Win!** / **You Lose!** for ~2.5 seconds.
5. Start the next round.

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview build
- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`

## Project Structure

- `src/api/mockCoinToss.ts` — mock backend request
- `src/game/useCoinTossGame.ts` — round state + transitions
- `src/pixi/Coin.tsx` — coin visuals + flip/settle animation
- `src/pixi/CoinStage.tsx` — responsive Pixi stage wrapper

## Notes / Next Steps (optional)

- Replace primitive coin with images and add SFX (easy to plug into the current architecture).
