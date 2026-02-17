import { useTick } from '@pixi/react'
import { useEffect, useMemo, useRef } from 'react'
import type { Container as PixiContainer, Graphics as PixiGraphics } from 'pixi.js'
import type { CoinSide } from '../game/types'
import { useTexture } from './useTexture'

const TWO_PI = Math.PI * 2

function nearestPhase(current: number, base: number) {
  const n = Math.round((current - base) / TWO_PI)
  return base + n * TWO_PI
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Pixi coin animation: spins until API result is known, then settles and emits callbacks.
 */
export function Coin(props: {
  radius: number
  roundId: number
  isFlipping: boolean
  targetSide: CoinSide | null
  onSettled: (side: CoinSide, roundId: number) => void
  onLanding?: (roundId: number) => void
}) {
  const headsTexture = useTexture('/heads.png')
  const tailsTexture = useTexture('/tails.png')

  const coinRef = useRef<PixiContainer | null>(null)
  const headsRef = useRef<PixiContainer | null>(null)
  const tailsRef = useRef<PixiContainer | null>(null)
  const shadowRef = useRef<PixiGraphics | null>(null)

  const phaseRef = useRef(0)
  const velocityRef = useRef(0)
  const elapsedRef = useRef(0)
  const stoppingRef = useRef(false)
  const targetPhaseRef = useRef<number | null>(null)
  const settledRef = useRef(false)
  const landingPlayedRef = useRef(false)
  const lastRoundRef = useRef<number>(props.roundId)

  const scaleRef = useRef(1)
  const shadowScaleRef = useRef(1)
  const shadowAlphaRef = useRef(0)
  const shadowBaseAlpha = 0.55

  const textStyle = useMemo(
    () => ({
      fill: 0x0b1020,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fontSize: Math.max(16, props.radius * 0.38),
      fontWeight: '900' as const,
      align: 'center' as const,
    }),
    [props.radius],
  )

  useEffect(() => {
    if (lastRoundRef.current === props.roundId) return
    lastRoundRef.current = props.roundId

    phaseRef.current = Math.random() * TWO_PI
    velocityRef.current = 18 + Math.random() * 6
    elapsedRef.current = 0
    stoppingRef.current = false
    targetPhaseRef.current = null
    settledRef.current = false
    landingPlayedRef.current = false

    scaleRef.current = 1
    shadowScaleRef.current = 1
    shadowAlphaRef.current = shadowBaseAlpha
  }, [props.roundId])

  useEffect(() => {
    if (!props.isFlipping) return
    if (!props.targetSide) return

    const base = props.targetSide === 'heads' ? 0 : Math.PI
    targetPhaseRef.current = nearestPhase(phaseRef.current, base)
    stoppingRef.current = true
  }, [props.isFlipping, props.targetSide])

  useTick((ticker) => {
    if (!coinRef.current) return

    const dt = ticker.deltaMS / 1000
    elapsedRef.current += dt

    const smooth = 1 - Math.exp(-dt * 14)

    // Scale pulse: noticeably larger during toss, then smoothly back.
    const tossDuration = 1.1
    const tossT = Math.min(1, elapsedRef.current / tossDuration)
    const pulse = props.isFlipping ? Math.sin(Math.PI * tossT) : 0
    const amplitude = 0.38
    const targetScale = props.isFlipping ? 1 + pulse * amplitude : 1
    scaleRef.current += (targetScale - scaleRef.current) * smooth

    // Shadow: anchored to the ground, always present; during toss it becomes larger + lighter.
    const heightT = props.isFlipping ? pulse : 0
    const targetShadowAlpha = lerp(shadowBaseAlpha, 0.25, heightT)
    const targetShadowScale = lerp(0.92, 1.28, heightT)
    shadowAlphaRef.current += (targetShadowAlpha - shadowAlphaRef.current) * smooth
    shadowScaleRef.current += (targetShadowScale - shadowScaleRef.current) * smooth

    const floatY = Math.sin(elapsedRef.current * 1.6) * (props.radius * 0.03)
    const liftY = props.isFlipping ? -pulse * (props.radius * 0.55) : 0

    if (!props.isFlipping) {
      const cos = Math.cos(phaseRef.current)
      const sx = Math.max(0.08, Math.abs(cos))
      coinRef.current.scale.set(sx * scaleRef.current, 1 * scaleRef.current)
      coinRef.current.position.y = floatY
      if (headsRef.current) headsRef.current.visible = cos >= 0
      if (tailsRef.current) tailsRef.current.visible = cos < 0

      if (shadowRef.current) {
        shadowRef.current.alpha = shadowAlphaRef.current
        shadowRef.current.scale.set(shadowScaleRef.current, shadowScaleRef.current)
      }
      return
    }

    const minSpinSeconds = 0.9

    if (!stoppingRef.current) {
      // Free spin while waiting for API.
      phaseRef.current += velocityRef.current * dt
      velocityRef.current *= Math.pow(0.985, ticker.deltaTime)
    } else if (elapsedRef.current < minSpinSeconds || targetPhaseRef.current === null) {
      phaseRef.current += velocityRef.current * dt
    } else {
      // Spring settle to target.
      const target = targetPhaseRef.current
      const diff = target - phaseRef.current

      if (!landingPlayedRef.current) {
        landingPlayedRef.current = true
        props.onLanding?.(props.roundId)
      }

      velocityRef.current += diff * 42 * dt
      velocityRef.current *= Math.pow(0.08, dt)
      phaseRef.current += velocityRef.current * dt

      if (Math.abs(diff) < 0.02 && Math.abs(velocityRef.current) < 0.25) {
        phaseRef.current = target
        velocityRef.current = 0

        const cosNow = Math.cos(phaseRef.current)
        const side: CoinSide = cosNow >= 0 ? 'heads' : 'tails'
        if (!settledRef.current) {
          if (!landingPlayedRef.current) {
            landingPlayedRef.current = true
            props.onLanding?.(props.roundId)
          }
          settledRef.current = true
          props.onSettled(side, props.roundId)
        }
      }
    }

    const cos = Math.cos(phaseRef.current)
    const sx = Math.max(0.06, Math.abs(cos))
    coinRef.current.scale.set(sx * scaleRef.current, 1 * scaleRef.current)
    coinRef.current.position.y = floatY + liftY

    if (headsRef.current) headsRef.current.visible = cos >= 0
    if (tailsRef.current) tailsRef.current.visible = cos < 0

    if (shadowRef.current) {
      shadowRef.current.alpha = shadowAlphaRef.current
      shadowRef.current.scale.set(shadowScaleRef.current, shadowScaleRef.current)
    }
  })

  return (
    <pixiContainer>
      <pixiGraphics
        ref={shadowRef}
        y={props.radius * 0.18}
        alpha={shadowBaseAlpha}
        draw={(g: PixiGraphics) => {
          const r = props.radius
          g.clear()

          g.circle(0, 0, r)
          g.fill({ color: 0x000000, alpha: 0.06 })

          g.circle(0, 0, r * 0.72)
          g.fill({ color: 0x000000, alpha: 0.08 })

          g.circle(0, 0, r * 0.5)
          g.fill({ color: 0x000000, alpha: 0.1 })
        }}
      />

      <pixiContainer ref={coinRef}>
        <pixiContainer ref={headsRef}>
          {headsTexture ? (
            <pixiSprite
              texture={headsTexture}
              anchor={0.5}
              x={0}
              y={0}
              width={props.radius * 2}
              height={props.radius * 2}
              alpha={0.98}
            />
          ) : (
            <pixiText text="H" anchor={0.5} x={0} y={0} style={textStyle} />
          )}
        </pixiContainer>

        <pixiContainer ref={tailsRef}>
          {tailsTexture ? (
            <pixiSprite
              texture={tailsTexture}
              anchor={0.5}
              x={0}
              y={0}
              width={props.radius * 2}
              height={props.radius * 2}
              alpha={0.98}
            />
          ) : (
            <pixiText text="T" anchor={0.5} x={0} y={0} style={textStyle} />
          )}
        </pixiContainer>
      </pixiContainer>
    </pixiContainer>
  )
}
