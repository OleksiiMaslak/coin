import { configureStore } from '@reduxjs/toolkit'
import { historyReducer } from './historySlice'
import { loadHistory, saveHistory } from './storage'

export const store = configureStore({
  reducer: {
    history: historyReducer,
  },
  preloadedState: {
    history: {
      entries: loadHistory(),
    },
  },
})

store.subscribe(() => {
  const entries = store.getState().history.entries
  saveHistory(entries)
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
