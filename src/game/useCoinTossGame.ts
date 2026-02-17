import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchMockCoinToss } from '../api/mockCoinToss'
import type { CoinSide, GameMessage, GameState } from './types'

const MESSAGE_MS = 2500

export function useCoinTossGame() {
  const abortRef = useRef<AbortController | null>(null)
  const messageTimerRef = useRef<number | null>(null)

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

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      clearMessageTimer()
    }
  }, [clearMessageTimer])

  const startRound = useCallback((choice: CoinSide) => {
    setState((prev) => {
      if (prev.status !== 'idle') return prev
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

    fetchMockCoinToss(controller.signal)
      .then((res) => {
        setState((prev) => {
          if (prev.status !== 'flipping') return prev
          return { ...prev, apiResult: res.result, isLoading: false }
        })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState((prev) => ({ ...prev, isLoading: false }))
      })
  }, [])

  const onCoinSettled = useCallback((side: CoinSide, roundId: number) => {
    setState((prev) => {
      if (prev.status !== 'flipping') return prev
      if (prev.roundId !== roundId) return prev
      if (!prev.playerChoice) return prev

      const message: GameMessage = prev.playerChoice === side ? 'You Win!' : 'You Lose!'

      return {
        ...prev,
        status: 'message',
        message,
      }
    })

    clearMessageTimer()
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
    }, MESSAGE_MS)
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
