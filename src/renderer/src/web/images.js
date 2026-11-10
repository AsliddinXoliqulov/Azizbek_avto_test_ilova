import { useEffect, useState } from 'react'

const IMAGE_CACHE = 'pdd-images-v1'
const pendingImages = new Map()

async function cachedResponse(source) {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(source)
  if (cached) return cached

  let pending = pendingImages.get(source)
  if (!pending) {
    pending = (async () => {
      const response = await fetch(source)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await cache.put(source, response.clone())
      return response
    })().finally(() => pendingImages.delete(source))
    pendingImages.set(source, pending)
  }
  return (await pending).clone()
}

export function useCachedImageUrl(source) {
  const [resolved, setResolved] = useState({ source: null, url: null, error: null })

  useEffect(() => {
    let cancelled = false
    let objectUrl = null

    async function load() {
      if (!source) {
        setResolved({ source, url: null, error: null })
        return
      }

      if (!/^https?:/i.test(source) || !('caches' in window)) {
        setResolved({ source, url: source, error: null })
        return
      }

      try {
        const response = await cachedResponse(source)
        objectUrl = URL.createObjectURL(await response.blob())
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          objectUrl = null
          return
        }
        setResolved({ source, url: objectUrl, error: null })
      } catch (error) {
        if (!cancelled) {
          console.error('[image] Rasmni yuklab yoki keshdan o‘qib bo‘lmadi:', error)
          setResolved({ source, url: null, error })
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [source])

  return resolved.source === source
    ? { url: resolved.url, error: resolved.error }
    : { url: null, error: null }
}
