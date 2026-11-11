// window.api — kompyuter ilovasidagi preload/ipc o'rniga brauzerda ishlaydigan to'liq o'xshash API.
import * as engine from './engine'
import * as activation from './activation'
import * as sync from './sync'

const listeners = {
  changed: new Set(),
  required: new Set(),
  progress: new Set(),
  progressError: new Set(),
}
const emit = (name, data) => listeners[name].forEach((cb) => cb(data))
const subscribe = (name) => (cb) => {
  listeners[name].add(cb)
  return () => listeners[name].delete(cb)
}

let activeSync = null

async function ready() {
  await engine.init()
}

// Faollashtirilmagan qurilmada ma'lumot API'lari ishlamaydi (ilovadagi requireActivation bilan bir xil).
function guarded(fn) {
  return async (...args) => {
    await ready()
    const status = activation.status()
    if (!status.activated) {
      emit('required', status)
      throw new Error('DEVICE_NOT_ACTIVATED')
    }
    return fn(...args)
  }
}

async function flushQuestionProgress() {
  try {
    const synced = await engine.flushActivationProgress()
    if (synced) {
      emit('progressError', '')
      window.dispatchEvent(new Event('pdd:progress-updated'))
    }
  } catch (error) {
    emit('progressError', error?.message || 'Foydalanuvchi savollari sinxronlanmadi.')
  }
}

async function runSync(operation) {
  if (activeSync) return { ok: true, skipped: true }
  const controller = new AbortController()
  activeSync = controller
  try {
    const result = await operation((progress) => emit('progress', progress), controller.signal)
    return { ok: true, ...result }
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') return { ok: false, cancelled: true }
    return { ok: false, message: error?.message || 'Sinxronizatsiyada xatolik' }
  } finally {
    activeSync = null
  }
}

const sync_ = (name) => (...args) => engine.init().then(() => sync[name](...args))

window.api = {
  isWeb: true,

  window: { minimize() {}, maximize() {}, close() {} },

  activation: {
    status: async () => {
      await ready()
      return activation.status()
    },
    activate: async (code) => {
      await ready()
      const result = await activation.activate(code)
      if (result.ok) emit('changed', activation.status())
      return result
    },
    revalidate: async () => {
      await ready()
      const result = await activation.revalidate()
      emit('changed', result)
      return result
    },
    requireReactivation: async () => {
      await ready()
      return activation.requireReactivation()
    },
    logout: async () => {
      await ready()
      const result = await activation.logout()
      emit('changed', result)
      return result
    },
    getSavedCode: async () => {
      await ready()
      return activation.getSavedActivationCode()
    },
    retryDeviceActivation: async (code) => {
      await ready()
      const result = await activation.retryDeviceActivation(code)
      if (result.ok) emit('changed', activation.status())
      return result
    },
    onChanged: subscribe('changed'),
    onRequired: subscribe('required'),
  },

  progress: {
    sync: async () => {
      await ready()
      try {
        const synced = await engine.syncActivationProgress()
        if (synced) {
          emit('progressError', '')
          window.dispatchEvent(new Event('pdd:progress-updated'))
        }
        return synced
      } catch (error) {
        emit('progressError', error?.message || 'Foydalanuvchi savollari sinxronlanmadi.')
        throw error
      }
    },
    onError: subscribe('progressError'),
  },

  sync: {
    refreshBase: guarded(() => runSync(sync_('refreshBase'))),
    cancel: () => activeSync?.abort(),
    onProgress: subscribe('progress'),
  },

  settings: {
    get: async () => {
      await ready()
      return { ...engine.getSettings(), language: engine.getLanguage() }
    },
    setLanguage: async (language) => {
      await ready()
      return engine.setLanguage(language)
    },
  },

  theme: {
    get: async () => {
      await ready()
      return engine.getTheme()
    },
    set: async (theme) => {
      await ready()
      return engine.setTheme(theme)
    },
  },

  catalog: {
    totalQuestions: guarded(() => engine.totalQuestions()),
    newQuestionCount: guarded(() => engine.newQuestionCount()),
    sections: guarded(() => engine.sectionCatalog()),
    lessons: guarded((sectionId) => engine.lessonCatalog(sectionId)),
    variants: guarded(() => engine.examVariants()),
    questionCounts: guarded(() => engine.questionCounts()),
  },

  questions: { pick: guarded((payload) => engine.pickQuestions(payload)) },

  saved: {
    list: guarded(() => engine.listSavedQuestions()),
    has: guarded((questionId) => engine.isQuestionSaved(questionId)),
    clear: guarded(async () => {
      await engine.syncActivationProgress()
      const count = await engine.clearSavedQuestions()
      await flushQuestionProgress()
      return count
    }),
    toggle: guarded(async (questionId) => {
      const saved = await engine.toggleSavedQuestion(questionId)
      await flushQuestionProgress()
      return saved
    }),
  },

  errors: {
    clear: guarded(async () => {
      await engine.syncActivationProgress()
      const count = await engine.clearErrorQuestions()
      await flushQuestionProgress()
      return count
    }),
  },

  tests: {
    start: guarded((payload) => engine.startAttempt(payload)),
    activeAttempt: guarded((payload) => engine.findActiveAttempt(payload)),
    resume: guarded((payload) => engine.resumeAttempt(payload)),
    setProgress: guarded((payload) => engine.setAttemptProgress(payload)),
    answer: guarded(async (payload) => {
      const answer = await engine.answerQuestion(payload)
      await flushQuestionProgress()
      return answer
    }),
    finish: guarded((attemptId) => engine.finishAttempt(attemptId)),
    history: guarded(() => engine.examHistory()),
    review: guarded((attemptId) => engine.reviewAttempt(attemptId)),
  },
}
