import { useCallback, useEffect, useRef } from 'react'

export function useSfx(url: string, options?: { volume?: number }) {
  const poolRef = useRef<HTMLAudioElement[]>([])
  const poolIndexRef = useRef(0)
  const unlockedRef = useRef(false)
  const volume = options?.volume ?? 1
  const poolSize = 4

  useEffect(() => {
    const pool: HTMLAudioElement[] = []

    for (let i = 0; i < poolSize; i += 1) {
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = volume
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(audio as any).playsInline = true
      pool.push(audio)

      // Helps on some browsers: try to warm up decoding.
      try {
        audio.load()
      } catch {
        // ignore
      }
    }

    poolRef.current = pool
    poolIndexRef.current = 0
    unlockedRef.current = false

    return () => {
      poolRef.current = []
      poolIndexRef.current = 0
      unlockedRef.current = false
      for (const a of pool) {
        try {
          a.pause()
        } catch {
          // ignore
        }
      }
    }
  }, [url, volume])

  const unlock = useCallback(() => {
    if (unlockedRef.current) return
    const pool = poolRef.current
    if (!pool.length) return

    const audio = pool[0]
    const prevMuted = audio.muted
    const prevVolume = audio.volume

    audio.muted = true
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
          unlockedRef.current = true
          try {
            audio.pause()
          } catch {
            // ignore
          }
        })
        .catch(() => {})
        .finally(() => {
          audio.muted = prevMuted
          audio.volume = prevVolume
        })
      return
    }

    // Non-promise browsers: best effort.
    unlockedRef.current = true
    try {
      audio.pause()
    } catch {
      // ignore
    }
    audio.muted = prevMuted
    audio.volume = prevVolume
  }, [])

  const play = useCallback(() => {
    const pool = poolRef.current
    if (!pool.length) return

    const idx = poolIndexRef.current % pool.length
    poolIndexRef.current = (poolIndexRef.current + 1) % pool.length
    const audio = pool[idx]

    audio.muted = false
    audio.volume = volume

    try {
      // Restart the sound for rapid clicks.
      audio.currentTime = 0
    } catch {
      // ignore
    }

    const p = audio.play()
    // Autoplay policies can reject; ignore silently.
    if (p && typeof (p as Promise<void>).catch === 'function') {
      ;(p as Promise<void>).catch(() => {})
    }
  }, [volume])

  return { play, unlock }
}
