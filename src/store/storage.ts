import type { TossHistoryEntry } from './historySlice'

const KEY = 'coin.tossHistory.v1'

export function loadHistory(): TossHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((e) => typeof e === 'object' && e !== null)
      .map((e) => e as TossHistoryEntry)
      .filter(
        (e) =>
          typeof e.id === 'string' &&
          typeof e.ts === 'number' &&
          typeof e.roundId === 'number' &&
          (e.choice === 'heads' || e.choice === 'tails') &&
          (e.result === 'heads' || e.result === 'tails') &&
          (e.outcome === 'win' || e.outcome === 'lose'),
      )
  } catch {
    return []
  }
}

export function saveHistory(entries: TossHistoryEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}
