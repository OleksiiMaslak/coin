import { Assets, Texture } from 'pixi.js'
import { useEffect, useState } from 'react'

export function useTexture(url: string) {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    let cancelled = false

    Assets.load(url)
      .then((asset) => {
        if (cancelled) return
        if (asset instanceof Texture) {
          setTexture(asset)
        } else {
          // Fallback: try to create a texture from URL.
          setTexture(Texture.from(url))
        }
      })
      .catch(() => {
        if (cancelled) return
        setTexture(null)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return texture
}
