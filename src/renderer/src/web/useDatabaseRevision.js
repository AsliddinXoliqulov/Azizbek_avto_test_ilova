import { useEffect, useState } from 'react'

export function useDatabaseRevision() {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener('pdd:database-updated', refresh)
    return () => window.removeEventListener('pdd:database-updated', refresh)
  }, [])

  return revision
}
