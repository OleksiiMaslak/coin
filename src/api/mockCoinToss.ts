import type { CoinSide } from '../game/types'

/**
 * Mock async API for coin toss results.
 *
 * Returns a random side after a short delay and supports aborting via AbortSignal.
 */
export interface CoinTossResponse {
  result: CoinSide
}

const randomDelayMs = (min: number, max: number) =>
  Math.floor(min + Math.random() * (max - min + 1))

export function fetchMockCoinToss(signal?: AbortSignal): Promise<CoinTossResponse> {
  const delay = randomDelayMs(500, 1500)
  const result: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails'

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      resolve({ result })
    }, delay)

    const onAbort = () => {
      clearTimeout(timeoutId)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
