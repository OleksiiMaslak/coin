import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchMockCoinToss } from '../api/mockCoinToss'
import type { CoinSide, GameMessage, GameState } from './types'

/**
 * Game state machine hook.
 *
 * Owns the round lifecycle (idle → flipping → message → idle), starts the mock API request when
 * the round actually enters `flipping` (StrictMode-safe), handles timeout/errors, and produces
 * the toast message shown to the user.
 */
const MESSAGE_MS = 2500
const REQUEST_TIMEOUT_MS = 8000

function pickMessage(playerChoice: CoinSide, result: CoinSide): GameMessage {
  if (playerChoice === result) {
    return 'You Win!'
  }

  return 'You Lose!'
}

export function useCoinTossGame() {
  const abortRef = useRef<AbortController | null>(null)
  const messageTimerRef = useRef<number | null>(null)
  const requestTimerRef = useRef<number | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const inFlightRoundRef = useRef<number | null>(null)

  const [state, setState] = useState<GameState>(() => ({
    status: 'idle',
    roundId: 0,
    playerChoice: null,
    apiResult: null,
    isLoading: false,
    message: null,
  }))

  const clearMessageTimer = useCallback(() => {
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current)
      messageTimerRef.current = null
    }
  }, [])

  const clearRequestTimer = useCallback(() => {
    if (requestTimerRef.current !== null) {
      window.clearTimeout(requestTimerRef.current)
      requestTimerRef.current = null
    }
  }, [])

  const showErrorThenReset = useCallback((roundId: number, message: string) => {
    clearMessageTimer()

    setState((prev) => {
      if (prev.status !== 'flipping') return prev
      if (prev.roundId !== roundId) return prev
      return {
        ...prev,
        status: 'message',
        isLoading: false,
        apiResult: null,
        message,
      }
    })

    messageTimerRef.current = window.setTimeout(() => {
      setState((prev) => {
        if (prev.status !== 'message') return prev
        if (prev.roundId !== roundId) return prev
        return {
          status: 'idle',
          roundId: prev.roundId,
          playerChoice: null,
          apiResult: null,
          isLoading: false,
          message: null,
        }
      })
    }, MESSAGE_MS)
  }, [clearMessageTimer])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      clearMessageTimer()
      clearRequestTimer()
    }
  }, [clearMessageTimer, clearRequestTimer])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (state.status !== 'flipping') return
    if (!state.playerChoice) return
    if (state.apiResult !== null) return
    if (!state.isLoading) return

    // Start the request when we are *actually* in flipping state.
    // This avoids races with extremely fast (delay=0) responses and is StrictMode-safe.
    if (inFlightRoundRef.current === state.roundId) return
    inFlightRoundRef.current = state.roundId

    abortRef.current?.abort()
    clearRequestTimer()

    const controller = new AbortController()
    abortRef.current = controller
    const roundId = state.roundId

    requestTimerRef.current = window.setTimeout(() => {
      if (abortRef.current !== controller) return
      try {
        controller.abort()
      } catch {
        // ignore
      }

      const current = stateRef.current
      if (!current) return
      if (current.status !== 'flipping') return
      if (current.roundId !== roundId) return

      showErrorThenReset(roundId, 'Could not get a result (timeout). Try again.')
    }, REQUEST_TIMEOUT_MS)

    fetchMockCoinToss(controller.signal)
      .then((res) => {
        if (abortRef.current !== controller) return
        clearRequestTimer()

        setState((prev) => {
          if (prev.status !== 'flipping') return prev
          if (prev.roundId !== roundId) return prev
          return { ...prev, apiResult: res.result, isLoading: false }
        })
      })
      .catch((err: unknown) => {
        if (abortRef.current !== controller) return
        clearRequestTimer()
        if (err instanceof DOMException && err.name === 'AbortError') return
        showErrorThenReset(roundId, 'Could not get a result. Please try again.')
      })
  }, [state.status, state.roundId, state.playerChoice, state.apiResult, state.isLoading, clearRequestTimer, showErrorThenReset])

  const startRound = useCallback((choice: CoinSide) => {
    clearMessageTimer()
    clearRequestTimer()

    setState((prev) => {
      if (prev.status !== 'idle' && prev.status !== 'message') return prev

      return {
        status: 'flipping',
        roundId: prev.roundId + 1,
        playerChoice: choice,
        apiResult: null,
        isLoading: true,
        message: null,
      }
    })
  }, [clearMessageTimer, clearRequestTimer])

  const onCoinSettled = useCallback((
    side: CoinSide,
    roundId: number,
    opts?: { showMessage?: boolean; messageMs?: number },
  ) => {
    const showMessage = opts?.showMessage !== false
    const messageMs = opts?.messageMs ?? MESSAGE_MS

    setState((prev) => {
      if (prev.status !== 'flipping') return prev
      if (prev.roundId !== roundId) return prev
      if (!prev.playerChoice) return prev

      if (!showMessage) {
        return {
          status: 'idle',
          roundId: prev.roundId,
          playerChoice: null,
          apiResult: null,
          isLoading: false,
          message: null,
        }
      }

      const message: GameMessage = pickMessage(prev.playerChoice, side)

      return {
        ...prev,
        status: 'message',
        message,
      }
    })

    clearMessageTimer()

    if (!showMessage) return

    messageTimerRef.current = window.setTimeout(() => {
      setState((prev) => {
        if (prev.roundId !== roundId) return prev
        return {
          status: 'idle',
          roundId: prev.roundId,
          playerChoice: null,
          apiResult: null,
          isLoading: false,
          message: null,
        }
      })
    }, messageMs)
  }, [clearMessageTimer])

  return useMemo(
    () => ({
      state,
      startRound,
      onCoinSettled,
    }),
    [state, startRound, onCoinSettled],
  )
}
