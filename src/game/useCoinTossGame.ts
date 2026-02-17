import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchMockCoinToss } from '../api/mockCoinToss'
import type { CoinSide, GameMessage, GameState } from './types'

/**
 * Game state machine hook.
 *
 * Owns the round lifecycle (idle → flipping → message → idle), runs the mock API request with
 * timeout/error handling, and produces the toast message shown to the user.
 */
const MESSAGE_MS = 2500
const REQUEST_TIMEOUT_MS = 8000

function formatSide(side: CoinSide) {
  return side === 'heads' ? 'Heads' : 'Tails'
}

function pickMessage(playerChoice: CoinSide, result: CoinSide): GameMessage {
  const choiceLabel = formatSide(playerChoice)
  const resultLabel = formatSide(result)

  if (playerChoice === result) {
    const options = [
      `Called it — ${resultLabel}!`,
      `Nice read. ${resultLabel} it is.`,
      `That’s a clean pick: ${resultLabel}.`,
      `${resultLabel} lands. Great guess.`,
      `Big brain moment — ${resultLabel}.`,
    ]
    return options[Math.floor(Math.random() * options.length)]
  }

  const options = [
    `Ahh, ${resultLabel} this time. Run it back.`,
    `So close… ${resultLabel} had other plans.`,
    `Not your day: ${resultLabel}. Again?`,
    `Your pick was ${choiceLabel}. The coin said ${resultLabel}.`,
    `${resultLabel} lands — revenge toss?`,
  ]
  return options[Math.floor(Math.random() * options.length)]
}

export function useCoinTossGame() {
  const abortRef = useRef<AbortController | null>(null)
  const messageTimerRef = useRef<number | null>(null)
  const requestTimerRef = useRef<number | null>(null)
  const stateRef = useRef<GameState | null>(null)

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

  const showErrorThenReset = useCallback((message: string) => {
    clearMessageTimer()

    setState((prev) => {
      if (prev.status !== 'flipping') return prev
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

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    requestTimerRef.current = window.setTimeout(() => {
      // Only fail the currently active request.
      if (abortRef.current !== controller) return
      try {
        controller.abort()
      } catch {
        // ignore
      }

      // If still flipping, show a timeout message.
      if (stateRef.current?.status !== 'flipping') return
      showErrorThenReset('Could not get a result (timeout). Try again.')
    }, REQUEST_TIMEOUT_MS)

    fetchMockCoinToss(controller.signal)
      .then((res) => {
        if (abortRef.current !== controller) return
        clearRequestTimer()
        setState((prev) => {
          if (prev.status !== 'flipping') return prev
          return { ...prev, apiResult: res.result, isLoading: false }
        })
      })
      .catch((err: unknown) => {
        if (abortRef.current !== controller) return
        clearRequestTimer()
        if (err instanceof DOMException && err.name === 'AbortError') return
        showErrorThenReset('Could not get a result. Please try again.')
      })
  }, [clearMessageTimer, clearRequestTimer, showErrorThenReset])

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
