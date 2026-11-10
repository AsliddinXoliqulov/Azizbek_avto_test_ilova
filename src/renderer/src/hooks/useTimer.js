import { useEffect, useRef, useState } from 'react'

// totalSeconds = null bo'lsa taymer ishlamaydi (untimed amaliy mashq rejimi).
export default function useTimer(totalSeconds, onExpire, enabled = true) {
  const [remaining, setRemaining] = useState(totalSeconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    setRemaining(totalSeconds)
  }, [totalSeconds])

  useEffect(() => {
    if (totalSeconds == null || !enabled) return
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const left = Math.max(0, totalSeconds - elapsed)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(id)
        onExpireRef.current?.()
      }
    }, 250)
    return () => clearInterval(id)
  }, [totalSeconds, enabled])

  const format = (secs) => {
    if (secs == null) return null
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0')
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, '0')
    return `${m}:${s}`
  }

  return { remaining, formatted: format(remaining), isDanger: totalSeconds != null && remaining <= 30 }
}
