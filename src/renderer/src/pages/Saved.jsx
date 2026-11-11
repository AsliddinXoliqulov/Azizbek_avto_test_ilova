import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Saved() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/run', { replace: true, state: { mode: 'saved' } })
  }, [navigate])

  return null
}
