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
  const [topicTestStarted, setTopicTestStarted] = useState(false)
  const [earlyExamFailure, setEarlyExamFailure] = useState(false)
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
  const questionGridRef = useRef(null)
  const questionGridTouchRef = useRef(null)
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
        } else {
          event.preventDefault()
          const historyIndex = window.history.state?.idx
          if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1)
          else navigate('/topics', { replace: true })
        }
        return
      }

      if (viewerImage || helpOpen || !questions)
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
    questions,
    index,
    navigate,
  ])

  function zoomImage(factor) {
    setImageZoom((current) => {
      const next = current * factor
      return Number.isFinite(next) ? Math.max(0.1, next) : current
    })
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

  function startImageDrag(event) {
    if (imageZoom <= 1) return
    event.preventDefault()
    imageDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: imageOffset.x,
      offsetY: imageOffset.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveImageDrag(event) {
    const drag = imageDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setImageOffset({
      x: drag.offsetX + event.clientX - drag.startX,
      y: drag.offsetY + event.clientY - drag.startY,
    })
  }

  function endImageDrag(event) {
    if (imageDragRef.current?.pointerId !== event.pointerId) return
    imageDragRef.current = null
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
    setTopicTestStarted(false)
    setEarlyExamFailure(false)
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
      if (params.mode === 'lesson' && !params.teacherMode) {
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
      setHeaderTitleOpen(false)
    } catch (reason) {
      finishedRef.current = false
      setError(reason.message || String(reason))
    } finally {
      setFinishing(false)
    }
  }, [attemptId])

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
  const lessonMode = params.mode === 'lesson' && !params.teacherMode
  const lessonStudyMode = lessonMode && !topicTestStarted
  const reviewMode = params.mode === 'review'
  const examMode =
    params.mode === 'exam' ||
    params.mode === 'section-exam' ||
    params.mode === 'variant'
  const threeMistakeExam = is20QuestionRealExam
  const confirmOnImage = params.mode === 'exam' || params.isRealExam === true
  const canShowHelp = Boolean(q.explanation || q.explanationImageUrl)
  const canOpenHelp =
    canShowHelp && (lessonStudyMode || Boolean(params.teacherMode))
  const questionGridRows = Math.min(3, Math.ceil(questions.length / 30))
  const questionGridHeight =
    questionGridRows * 44 + Math.max(0, questionGridRows - 1) * 6 + 12

  async function startTopicTest() {
    setError('')
    try {
      const id = await window.api.tests.start({
        mode: 'lesson',
        lessonId: params.lessonId,
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
      setTopicTestStarted(true)
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
      lessonStudyMode ||
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
    if (lessonMode) {
      void startTopicTest()
      return
    }
    const newParams = { ...params }
    delete newParams.resumeAttemptId
    navigate('/run', { replace: true, state: newParams })
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
    <div className="test-page">
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
                className="btn header-title-toggle"
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
              {(!lessonMode || topicTestStarted) && !reviewMode && result && (
                <button
                  className="btn test-restart-btn"
                  type="button"
                  onClick={() => void handleRestartClick()}
                >
                  {t('restartTest')}
                </button>
              )}
              {lessonMode && !topicTestStarted && (
                <button
                  className="btn btn-primary topic-test-btn"
                  type="button"
                  onClick={() => void startTopicTest()}
                >
                  {t('topicTest')}
                </button>
              )}
              {lessonMode && topicTestStarted && !result && (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => void handleFinishClick()}
                  disabled={finishing}
                >
                  {t('finish')}
                </button>
              )}
              {!reviewMode && !lessonMode && !result && (
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
            <div className="question-save-bar">
              <button
                type="button"
                className={`btn question-save-btn${questionSaved ? ' is-saved' : ''}`}
                onClick={() => void toggleQuestionSaved()}
                disabled={savingQuestion}
                aria-pressed={questionSaved}
              >
                <IconBookmark />
                {t(questionSaved ? 'removeSavedQuestion' : 'saveQuestion')}
              </button>
            </div>
            <div className="question-layout">
              <div className="question-text">{q.text}</div>
              <div className="question-visual">
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
                    if (lessonStudyMode) {
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
                          lessonStudyMode ||
                          !!current ||
                          answering ||
                          finishing ||
                          !!result ||
                          reviewMode
                        }
                      >
                        <strong className="option-label">
                          <span className="key-f">F</span>
                          {optionIndex + 1}
                        </strong>
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
            <button
              className="btn test-nav-arrow"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label={t('previous')}
              title={t('previous')}
            >
              <span className="test-nav-chevron" aria-hidden="true">‹</span>
            </button>
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
            <button
              className="btn test-nav-arrow"
              onClick={() => goTo(index + 1)}
              disabled={index === questions.length - 1}
              aria-label={t('next')}
              title={t('next')}
            >
              <span className="test-nav-chevron" aria-hidden="true">›</span>
            </button>
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
            onClick={(event) => event.stopPropagation()}
          >
            <div className="image-viewer-toolbar">
              <button
                type="button"
                className="btn"
                onClick={() => zoomImage(1.25)}
                aria-label={t('zoomIn')}
              >
                ＋
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => zoomImage(1 / 1.25)}
                aria-label={t('zoomOut')}
              >
                −
              </button>
              <span>{Math.round(imageZoom * 100)}%</span>
              <button type="button" className="btn" onClick={resetImageZoom}>
                {t('resetZoom')}
              </button>
              <button
                type="button"
                className="btn image-viewer-close"
                onClick={() => setViewerImage(null)}
                aria-label={t('close')}
              >
                ×
              </button>
            </div>
            <div className="image-viewer-viewport" onWheel={handleImageWheel}>
              <img
                className={`image-viewer-image${imageZoom > 1 ? ' is-zoomed' : ''}`}
                src={viewerImage}
                alt={t('questionImage')}
                draggable="false"
                style={{
                  transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom})`,
                }}
                onPointerDown={startImageDrag}
                onPointerMove={moveImageDrag}
                onPointerUp={endImageDrag}
                onPointerCancel={endImageDrag}
              />
            </div>
            <p className="image-viewer-hint">{t('zoomHint')}</p>
          </section>
        </div>
      )}
    </div>
  )
}
