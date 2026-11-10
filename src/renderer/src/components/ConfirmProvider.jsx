import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

const ConfirmContext = createContext(null)

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('Tasdiqlash oynasi topilmadi.')
  return confirm
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolveRef = useRef(null)

  const finish = useCallback((confirmed) => {
    resolveRef.current?.(confirmed)
    resolveRef.current = null
    setDialog(null)
  }, [])

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolveRef.current?.(false)
        resolveRef.current = resolve
        setDialog(options)
      }),
    []
  )

  useEffect(() => {
    if (!dialog) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialog, finish])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          className="modal-overlay confirm-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finish(false)
          }}
        >
          <section
            className="glass confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
          >
            {dialog.showClose && (
              <button
                type="button"
                className="confirm-modal-close"
                aria-label={dialog.closeLabel || 'Close'}
                title={dialog.closeLabel || 'Close'}
                onClick={() => finish(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
            <div
              className={`confirm-modal-icon${dialog.danger ? ' danger' : ''}`}
              aria-hidden="true"
            >
              {dialog.danger ? '!' : '?'}
            </div>
            <div className="confirm-modal-copy">
              <h2 id="confirm-title">{dialog.title}</h2>
              <p id="confirm-message">{dialog.message}</p>
            </div>
            <div className="confirm-modal-actions">
              {!dialog.showClose && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => finish(false)}
                >
                  {dialog.cancelLabel || 'Bekor qilish'}
                </button>
              )}
              <button
                autoFocus
                className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                type="button"
                onClick={() => finish(true)}
              >
                {dialog.confirmLabel || 'Tasdiqlash'}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
