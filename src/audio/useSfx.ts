import { useCallback, useEffect, useRef } from 'react'

let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx

  const Ctx =
    window.AudioContext ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkitAudioContext

  if (!Ctx) return null

  try {
    sharedCtx = new Ctx() as AudioContext
    return sharedCtx
  } catch {
    return null
  }
}

function decodeAudio(ctx: AudioContext, data: ArrayBuffer) {
  return new Promise<AudioBuffer>((resolve, reject) => {
    try {
      // Safari may use the callback form; modern browsers return a Promise.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybePromise = (ctx.decodeAudioData as any)(data, resolve, reject)
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve).catch(reject)
      }
    } catch (e) {
      reject(e)
    }
  })
}

export function useSfx(url: string, options?: { volume?: number }) {
  const volume = options?.volume ?? 1

  const htmlAudioRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)

  useEffect(() => {
    let cancelled = false

    const ctx = getAudioContext()
    ctxRef.current = ctx
    bufferRef.current = null

    // Fallback HTML audio (also used before buffer is ready).
    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.volume = volume
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(audio as any).playsInline = true
    htmlAudioRef.current = audio

    try {
      audio.load()
    } catch {
      // ignore
    }

    ;(async () => {
      if (!ctx) return
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.arrayBuffer()
        const buf = await decodeAudio(ctx, data)
        if (cancelled) return
        bufferRef.current = buf
      } catch {
        // ignore; fallback will still work
      }
    })()

    return () => {
      cancelled = true
      htmlAudioRef.current = null
      bufferRef.current = null
      try {
        audio.pause()
      } catch {
        // ignore
      }
    }
  }, [url, volume])

  const unlock = useCallback(() => {
    const ctx = ctxRef.current
    if (ctx) {
      ctx.resume().catch(() => {})
      try {
        // iOS Safari: a tiny buffer start inside a gesture helps unlock.
        const b = ctx.createBuffer(1, 1, 22050)
        const s = ctx.createBufferSource()
        s.buffer = b
        s.connect(ctx.destination)
        s.start(0)
      } catch {
        // ignore
      }
      return
    }

    const audio = htmlAudioRef.current
    if (!audio) return
    const prevVolume = audio.volume
    audio.volume = 0
    try {
      audio.currentTime = 0
    } catch {
      // ignore
    }
    const p = audio.play()
    if (p && typeof (p as Promise<void>).then === 'function') {
      ;(p as Promise<void>)
        .then(() => {
          try {
            audio.pause()
          } catch {
            // ignore
          }
        })
        .catch(() => {})
        .finally(() => {
          audio.volume = prevVolume
        })
      return
    }
    audio.volume = prevVolume
  }, [])

  const play = useCallback(() => {
    const ctx = ctxRef.current
    const buf = bufferRef.current
    if (ctx && buf) {
      ctx.resume().catch(() => {})
      try {
        const source = ctx.createBufferSource()
        const gain = ctx.createGain()
        gain.gain.value = volume
        source.buffer = buf
        source.connect(gain)
        gain.connect(ctx.destination)
        source.start(0)
        return
      } catch {
        // fall through to HTML audio
      }
    }

    const audio = htmlAudioRef.current
    if (!audio) return

    try {
      audio.currentTime = 0
    } catch {
      // ignore
    }

    const p = audio.play()
    if (p && typeof (p as Promise<void>).catch === 'function') {
      ;(p as Promise<void>).catch(() => {})
    }
  }, [volume])

  return { play, unlock }
}
