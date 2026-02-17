import { useMemo } from 'react'
import { Application } from '@pixi/react'
import type { CoinSide } from '../game/types'
import { useElementSize } from '../hooks/useElementSize'
import { Coin } from './Coin'

/**
 * Pixi stage wrapper: owns the <Application/> and keeps it sized to its container.
 */
export function CoinStage(props: {
  roundId: number
  isFlipping: boolean
  targetSide: CoinSide | null
  onSettled: (side: CoinSide, roundId: number) => void
  onLanding?: (roundId: number) => void
}) {
  const { ref, size } = useElementSize<HTMLDivElement>()

  const w = Math.floor(size.width)
  const h = Math.floor(size.height)
  const hasSize = w > 0 && h > 0
  const radius = Math.max(42, Math.min(w, h) * 0.22)

  const labelStyle = useMemo(
    () => ({
      fill: 0xffffff,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fontSize: Math.max(12, Math.min(18, Math.min(w, h) * 0.04)),
      fontWeight: '700' as const,
      align: 'center' as const,
    }),
    [w, h],
  )

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {hasSize ? (
        <Application
          // Mount after size is known; avoid remount flicker on layout changes.
          width={w}
          height={h}
          resizeTo={ref}
          antialias
          autoDensity
          backgroundAlpha={0}
        >
          <pixiContainer x={w / 2} y={h / 2}>
            <Coin
              radius={radius}
              roundId={props.roundId}
              isFlipping={props.isFlipping}
              targetSide={props.targetSide}
              onSettled={props.onSettled}
              onLanding={props.onLanding}
            />
          </pixiContainer>

          <pixiText
            text={props.isFlipping ? 'Flipping…' : 'Ready'}
            x={14}
            y={12}
            style={labelStyle}
            alpha={0.65}
          />
        </Application>
      ) : null}
    </div>
  )
}
