import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import BottomNav from './components/BottomNav'
import Activation from './pages/Activation'
import Home from './pages/Home'
import Topics from './pages/Topics'
import Lessons from './pages/Lessons'
import CustomCount from './pages/CustomCount'
import Exam from './pages/Exam'
import DirectStart from './pages/DirectStart'
import NewQuestions from './pages/NewQuestions'
import TestRunner from './pages/TestRunner'
import Variants from './pages/Variants'
import PracticeOptions from './pages/PracticeOptions'
import Saved from './pages/Saved'
import { LanguageContext } from './i18n'

export default function App() {
  const isWebApp = document.documentElement.classList.contains('web-app')
  const [activated, setActivated] = useState(null) // null = yuklanmoqda
  const [activationNotice, setActivationNotice] = useState('')
  const [syncError, setSyncError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [language, setLanguage] = useState('uz-Latn')
  const location = useLocation()
  const navigate = useNavigate()
  const contentRef = useRef(null)

  const refreshBase = useCallback(async () => {
    setSyncError('')
    setSyncing(true)
    try {
      const result = await window.api.sync.refreshBase()
      if (result.ok && !result.skipped) {
        window.dispatchEvent(new Event('pdd:database-updated'))
      } else if (!result.ok && !result.cancelled && !result.skipped) {
        console.error('[sync] Savollar bazasini yangilab bo‘lmadi:', result.message)
        if (
          isWebApp &&
          String(result.message || '').includes('DEVICE_NOT_ACTIVATED')
        ) {
          await window.api.activation.requireReactivation()
          setActivationNotice('syncActivationRequired')
          setActivated(false)
          return
        }
        setSyncError(result.message || 'Noma’lum sinxronlash xatosi.')
      }
    } catch (error) {
      console.error('[sync] Savollar bazasini yangilab bo‘lmadi:', error)
      if (
        isWebApp &&
        String(error?.message || '').includes('DEVICE_NOT_ACTIVATED')
      ) {
        await window.api.activation.requireReactivation()
        setActivationNotice('syncActivationRequired')
        setActivated(false)
        return
      }
      setSyncError(error?.message || 'Noma’lum sinxronlash xatosi.')
    } finally {
      setSyncing(false)
    }
  }, [])

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [activated, location.pathname])

  useEffect(() => {
    const applyStatus = (status) => {
      setActivated(status.activated)
      if (isWebApp && !status.activated && status.reactivationPending) {
        setActivationNotice('syncActivationRequired')
      }
    }
    window.api.activation.status().then(applyStatus)
    const off = window.api.activation.onChanged(applyStatus)
    const offRequired = window.api.activation.onRequired(() =>
      setActivated(false)
    )
    window.api.settings.get().then((settings) => setLanguage(settings.language))

    let checking = false
    const revalidate = async () => {
      if (checking) return
      checking = true
      try {
        const status = await window.api.activation.status()
        if (status.reactivationPending) return
        applyStatus(await window.api.activation.revalidate())
      } catch (error) {
        console.error('[activation] Online tekshiruvi bajarilmadi:', error)
        applyStatus(await window.api.activation.status())
      } finally {
        checking = false
      }
    }
    const initializeActivation = async () => {
      try {
        const status = await window.api.activation.status()
        if (
          navigator.onLine &&
          (status.activated || status.leaseExpired)
        ) {
          await revalidate()
        } else {
          applyStatus(status)
        }
      } catch (error) {
        console.error('[activation] Mahalliy aktivatsiya holati tekshirilmadi:', error)
      }
    }
    const onOnline = () => {
      void revalidate()
    }
    const dailyCheck = window.setInterval(async () => {
      try {
        const status = await window.api.activation.status()
        if (
          navigator.onLine &&
          (status.activated || status.leaseExpired)
        ) {
          await revalidate()
        } else {
          applyStatus(status)
        }
      } catch (error) {
        console.error(
          '[activation] Mahalliy aktivatsiya holati tekshirilmadi:',
          error
        )
      }
    }, 60_000)
    void initializeActivation()
    window.addEventListener('online', onOnline)
    return () => {
      off()
      offRequired()
      window.removeEventListener('online', onOnline)
      window.clearInterval(dailyCheck)
    }
  }, [])

  useEffect(() => {
    if (!activated) return undefined

    void refreshBase()
    window.addEventListener('online', refreshBase)
    return () => window.removeEventListener('online', refreshBase)
  }, [activated, refreshBase])

  useEffect(() => {
    if (!activated) return undefined

    function handleKeyDown(event) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return

      if (event.ctrlKey && !event.altKey && !event.metaKey && !event.repeat) {
        const key = event.key.toLowerCase()
        if (key === 'n') {
          event.preventDefault()
          navigate('/exam-results')
          return
        }
      }

      if (event.code === 'Space') {
        event.preventDefault()
        navigate('/')
      } else if (
        event.key === 'Escape' &&
        location.pathname !== '/' &&
        location.pathname !== '/run'
      ) {
        event.preventDefault()
        const historyIndex = window.history.state?.idx
        if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1)
        else navigate('/topics', { replace: true })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activated, location.pathname, navigate])

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <div className="app-shell">
        <TitleBar />
        {activated === null ? null : !activated ? (
          <Activation
            notice={activationNotice}
            onActivated={() => {
              setActivationNotice('')
              setActivated(true)
            }}
          />
        ) : (
          <div className="app-body">
            <main className="content" ref={contentRef}>
              {isWebApp && syncError && (
                <div className="sync-error-banner" role="alert">
                  <span>Savollar bazasi yuklanmadi: {syncError}</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void refreshBase()}
                    disabled={syncing}
                  >
                    {syncing ? 'Yuklanmoqda…' : 'Qayta urinish'}
                  </button>
                </div>
              )}
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/question-practice"
                  element={<PracticeOptions unified />}
                />
                <Route path="/topics" element={<Topics />} />
                <Route path="/lessons/:sectionId" element={<Lessons />} />
                <Route path="/custom" element={<CustomCount />} />
                <Route path="/exam" element={<Exam />} />
                <Route path="/new-questions" element={<NewQuestions />} />
                <Route path="/errors" element={<DirectStart mode="errors" />} />
                {isWebApp && <Route path="/saved" element={<Saved />} />}
                <Route
                  path="/exam-results"
                  element={<DirectStart mode="exam-results" />}
                />
                <Route path="/variants" element={<Variants />} />
                <Route path="/run" element={<TestRunner />} />
                <Route path="/practice/:mode" element={<PracticeOptions />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </main>
          </div>
        )}
        {activated && location.pathname !== '/run' && <BottomNav />}
      </div>
    </LanguageContext.Provider>
  )
}
