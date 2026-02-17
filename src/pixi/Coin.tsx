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

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t))
}

function easeOutCubic(t: number) {
  const u = 1 - clamp01(t)
  return 1 - u * u * u
}

function easeInCubic(t: number) {
  const u = clamp01(t)
  return u * u * u
}

/**
 * Pixi coin animation with three explicit stages: toss up → in-air spin → landing + settle.
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
  const desiredSideRef = useRef<CoinSide | null>(null)
  const settledRef = useRef(false)
  const landingPlayedRef = useRef(false)
  const lastRoundRef = useRef<number>(props.roundId)

  const stageRef = useRef<'toss' | 'air' | 'land'>('toss')
  const stageElapsedRef = useRef(0)
  const airLiftRef = useRef(0)
  const landStartLiftRef = useRef(0)

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
    desiredSideRef.current = null
    settledRef.current = false
    landingPlayedRef.current = false

    stageRef.current = 'toss'
    stageElapsedRef.current = 0
    airLiftRef.current = 0
    landStartLiftRef.current = 0

    scaleRef.current = 1
    shadowScaleRef.current = 1
    shadowAlphaRef.current = shadowBaseAlpha
  }, [props.roundId])

  useEffect(() => {
    if (!props.isFlipping) return
    if (!props.targetSide) return

    // API result arrived: start preparing to settle.
    // NOTE: we *don't* lock a single target phase yet, because the coin may keep spinning
    // until the landing stage begins. We keep snapping to the nearest equivalent phase
    // to avoid accumulating extra full turns after the response.
    desiredSideRef.current = props.targetSide
    stoppingRef.current = true
  }, [props.isFlipping, props.targetSide])

  useTick((ticker) => {
    if (!coinRef.current) return

    const dt = ticker.deltaMS / 1000
    elapsedRef.current += dt

    const TOSS_UP_SECONDS = 0.35
    const LAND_SECONDS = 0.28
    const AIR_LIFT = props.radius * 0.55
    const AIR_BOB = props.radius * 0.05

    const smooth = 1 - Math.exp(-dt * 14)

    const floatY = Math.sin(elapsedRef.current * 1.6) * (props.radius * 0.03)

    if (!props.isFlipping) {
      stageRef.current = 'toss'
      stageElapsedRef.current = 0
      airLiftRef.current = 0

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

    // --- Stage handling ---
    stageElapsedRef.current += dt

    if (stoppingRef.current && desiredSideRef.current && stageRef.current !== 'land') {
      const base = desiredSideRef.current === 'heads' ? 0 : Math.PI
      targetPhaseRef.current = nearestPhase(phaseRef.current, base)
    }

    // Enter landing stage when we are allowed to settle.
    const canStartLanding =
      stoppingRef.current && elapsedRef.current >= minSpinSeconds && desiredSideRef.current !== null

    if (canStartLanding && stageRef.current !== 'land') {
      stageRef.current = 'land'
      stageElapsedRef.current = 0
      landStartLiftRef.current = airLiftRef.current

      const base = desiredSideRef.current === 'heads' ? 0 : Math.PI
      targetPhaseRef.current = nearestPhase(phaseRef.current, base)
    }

    let targetLift = 0
    let targetScale = 1

    if (stageRef.current === 'toss') {
      const t = stageElapsedRef.current / TOSS_UP_SECONDS
      const up = easeOutCubic(t)
      targetLift = AIR_LIFT * up
      targetScale = 1 + Math.sin(Math.PI * clamp01(t)) * 0.38

      if (t >= 1) {
        stageRef.current = 'air'
        stageElapsedRef.current = 0
      }
    } else if (stageRef.current === 'air') {
      targetLift = AIR_LIFT + Math.sin(elapsedRef.current * 2.3) * AIR_BOB
      targetScale = 1.08
    } else {
      const t = stageElapsedRef.current / LAND_SECONDS
      const down = easeInCubic(t)
      targetLift = lerp(landStartLiftRef.current, 0, down)
      targetScale = lerp(1.06, 1, down)
    }

    airLiftRef.current += (targetLift - airLiftRef.current) * smooth
    scaleRef.current += (targetScale - scaleRef.current) * smooth

    const height01 = AIR_LIFT > 0 ? clamp01(airLiftRef.current / AIR_LIFT) : 0
    const targetShadowAlpha = lerp(shadowBaseAlpha, 0.25, height01)
    const targetShadowScale = lerp(0.92, 1.28, height01)
    shadowAlphaRef.current += (targetShadowAlpha - shadowAlphaRef.current) * smooth
    shadowScaleRef.current += (targetShadowScale - shadowScaleRef.current) * smooth

    if (!stoppingRef.current) {
      // Free spin while waiting for API.
      phaseRef.current += velocityRef.current * dt
      velocityRef.current *= Math.pow(0.995, ticker.deltaTime)
      velocityRef.current = Math.max(14, velocityRef.current)
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
    coinRef.current.position.y = floatY - airLiftRef.current

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
