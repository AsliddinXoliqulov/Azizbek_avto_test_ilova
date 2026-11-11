import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useConfirm } from '../components/ConfirmProvider'
import useTimer from '../hooks/useTimer'
import HelpDrawer, { toFileUrl } from '../components/HelpDrawer'
import EmptyState from '../components/EmptyState'
import { IconBookmark } from '../components/Icons'
import { useUi } from '../i18n'
import noQuestionImage from '../../../namuna.webp'
import { useCachedImageUrl } from '../web/images'

export default function TestRunner() {
  const confirm = useConfirm()

  const location = useLocation()
  const navigate = useNavigate()
  const params = location.state
  const t = useUi()

  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState(null)
  const [seconds, setSeconds] = useState(null)
  const [attemptId, setAttemptId] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [savedQuestionState, setSavedQuestionState] = useState({ id: null, saved: false })
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [pendingIndex, setPendingIndex] = useState(null)
  const [studyTestStarted, setStudyTestStarted] = useState(false)
  const [earlyExamFailure, setEarlyExamFailure] = useState(false)
  const [showExamResultNotice, setShowExamResultNotice] = useState(false)
  const [questionGridOpen, setQuestionGridOpen] = useState(false)
  const [headerTitleOpen, setHeaderTitleOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [answering, setAnswering] = useState(false)
  const [error, setError] = useState('')
  const [failedImageId, setFailedImageId] = useState(null)
  const [storageImageId, setStorageImageId] = useState(null)
  const [fallbackImageUrl, setFallbackImageUrl] = useState('')
  const [viewerImage, setViewerImage] = useState(null)
  const [imageZoom, setImageZoom] = useState(1)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const finishedRef = useRef(false)
  const advanceTimerRef = useRef(null)
  const loadTokenRef = useRef(0)
  const imageDragRef = useRef(null)
  const imagePointersRef = useRef(new Map())
  const imagePinchRef = useRef(null)
  const imageViewportRef = useRef(null)
  const questionGridRef = useRef(null)
  const questionGridTouchRef = useRef(null)
  const questionSwipeTouchRef = useRef(null)
  const ignoreQuestionGridClickUntilRef = useRef(0)

  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])
  useEffect(() => {
    let active = true
    const loadSettings = () => {
      window.api.settings.get()
        .then((settings) => {
          if (active) {
            setFallbackImageUrl(
              typeof settings.no_question_image_url === 'string'
                ? settings.no_question_image_url
                : ''
            )
          }
        })
        .catch((reason) => {
          if (active) setError(reason.message || String(reason))
        })
    }
    loadSettings()
    window.addEventListener('pdd:database-updated', loadSettings)
    return () => {
      active = false
      window.removeEventListener('pdd:database-updated', loadSettings)
    }
  }, [])
  useEffect(() => {
    setPendingIndex(null)
    setFailedImageId(null)
    setStorageImageId(null)
    setViewerImage(null)
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
  }, [index])
  useEffect(() => {
    questionGridRef.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      })
  }, [index, questions, questionGridOpen])
  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return

      if (event.key === 'Escape') {
        if (viewerImage) {
          event.preventDefault()
          setViewerImage(null)
        } else if (helpOpen) {
          event.preventDefault()
          setHelpOpen(false)
        } else if (showExamResultNotice) {
          event.preventDefault()
          setShowExamResultNotice(false)
        } else {
          event.preventDefault()
          const historyIndex = window.history.state?.idx
          if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1)
          else navigate('/topics', { replace: true })
        }
        return
      }

      if (viewerImage || helpOpen || showExamResultNotice || !questions)
        return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goTo(index + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goTo(index - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    viewerImage,
    helpOpen,
    showExamResultNotice,
    questions,
    index,
    navigate,
  ])

  function zoomImage(factor) {
    const next = imageZoom * factor
    const zoom = Number.isFinite(next) ? Math.min(5, Math.max(1, next)) : imageZoom
    setImageZoom(zoom)
    if (zoom === 1) setImageOffset({ x: 0, y: 0 })
  }

  function constrainImageOffset(x, y, zoom = imageZoom) {
    const viewport = imageViewportRef.current
    const image = viewport?.querySelector('.image-viewer-image')
    if (!viewport || !image || zoom <= 1) return { x: 0, y: 0 }

    const maxX = Math.max(0, (image.offsetWidth * zoom - viewport.clientWidth) / 2)
    const maxY = Math.max(0, (image.offsetHeight * zoom - viewport.clientHeight) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }

  function resetImageZoom() {
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
  }

  function openImageViewer(imageUrl) {
    setViewerImage(imageUrl)
    resetImageZoom()
  }

  function handleImageWheel(event) {
    event.preventDefault()
    zoomImage(Math.exp(-event.deltaY * 0.001))
  }

  function startImagePointer(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const pointers = imagePointersRef.current
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size >= 2) {
      const [first, second] = [...pointers.values()]
      imageDragRef.current = null
      imagePinchRef.current = {
        startDistance: Math.hypot(first.x - second.x, first.y - second.y),
        startZoom: imageZoom,
      }
      return
    }

    if (
      imageZoom > 1 &&
      event.target instanceof Element &&
      event.target.closest('.image-viewer-image')
    ) {
      imageDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: imageOffset.x,
        offsetY: imageOffset.y,
      }
    }
  }

  function moveImagePointer(event) {
    const pointers = imagePointersRef.current
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size >= 2 && imagePinchRef.current) {
      const [first, second] = [...pointers.values()]
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      const pinch = imagePinchRef.current
      if (pinch.startDistance > 0) {
        const zoom = Math.min(
          5,
          Math.max(1, pinch.startZoom * distance / pinch.startDistance)
        )
        setImageZoom(zoom)
        setImageOffset((offset) =>
          zoom === 1 ? { x: 0, y: 0 } : constrainImageOffset(offset.x, offset.y, zoom)
        )
      }
      return
    }

    const drag = imageDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const offset = constrainImageOffset(
      drag.offsetX + event.clientX - drag.startX,
      drag.offsetY + event.clientY - drag.startY
    )
    setImageOffset(offset)
  }

  function endImagePointer(event) {
    const pointers = imagePointersRef.current
    pointers.delete(event.pointerId)
    if (imageDragRef.current?.pointerId === event.pointerId) {
      imageDragRef.current = null
    }
    if (pointers.size < 2) {
      imagePinchRef.current = null
      const remaining = pointers.entries().next().value
      if (remaining && imageZoom > 1) {
        const [pointerId, point] = remaining
        imageDragRef.current = {
          pointerId,
          startX: point.x,
          startY: point.y,
          offsetX: imageOffset.x,
          offsetY: imageOffset.y,
        }
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const load = useCallback(async () => {
    if (!params?.mode) {
      navigate('/')
      return
    }
    const loadToken = ++loadTokenRef.current
    window.clearTimeout(advanceTimerRef.current)
    finishedRef.current = false
    setResult(null)
    setAnswers({})
    setPendingIndex(null)
    setStudyTestStarted(false)
    setEarlyExamFailure(false)
    setShowExamResultNotice(false)
    setQuestionGridOpen(false)
    setHeaderTitleOpen(false)
    setIndex(0)
    setFailedImageId(null)
    setStorageImageId(null)
    setAttemptId(null)
    setError('')

    try {
      if (params.mode === 'review') {
        const review = await window.api.tests.review(params.attemptId)
        if (loadToken !== loadTokenRef.current) return
        setTitle(
          review.mode === 'section-exam' && !params.isRealExam
            ? `${t('intermediateResult')} · ${review.title || t('intermediate')} · ${review.total}`
            : `${t('result', { count: params.resultNumber || '' })} · ${t('realExam')}`
        )
        setResult({
          ...review,
          percent:
            review.total > 0
              ? Math.round((review.correct * 100) / review.total)
              : 0,
        })
        setHeaderTitleOpen(true)
        setSeconds(null)
        setQuestions(review.questions)
        setAnswers(
          Object.fromEntries(
            review.questions.map((question) => [
              question.id,
              {
                chosenIndex: question.chosenIndex,
                isCorrect: question.isCorrect,
                correctIndex: question.correctIndex,
              },
            ])
          )
        )
        return
      }

      const shouldResumeAttempt =
        ['exam', 'section-exam'].includes(params.mode) ||
        Boolean(params.resumeAttemptId)
      if (shouldResumeAttempt) {
        const resumed = await window.api.tests.resume({
          attemptId: params.resumeAttemptId,
          mode: params.mode,
          count: params.count,
          sectionId: params.sectionId,
        })
        if (loadToken !== loadTokenRef.current) return
        if (resumed) {
          const resumedTitle =
            params.mode === 'custom'
              ? t('customQuestionTitle', { count: resumed.total })
              : params.mode === 'similar'
                ? `${t('similarQuestions')} — ${resumed.total}`
                : params.mode === 'numeric'
                  ? `${t('numericQuestions')} — ${resumed.total}`
                  : params.mode === 'new-questions'
                    ? t('newQuestionsTitle', { count: resumed.total })
                    : params.mode === 'errors'
                      ? t('profileErrors')
                      : params.mode === 'saved'
                        ? t('savedQuestions')
                    : params.mode === 'exam' || params.isRealExam
                      ? t('examQuestionTitle', { count: resumed.total })
                      : t('intermediateTitle', {
                          section: params.sectionTitle || resumed.title,
                          count: resumed.total,
                        })
          setTitle(resumedTitle)
          setSeconds(resumed.secondsRemaining)
          setQuestions(resumed.questions)
          setAnswers(resumed.answers)
          setIndex(resumed.currentIndex)
          setAttemptId(resumed.id)
          if (resumed.result) {
            finishedRef.current = true
            setResult(resumed.result)
            setHeaderTitleOpen(true)
          }
          return
        }
      }

      const picked = await window.api.questions.pick(params)
      if (loadToken !== loadTokenRef.current) return
      const pickedTitle =
        params.mode === 'exam' || params.isRealExam
          ? t('examQuestionTitle', { count: picked.questions.length })
          : params.mode === 'variant'
            ? picked.title
            : params.mode === 'section-exam'
              ? t('intermediateTitle', {
                  section: params.sectionTitle || picked.title,
                  count: picked.questions.length,
                })
              : params.mode === 'custom'
                ? t('customQuestionTitle', { count: picked.questions.length })
                : params.mode === 'new-questions'
                  ? t('newQuestionsTitle', { count: picked.questions.length })
                    : params.mode === 'errors'
                      ? t('profileErrors')
                      : params.mode === 'saved'
                        ? t('savedQuestions')
                  : params.mode === 'similar'
                    ? `${t('similarQuestions')} — ${picked.questions.length}`
                    : params.mode === 'numeric'
                      ? `${t('numericQuestions')} — ${picked.questions.length}`
                      : picked.title
      setTitle(
        params.teacherMode ? `${t('teacher')} - ${pickedTitle}` : pickedTitle
      )
      setSeconds(
        params.untimed
          ? null
          : params.mode === 'custom'
            ? picked.questions.length * 75
            : picked.seconds
      )
      if (picked.questions.length === 0) {
        setQuestions(picked.questions)
        return
      }
      if (
        ['lesson', 'errors', 'saved'].includes(params.mode) &&
        !params.teacherMode
      ) {
        setQuestions(picked.questions)
        return
      }

      const id = await window.api.tests.start({
        mode: params.mode,
        lessonId: picked.lessonId || params.lessonId || null,
        sectionId: params.mode === 'section-exam' ? params.sectionId : null,
        total: picked.questions.length,
        title: params.mode === 'exam' ? t('realExam') : picked.title,
        seconds: params.untimed ? null : picked.seconds,
        questionIds: picked.questions.map((question) => question.id),
      })
      if (loadToken !== loadTokenRef.current) return
      setAttemptId(id)
      setQuestions(picked.questions)
    } catch (reason) {
      setError(reason.message || String(reason))
    }
  }, [params, navigate, t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!['errors', 'saved'].includes(params?.mode)) return undefined
    const refreshProgressList = () => {
      if (!studyTestStarted) void load()
    }
    window.addEventListener('pdd:progress-updated', refreshProgressList)
    window.addEventListener('pdd:database-updated', refreshProgressList)
    return () => {
      window.removeEventListener('pdd:progress-updated', refreshProgressList)
      window.removeEventListener('pdd:database-updated', refreshProgressList)
    }
  }, [load, params?.mode, studyTestStarted])

  const isRealExam = params?.mode === 'exam' || params?.isRealExam === true
  const is20QuestionRealExam = isRealExam && questions?.length === 20

  const finish = useCallback(async () => {
    if (finishedRef.current || !attemptId) return
    window.clearTimeout(advanceTimerRef.current)
    finishedRef.current = true
    setFinishing(true)
    try {
      const finished = await window.api.tests.finish(attemptId)
      const review = await window.api.tests.review(attemptId)
      setAnswers(
        Object.fromEntries(
          review.questions.map((question) => [
            question.id,
            {
              chosenIndex: question.chosenIndex,
              isCorrect: question.isCorrect,
              correctIndex: question.correctIndex,
            },
          ])
        )
      )
      setResult(finished)
      setQuestionGridOpen(false)
      setHeaderTitleOpen(true)
      if (is20QuestionRealExam) setShowExamResultNotice(true)
    } catch (reason) {
      finishedRef.current = false
      setError(reason.message || String(reason))
    } finally {
      setFinishing(false)
    }
  }, [attemptId, is20QuestionRealExam])

  const timer = useTimer(seconds, finish, !result)
  const currentQuestion = questions?.[index]
  const questionImageSource =
    storageImageId === currentQuestion?.id
      ? currentQuestion?.imageStorageUrl
      : currentQuestion?.imageUrl
  const cachedQuestionImage = useCachedImageUrl(questionImageSource)
  const fallbackImageSource = currentQuestion?.imageUrl
    ? null
    : fallbackImageUrl || noQuestionImage
  const cachedFallbackImage = useCachedImageUrl(fallbackImageSource)
  const questionSaved =
    savedQuestionState.id === currentQuestion?.id && savedQuestionState.saved

  useEffect(() => {
    let active = true
    setSavedQuestionState({ id: currentQuestion?.id ?? null, saved: false })
    if (currentQuestion?.id == null) return undefined
    window.api.saved
      .has(currentQuestion.id)
      .then((saved) => {
        if (active) setSavedQuestionState({ id: currentQuestion.id, saved })
      })
      .catch((reason) => {
        if (active) setError(reason.message || String(reason))
      })
    return () => {
      active = false
    }
  }, [currentQuestion?.id])

  useEffect(() => {
    if (currentQuestion?.imageUrl && cachedQuestionImage.error) {
      setFailedImageId(currentQuestion.id)
    }
  }, [currentQuestion?.id, currentQuestion?.imageUrl, cachedQuestionImage.error])

  if (!params?.mode) return null
  if (error && !questions) return <div className="error-text">{error}</div>
  if (!questions) return null

  if (questions.length === 0) {
    const emptyTitle =
      params.mode === 'lesson' || params.mode === 'teacher-lesson'
        ? t('emptyQuestions')
        : params.mode === 'errors'
          ? t('noErrors')
          : params.mode === 'saved'
            ? t('savedQuestionsEmpty')
          : params.mode === 'similar'
            ? t('noSimilarQuestions')
            : params.mode === 'numeric'
              ? t('noNumericQuestions')
              : t('noSectionQuestions')
    return <EmptyState emoji="🗂️" title={emptyTitle} />
  }

  const q = currentQuestion
  const current = answers[q.id]
  const answeredCount = Object.keys(answers).length
  const studyMode = ['lesson', 'errors', 'saved'].includes(params.mode) && !params.teacherMode
  const studyPhase = studyMode && !studyTestStarted
  const reviewMode = params.mode === 'review'
  const examMode =
    params.mode === 'exam' ||
    params.mode === 'section-exam' ||
    params.mode === 'variant'
  const threeMistakeExam = is20QuestionRealExam
  const confirmOnImage = params.mode === 'exam' || params.isRealExam === true
  const canShowHelp = Boolean(q.explanation || q.explanationImageUrl)
  const canOpenHelp =
    canShowHelp &&
    (studyPhase || Boolean(params.teacherMode) || Boolean(result) || reviewMode)
  const questionGridRows = Math.min(3, Math.ceil(questions.length / 30))
  const questionGridHeight =
    questionGridRows * 44 + Math.max(0, questionGridRows - 1) * 6 + 12

  async function startStudyTest() {
    setError('')
    try {
      const id = await window.api.tests.start({
        mode: params.mode,
        lessonId: params.mode === 'lesson' ? params.lessonId : null,
        total: questions.length,
        title,
        seconds: null,
        questionIds: questions.map((question) => question.id),
      })
      finishedRef.current = false
      setAnswers({})
      setIndex(0)
      setResult(null)
      setEarlyExamFailure(false)
      setAttemptId(id)
      setStudyTestStarted(true)
    } catch (reason) {
      setError(reason.message || String(reason))
    }
  }

  async function toggleQuestionSaved() {
    if (savingQuestion) return
    setSavingQuestion(true)
    try {
      const saved = await window.api.saved.toggle(q.id)
      setSavedQuestionState({ id: q.id, saved })
    } catch (reason) {
      setError(reason.message || String(reason))
    } finally {
      setSavingQuestion(false)
    }
  }

  async function submitAnswer(optionIndex) {
    if (current || answering || finishing || result || !attemptId) return
    setAnswering(true)
    try {
      const answer = await window.api.tests.answer({
        attemptId,
        questionId: q.id,
        chosenIndex: optionIndex,
        mode: params.mode,
      })
      setAnswers((existing) => ({
        ...existing,
        [q.id]: { chosenIndex: optionIndex, ...answer },
      }))
      setPendingIndex(null)
      const wrongCount =
        Object.values(answers).filter(
          (existingAnswer) =>
            existingAnswer.chosenIndex != null && !existingAnswer.isCorrect
        ).length + Number(!answer.isCorrect)
      if (threeMistakeExam && wrongCount >= 3) {
        setEarlyExamFailure(true)
        await finish()
      } else if (answeredCount + 1 >= questions.length) {
        await finish()
      } else if (!params.showExplanations) {
        advanceTimerRef.current = window.setTimeout(
          () => goTo(Math.min(index + 1, questions.length - 1)),
          450
        )
      }
    } catch (reason) {
      setError(reason.message || String(reason))
    } finally {
      setAnswering(false)
    }
  }

  async function selectOption(optionIndex) {
    if (
      studyPhase ||
      current ||
      answering ||
      finishing ||
      result ||
      reviewMode
    )
      return
    if (confirmOnImage) {
      setPendingIndex(optionIndex)
      return
    }
    void submitAnswer(optionIndex)
  }

  function clearPendingAnswer() {
    setPendingIndex(null)
  }

  function goTo(nextIndex) {
    if (nextIndex >= 0 && nextIndex < questions.length) {
      window.clearTimeout(advanceTimerRef.current)
      setIndex(nextIndex)
      if (
        !result &&
        attemptId &&
        (params.mode === 'exam' || params.mode === 'section-exam')
      ) {
        window.api.tests
          .setProgress({ attemptId, currentIndex: nextIndex })
          .catch((reason) => setError(reason.message || String(reason)))
      }
    }
  }

  async function handleFinishClick() {
    const confirmed = await confirm({
      title: t('finish'),
      message: t('finishConfirm'),
      confirmLabel: t('finish'),
      cancelLabel: t('cancel'),
      danger: true,
    })
    if (!confirmed) return
    await finish()
  }

  async function handleRestartClick() {
    if (!result) {
      const confirmed = await confirm({
        title: t('restartTest'),
        message: t('restartConfirm'),
        confirmLabel: t('restartTest'),
        cancelLabel: t('cancel'),
        danger: true,
      })
      if (!confirmed) return
    }
    retryAttempt()
  }

  function retryAttempt() {
    if (studyMode) {
      void startStudyTest()
      return
    }
    const newParams = { ...params }
    delete newParams.resumeAttemptId
    navigate('/run', { replace: true, state: newParams })
  }

  function startQuestionSwipe(event) {
    const touch = event.touches[0]
    if (event.touches.length !== 1 || !touch) {
      questionSwipeTouchRef.current = null
      return
    }
    questionSwipeTouchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      target: event.target,
    }
  }

  function finishQuestionSwipe(event) {
    const start = questionSwipeTouchRef.current
    questionSwipeTouchRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch || helpOpen || viewerImage || !questions) return
    if (
      start.target instanceof Element &&
      start.target.closest('.q-grid, [role="dialog"]')
    )
      return

    const distanceX = touch.clientX - start.startX
    const distanceY = touch.clientY - start.startY
    if (Math.abs(distanceX) < 50 || Math.abs(distanceX) < Math.abs(distanceY) * 1.25) return
    goTo(index + (distanceX < 0 ? 1 : -1))
  }

  function startQuestionGridSwipe(event) {
    const touch = event.touches[0]
    if (!touch) return
    questionGridTouchRef.current = {
      startY: touch.clientY,
      scrollTop: questionGridRef.current?.scrollTop ?? 0,
    }
  }

  function finishQuestionGridSwipe(event) {
    const start = questionGridTouchRef.current
    questionGridTouchRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return
    const distance = touch.clientY - start.startY
    if (Math.abs(distance) < 36) return
    if (distance < 0 && !questionGridOpen) {
      setQuestionGridOpen(true)
      ignoreQuestionGridClickUntilRef.current = Date.now() + 500
    } else if (distance > 0 && questionGridOpen && start.scrollTop <= 0) {
      setQuestionGridOpen(false)
      ignoreQuestionGridClickUntilRef.current = Date.now() + 500
    }
  }

  function questionStatus(question, questionIndex) {
    const answer = answers[question.id]
    const pending = questionIndex === index && pendingIndex != null
    let className = 'q-dot'
    if (questionIndex === index) className += ' current'
    if (answer?.chosenIndex != null) {
      className += answer.isCorrect ? ' answered-correct' : ' answered-wrong'
    } else if (earlyExamFailure) {
      className += ' answered-wrong'
    } else if (pending) {
      className += ' answered'
    }
    return className
  }

  return (
    <div
      className="test-page"
      onTouchStart={startQuestionSwipe}
      onTouchEnd={finishQuestionSwipe}
      onTouchCancel={() => {
        questionSwipeTouchRef.current = null
      }}
    >
      <div className="test-shell">
        <div className="test-main">
          <div
            className={`glass test-topbar${headerTitleOpen ? '' : ' is-compact'}`}
          >
            <div className="test-topbar-heading">
              <div className="title">{title}</div>
              <span className="q-chip">
                {index + 1} / {questions.length}
              </span>
            </div>
            {result && (
              <div
                className={`test-result-summary${result.percent >= 90 ? ' passed' : ' failed'}`}
                role="status"
              >
                <span>
                  {result.percent >= 90
                    ? t('examPassedShort')
                    : t('examNotPassedShort')}
                </span>
                <strong>{result.percent}%</strong>
              </div>
            )}
            <div className="test-topbar-actions">
              <button
                className="header-title-toggle"
                type="button"
                onClick={() => setHeaderTitleOpen((open) => !open)}
                aria-label={t(
                  headerTitleOpen ? 'hideTestTitle' : 'showTestTitle'
                )}
                aria-expanded={headerTitleOpen}
                title={t(headerTitleOpen ? 'hideTestTitle' : 'showTestTitle')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d={headerTitleOpen ? 'm6 9 6 6 6-6' : 'm6 15 6-6 6 6'}
                  />
                </svg>
              </button>
              {canOpenHelp && (
                <button
                  className="btn help-icon-btn"
                  type="button"
                  onClick={() => {
                    setHelpOpen(true)
                  }}
                  aria-label={t('help')}
                  title={t('help')}
                >
                  !
                </button>
              )}
              {timer.formatted && (
                <span
                  className={
                    'timer-pill' + (timer.isDanger && !result ? ' danger' : '')
                  }
                >
                  ⏱ {timer.formatted}
                </span>
              )}
              {(!studyMode || studyTestStarted) && !reviewMode && result && (
                <button
                  className="btn test-restart-btn"
                  type="button"
                  onClick={() => void handleRestartClick()}
                >
                  {t('restartTest')}
                </button>
              )}
              {studyMode && !studyTestStarted && (
                <button
                  className="btn btn-primary topic-test-btn"
                  type="button"
                  onClick={() => void startStudyTest()}
                >
                  {t('topicTest')}
                </button>
              )}
              {studyMode && studyTestStarted && !result && (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => void handleFinishClick()}
                  disabled={finishing}
                >
                  {t('finish')}
                </button>
              )}
              {!reviewMode && !studyMode && !result && (
                <button
                  className="btn btn-danger"
                  onClick={handleFinishClick}
                  disabled={finishing || !!result}
                >
                  {t('finish')}
                </button>
              )}
            </div>
          </div>

          <div className="glass question-card">
            <div className="question-layout">
              <div className="question-text">{q.text}</div>
              <div className="question-visual">
                <button
                  type="button"
                  className={`question-image-save-btn${questionSaved ? ' is-saved' : ''}`}
                  onClick={() => void toggleQuestionSaved()}
                  disabled={savingQuestion}
                  aria-label={t(questionSaved ? 'removeSavedQuestion' : 'saveQuestion')}
                  title={t(questionSaved ? 'removeSavedQuestion' : 'saveQuestion')}
                  aria-pressed={questionSaved}
                >
                  <IconBookmark />
                </button>
                {q.imageUrl && failedImageId !== q.id && cachedQuestionImage.url ? (
                  <img
                    className="question-image"
                    src={toFileUrl(cachedQuestionImage.url)}
                    alt={t('questionImage')}
                    role="button"
                    tabIndex={0}
                    title={t('zoomImage')}
                    onClick={(event) =>
                      openImageViewer(event.currentTarget.src)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openImageViewer(event.currentTarget.src)
                      }
                    }}
                    onError={() => {
                      if (
                        storageImageId !== q.id &&
                        q.imageStorageUrl &&
                        q.imageStorageUrl !== q.imageUrl
                      ) {
                        setStorageImageId(q.id)
                      } else {
                        setFailedImageId(q.id)
                      }
                    }}
                  />
                ) : !q.imageUrl ? (
                  <img
                    className="question-image"
                    src={cachedFallbackImage.url || noQuestionImage}
                    alt={t('noImage')}
                  />
                ) : null}
                {confirmOnImage && pendingIndex != null && !current && (
                  <div className="exam-answer-overlay">
                    <button
                      type="button"
                      className="exam-answer-confirm option-btn"
                      disabled={answering}
                      onClick={() => void submitAnswer(pendingIndex)}
                      title={t('confirmSelectedAnswer')}
                    >
                      F{pendingIndex + 1}: {q.options[pendingIndex]}
                    </button>
                    <button
                      type="button"
                      className="exam-answer-cancel"
                      onClick={clearPendingAnswer}
                      disabled={answering}
                      aria-label={t('cancelSelectedAnswer')}
                      title={t('cancelSelectedAnswer')}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <div className="question-copy">
                <div className="options">
                  {q.options.map((option, optionIndex) => {
                    let className = 'option-btn'
                    const selectedIndex = reviewMode
                      ? current?.chosenIndex
                      : current?.chosenIndex
                    if (studyPhase) {
                      if (optionIndex === q.correctIndex)
                        className += ' lesson-answer-correct'
                    } else if (reviewMode) {
                      if (optionIndex === current?.correctIndex)
                        className += ' correct'
                      if (optionIndex === selectedIndex && !current?.isCorrect)
                        className += ' incorrect'
                      if (optionIndex === selectedIndex && current?.isCorrect)
                        className += ' correct'
                    } else if (examMode && current) {
                      if (optionIndex === current.correctIndex)
                        className += ' correct'
                      else if (optionIndex === current.chosenIndex)
                        className += ' incorrect'
                    } else if (!examMode && current) {
                      if (optionIndex === current.correctIndex)
                        className += ' correct'
                      else if (optionIndex === current.chosenIndex)
                        className += ' incorrect'
                    } else if (pendingIndex === optionIndex) {
                      className += ' selected'
                    }
                    return (
                      <button
                        key={optionIndex}
                        className={className}
                        onClick={() => selectOption(optionIndex)}
                        disabled={
                          studyPhase ||
                          !!current ||
                          answering ||
                          finishing ||
                          !!result ||
                          reviewMode
                        }
                      >
                        <strong className="option-label">F{optionIndex + 1}</strong>
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}
          <div className="glass test-navigation">
            <div
              className={`question-grid-panel${questionGridOpen ? ' is-open' : ''}`}
              onTouchStart={startQuestionGridSwipe}
              onTouchEnd={finishQuestionGridSwipe}
              onTouchCancel={() => {
                questionGridTouchRef.current = null
              }}
            >
              <div
                className="q-grid"
                ref={questionGridRef}
                style={{ height: `${questionGridHeight}px` }}
              >
                <div
                  className={`q-grid-page${questions.length < 30 ? ' is-compact' : ''}`}
                  style={
                    questions.length < 30
                      ? {
                          gridTemplateColumns: `repeat(${questions.length}, minmax(0, 44px))`,
                        }
                      : undefined
                  }
                >
                  {questions.map((question, questionIndex) => (
                    <button
                      type="button"
                      key={question.id}
                      className={questionStatus(question, questionIndex)}
                      onClick={() => {
                        if (Date.now() < ignoreQuestionGridClickUntilRef.current) return
                        goTo(questionIndex)
                        setQuestionGridOpen(false)
                      }}
                      aria-label={`${questionIndex + 1}`}
                      aria-current={questionIndex === index ? 'step' : undefined}
                    >
                      {questionIndex + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {helpOpen && canOpenHelp && (
        <HelpDrawer
          question={q}
          onClose={() => setHelpOpen(false)}
        />
      )}
      {viewerImage && (
        <div
          className="image-viewer-overlay"
          role="presentation"
          onClick={() => setViewerImage(null)}
        >
          <section
            className="image-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={t('zoomImage')}
            onClick={() => setViewerImage(null)}
          >
            <div
              className="image-viewer-viewport"
              ref={imageViewportRef}
              onWheel={handleImageWheel}
              onPointerDown={startImagePointer}
              onPointerMove={moveImagePointer}
              onPointerUp={endImagePointer}
              onPointerCancel={endImagePointer}
            >
              <img
                className={`image-viewer-image${imageZoom > 1 ? ' is-zoomed' : ''}`}
                src={viewerImage}
                alt={t('questionImage')}
                draggable="false"
                style={{
                  transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom})`,
                }}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </section>
        </div>
      )}
      {showExamResultNotice && result && (
        <div
          className={`exam-result-overlay${result.percent < 90 ? ' failed' : ' passed'}`}
        >
          <section
            className="exam-result-notice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-result-title"
          >
            <h1 id="exam-result-title">
              <span className="exam-result-emoji" aria-hidden="true">
                {result.percent < 90 ? '😔' : '😊'}
              </span>
              {result.percent < 90
                ? t('examFailureTitle')
                : t('examSuccessTitle')}
            </h1>
            <h2>
              {result.percent < 90 ? t('examNotPassed') : t('examPassed')}
            </h2>
            <p>
              {t('examTotalScore', {
                percent: ((result.correct / result.total) * 100).toFixed(2),
              })}
            </p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowExamResultNotice(false)}
              autoFocus
            >
              {t('back')}
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
