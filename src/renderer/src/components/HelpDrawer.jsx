import { useEffect, useRef, useState } from 'react'
import { useUi } from '../i18n'
import { useCachedImageUrl } from '../web/images'

export default function HelpDrawer({ question, onClose }) {
  const t = useUi()
  const [imageFailed, setImageFailed] = useState(false)
  const [activeContent, setActiveContent] = useState('image')
  const [imageZoom, setImageZoom] = useState(1)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const imageDragRef = useRef(null)
  const cachedImage = useCachedImageUrl(question?.explanationImageUrl)

  useEffect(() => {
    setImageFailed(false)
    setActiveContent(question?.explanationImageUrl ? 'image' : 'text')
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
  }, [question?.id, question?.explanationImageUrl])

  useEffect(() => {
    if (cachedImage.error) {
      setImageFailed(true)
      if (question?.explanation) setActiveContent('text')
    }
  }, [cachedImage.error, question?.explanation])

  if (!question) return null
  const hasText = Boolean(question.explanation)
  const hasImage = Boolean(question.explanationImageUrl)
  const imageAvailable = hasImage && !imageFailed
  const hasContent = hasText || hasImage
  const showImage = activeContent === 'image' && imageAvailable && cachedImage.url

  function zoomImage(factor) {
    setImageZoom((current) =>
      Math.max(0.1, Math.min(5, current * factor))
    )
  }

  function resetImageZoom() {
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
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

  return (
    <div
      className="image-viewer-overlay help-viewer-overlay"
      onClick={onClose}
    >
      <section
        className={`help-viewer${showImage ? ' is-image-mode' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('help')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`glass help-modal-frame${showImage ? ' is-image-mode' : ''}`}>
          <div className="drawer-header">
            <div className="drawer-header-actions">
              {hasContent && (
                <button
                  className="btn drawer-content-toggle"
                  type="button"
                  onClick={() => {
                    setActiveContent((content) =>
                      content === 'image' ? 'text' : 'image'
                    )
                    resetImageZoom()
                  }}
                  disabled={activeContent === 'image' ? !hasText : !imageAvailable}
                >
                  {activeContent === 'image' ? t('textMode') : t('imageMode')}
                </button>
              )}
            </div>
            <button className="icon-btn" type="button" onClick={onClose} aria-label={t('close')}>
              ✕
            </button>
          </div>
          <div className={`help-modal-body${showImage ? ' drawer-body-image' : ''}`}>
            {hasContent ? (
              <>
                {activeContent === 'text' && hasText && <p>{question.explanation}</p>}
                {showImage && (
                  <div
                    className="help-image-viewport"
                    onWheel={handleImageWheel}
                    onPointerDown={startImageDrag}
                    onPointerMove={moveImageDrag}
                    onPointerUp={endImageDrag}
                    onPointerCancel={endImageDrag}
                  >
                    <img
                      src={toFileUrl(cachedImage.url)}
                      alt={t('imageMode')}
                      draggable="false"
                      className={imageZoom > 1 ? 'is-zoomed' : ''}
                      style={{
                        transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom})`,
                      }}
                      onError={() => {
                        setImageFailed(true)
                        if (hasText) setActiveContent('text')
                      }}
                    />
                  </div>
                )}
                {activeContent === 'image' && imageFailed && (
                  <p className="drawer-image-error">{t('imageLoadFailed')}</p>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--text-dim)' }}>
                {t('noExplanation')}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export function toFileUrl(p) {
  if (!p) return p
  if (/^(https?:|file:|blob:)/i.test(p)) return p
  const normalized = p.replace(/\\/g, '/')
  const drive = normalized.match(/^([A-Za-z]:)(\/.*)$/)
  const encodePath = (value) => value.split('/').map((part) => encodeURIComponent(part)).join('/')
  if (drive) return `file:///${drive[1]}${encodePath(drive[2])}`
  if (/^\/[A-Za-z]:\//.test(normalized)) return `file:///${normalized.slice(1, 3)}${encodePath(normalized.slice(3))}`
  return `file://${encodePath(normalized.startsWith('/') ? normalized : `/${normalized}`)}`
}
