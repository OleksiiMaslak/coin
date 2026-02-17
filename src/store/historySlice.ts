import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { CoinSide } from '../game/types'

/**
 * Redux slice for coin toss history, persisted to localStorage with a fixed max length.
 */
export type TossHistoryEntry = {
  id: string
  ts: number
  roundId: number
  choice: CoinSide
  result: CoinSide
  outcome: 'win' | 'lose'
}

type HistoryState = {
  entries: TossHistoryEntry[]
}

export const MAX_ENTRIES = 50

const initialState: HistoryState = {
  entries: [],
}

export const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    setHistory(state, action: PayloadAction<TossHistoryEntry[]>) {
      state.entries = action.payload
    },
    addEntry(state, action: PayloadAction<TossHistoryEntry>) {
      state.entries.unshift(action.payload)
      if (state.entries.length > MAX_ENTRIES) {
        state.entries.length = MAX_ENTRIES
      }
    },
  },
})

export const { addEntry, setHistory } = historySlice.actions
export const historyReducer = historySlice.reducer
