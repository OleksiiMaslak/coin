import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChoiceButton } from './components/ChoiceButton'
import { ResultPopup } from './components/ResultPopup'
import { useCoinTossGame } from './game/useCoinTossGame'
import { CoinStage } from './pixi/CoinStage'
import { useSfx } from './audio/useSfx'
import { addEntry, MAX_ENTRIES } from './store/historySlice'
import { useAppDispatch, useAppSelector } from './store/hooks'

const LANDING_SFX_DELAY_MS = 700
const HISTORY_PREVIEW_COUNT = 5
const HISTORY_PAGE_SIZE = 10
const BATCH_MAX_TOSSES = 50

function App() {
  const { state, startRound, onCoinSettled } = useCoinTossGame()
  const dispatch = useAppDispatch()
  const history = useAppSelector((s) => s.history.entries)

  const [batchRunning, setBatchRunning] = useState(false)
  const [batchChoice, setBatchChoice] = useState<'heads' | 'tails'>('heads')
  const [batchRemaining, setBatchRemaining] = useState(0)
  const [customBatchCount, setCustomBatchCount] = useState('')

  const batchRef = useRef<{ running: boolean; choice: 'heads' | 'tails'; remaining: number }>({
    running: false,
    choice: 'heads',
    remaining: 0,
  })

  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)

  const historyPageCount = useMemo(() => {
    if (!historyExpanded) return 1
    return Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  }, [history.length, historyExpanded])

  const maxHistoryPage = Math.max(0, historyPageCount - 1)
  const effectiveHistoryPage = historyExpanded
    ? Math.min(historyPage, maxHistoryPage)
    : 0

  const tossSfx = useSfx('/coin-drop-sound.mp3', { volume: 0.65 })
  const landSfx = useSfx('/coin-landing-sound.mp3', { volume: 0.75 })

  const audioUnlockedRef = useRef(false)
  const unlockAudio = () => {
    if (audioUnlockedRef.current) return
    audioUnlockedRef.current = true
    tossSfx.unlock()
    landSfx.unlock()
  }

  const latestRoundIdRef = useRef(state.roundId)
  const landingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    latestRoundIdRef.current = state.roundId
  }, [state.roundId])

  useEffect(() => {
    return () => {
      if (landingTimerRef.current !== null) {
        window.clearTimeout(landingTimerRef.current)
        landingTimerRef.current = null
      }
    }
  }, [])

  const startHeads = () => {
    unlockAudio()
    tossSfx.play()
    startRound('heads')
  }

  const startTails = () => {
    unlockAudio()
    tossSfx.play()
    startRound('tails')
  }

  const stopBatch = () => {
    batchRef.current = { ...batchRef.current, running: false, remaining: 0 }
    setBatchRunning(false)
    setBatchRemaining(0)
  }

  const startBatch = (choice: 'heads' | 'tails', count: number) => {
    const safeCount = Math.max(1, Math.min(BATCH_MAX_TOSSES, Math.floor(count)))
    if (state.status === 'flipping') return

    unlockAudio()

    batchRef.current = { running: true, choice, remaining: safeCount }
    setBatchChoice(choice)
    setBatchRunning(true)
    setBatchRemaining(safeCount)

    tossSfx.play()
    startRound(choice)
    batchRef.current = { ...batchRef.current, remaining: safeCount - 1 }
    setBatchRemaining(safeCount - 1)
  }

  const parseCustomCount = () => {
    if (!customBatchCount) return null
    const n = Number.parseInt(customBatchCount, 10)
    if (!Number.isFinite(n)) return null
    if (n < 1 || n > BATCH_MAX_TOSSES) return null
    return n
  }

  const handleSettled = (side: 'heads' | 'tails', roundId: number) => {
    if (roundId === state.roundId && state.playerChoice) {
      dispatch(
        addEntry({
          id: `${roundId}-${Date.now()}`,
          ts: Date.now(),
          roundId,
          choice: state.playerChoice,
          result: side,
          outcome: state.playerChoice === side ? 'win' : 'lose',
        }),
      )
    }

    const isBatch = batchRef.current.running
    onCoinSettled(side, roundId, { showMessage: !isBatch })

    if (!isBatch) return
    if (!batchRef.current.running) return
    if (batchRef.current.remaining <= 0) {
      stopBatch()
      return
    }

    const nextChoice = batchRef.current.choice
    tossSfx.play()
    startRound(nextChoice)
    batchRef.current = {
      ...batchRef.current,
      remaining: batchRef.current.remaining - 1,
    }
    setBatchRemaining(batchRef.current.remaining)
  }

  const canExpandHistory = history.length > HISTORY_PREVIEW_COUNT
  const visibleHistory = useMemo(() => {
    if (!historyExpanded) return history.slice(0, HISTORY_PREVIEW_COUNT)
    const start = effectiveHistoryPage * HISTORY_PAGE_SIZE
    return history.slice(start, start + HISTORY_PAGE_SIZE)
  }, [history, historyExpanded, effectiveHistoryPage])

  const handleLanding = (roundId: number) => {
    if (landingTimerRef.current !== null) {
      window.clearTimeout(landingTimerRef.current)
      landingTimerRef.current = null
    }

    landingTimerRef.current = window.setTimeout(() => {
      landingTimerRef.current = null
      if (latestRoundIdRef.current !== roundId) return
      landSfx.play()
    }, LANDING_SFX_DELAY_MS)
  }

  return (
    <div className="app" onPointerDown={unlockAudio}>
      <header className="header">
        <div className="title">Coin Toss</div>
        <div className="subtitle">Pick Heads or Tails, then watch the flip.</div>
      </header>

      <main className="layout">
        <section className="stageCard" aria-label="Coin stage">
          <CoinStage
            roundId={state.roundId}
            isFlipping={state.status === 'flipping'}
            targetSide={state.apiResult}
            onSettled={handleSettled}
            onLanding={handleLanding}
          />
          {state.isLoading ? <div className="loading">Loading result…</div> : null}
        </section>

        <section className="controlsCard" aria-label="Controls">
          <div className="controlsHeader">Your guess</div>
          <div className="buttons">
            <ChoiceButton
              label="Heads"
              onClick={startHeads}
              disabled={state.status === 'flipping' || batchRunning}
            />
            <ChoiceButton
              label="Tails"
              onClick={startTails}
              disabled={state.status === 'flipping' || batchRunning}
            />
          </div>
          <div className="hint">
            {state.status === 'idle'
              ? 'Make a choice to start a new round.'
              : 'Wait for the coin to settle…'}
          </div>

          <div className="history" aria-label="Batch tosses">
            <div className="historyHeaderRow">
              <div className="historyHeader">Batch tosses</div>
              <div className="batchToggle" role="group" aria-label="Batch side">
                <button
                  className={`historyButton batchToggleBtn ${batchChoice === 'heads' ? 'batchToggleActive' : ''}`}
                  type="button"
                  disabled={batchRunning}
                  onClick={() => {
                    batchRef.current = { ...batchRef.current, choice: 'heads' }
                    setBatchChoice('heads')
                  }}
                >
                  Heads
                </button>
                <button
                  className={`historyButton batchToggleBtn ${batchChoice === 'tails' ? 'batchToggleActive' : ''}`}
                  type="button"
                  disabled={batchRunning}
                  onClick={() => {
                    batchRef.current = { ...batchRef.current, choice: 'tails' }
                    setBatchChoice('tails')
                  }}
                >
                  Tails
                </button>
              </div>
            </div>

            {!batchRunning ? (
              <div className="historyEmpty">Up to {BATCH_MAX_TOSSES} tosses</div>
            ) : null}

            <div className="buttons">
              <ChoiceButton
                label="Heads ×5"
                onClick={() => startBatch('heads', 5)}
                disabled={state.status === 'flipping' || batchRunning}
              />
              <ChoiceButton
                label="Tails ×5"
                onClick={() => startBatch('tails', 5)}
                disabled={state.status === 'flipping' || batchRunning}
              />
              <ChoiceButton
                label="Heads ×10"
                onClick={() => startBatch('heads', 10)}
                disabled={state.status === 'flipping' || batchRunning}
              />
              <ChoiceButton
                label="Tails ×10"
                onClick={() => startBatch('tails', 10)}
                disabled={state.status === 'flipping' || batchRunning}
              />
            </div>

            <div className="historyPagination" aria-label="Custom batch">
              <input
                value={customBatchCount}
                type="number"
                min={1}
                max={BATCH_MAX_TOSSES}
                step={1}
                onChange={(e) => {
                  const raw = e.target.value
                  if (!raw) {
                    setCustomBatchCount('')
                    return
                  }

                  const digitsOnly = raw.replace(/\D/g, '')
                  if (!digitsOnly) {
                    setCustomBatchCount('')
                    return
                  }

                  const n = Number.parseInt(digitsOnly, 10)
                  if (!Number.isFinite(n)) {
                    setCustomBatchCount('')
                    return
                  }

                  setCustomBatchCount(String(Math.min(BATCH_MAX_TOSSES, Math.max(1, n))))
                }}
                placeholder={`1–${BATCH_MAX_TOSSES}`}
                aria-label="Custom toss count"
                className="historyButton batchInput"
                disabled={batchRunning}
              />
              <button
                className="historyButton"
                type="button"
                disabled={batchRunning || state.status === 'flipping' || !parseCustomCount()}
                onClick={() => {
                  const n = parseCustomCount()
                  if (!n) return
                  startBatch(batchChoice, n)
                }}
              >
                Run
              </button>
              <button
                className="historyButton"
                type="button"
                disabled={!batchRunning}
                onClick={stopBatch}
              >
                Stop
              </button>
            </div>

            {batchRunning ? (
              <div className="historyEmpty">
                Running: {batchChoice} • Remaining: {batchRemaining}
              </div>
            ) : null}
          </div>

          <div className="history" aria-label="Toss history">
            <div className="historyHeaderRow">
              <div className="historyHeader">History</div>
              {canExpandHistory ? (
                <button
                  className="historyButton"
                  type="button"
                  onClick={() => {
                    if (historyExpanded) {
                      setHistoryExpanded(false)
                      setHistoryPage(0)
                    } else {
                      setHistoryExpanded(true)
                      setHistoryPage(0)
                    }
                  }}
                >
                  {historyExpanded ? 'Hide full toss history' : 'Show full toss history'}
                </button>
              ) : null}
            </div>

            {visibleHistory.length ? (
              <div className="historyList">
                {visibleHistory.map((e) => (
                  <div className="historyRow" key={e.id}>
                    <div className="historyMeta">
                      {new Date(e.ts).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                    <div className="historyMain">
                      {e.choice} → {e.result}
                    </div>
                    <div className={`historyOutcome ${e.outcome}`}>{e.outcome}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="historyEmpty">No tosses yet.</div>
            )}

            {historyExpanded && history.length > HISTORY_PAGE_SIZE ? (
              <div className="historyPagination" aria-label="History pagination">
                <button
                  className="historyButton"
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                  disabled={effectiveHistoryPage <= 0}
                >
                  Back
                </button>
                <div className="historyPageInfo">
                  Page {effectiveHistoryPage + 1} / {historyPageCount} (up to {MAX_ENTRIES})
                </div>
                <button
                  className="historyButton"
                  type="button"
                  onClick={() =>
                    setHistoryPage((p) => Math.min(maxHistoryPage, p + 1))
                  }
                  disabled={effectiveHistoryPage >= historyPageCount - 1}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <ResultPopup message={state.message} visible={state.status === 'message'} />
    </div>
  )
}

export default App
