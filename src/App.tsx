import './App.css'
import { useEffect, useRef } from 'react'
import { ChoiceButton } from './components/ChoiceButton'
import { ResultPopup } from './components/ResultPopup'
import { useCoinTossGame } from './game/useCoinTossGame'
import { CoinStage } from './pixi/CoinStage'
import { useSfx } from './audio/useSfx'

const LANDING_SFX_DELAY_MS = 700

function App() {
  const { state, startRound, onCoinSettled } = useCoinTossGame()
  const tossSfx = useSfx('/coin-drop-sound.mp3', { volume: 0.65 })
  const landSfx = useSfx('/coin-landing-sound.mp3', { volume: 0.75 })

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
    tossSfx.play()
    startRound('heads')
  }

  const startTails = () => {
    tossSfx.play()
    startRound('tails')
  }

  const handleSettled: typeof onCoinSettled = (side, roundId) => {
    onCoinSettled(side, roundId)
  }

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
    <div className="app">
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
              disabled={state.status !== 'idle'}
            />
            <ChoiceButton
              label="Tails"
              onClick={startTails}
              disabled={state.status !== 'idle'}
            />
          </div>
          <div className="hint">
            {state.status === 'idle'
              ? 'Make a choice to start a new round.'
              : 'Wait for the coin to settle…'}
          </div>
        </section>
      </main>

      <ResultPopup message={state.message} visible={state.status === 'message'} />
    </div>
  )
}

export default App
