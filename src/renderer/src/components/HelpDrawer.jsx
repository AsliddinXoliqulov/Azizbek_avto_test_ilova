import { useEffect, useRef, useState } from 'react'
import { useUi } from '../i18n'
import { useCachedImageUrl } from '../web/images'

export default function HelpDrawer({ question, onClose }) {
  const t = useUi()
  const [imageFailed, setImageFailed] = useState(false)
  const [activeContent, setActiveContent] = useState('image')
  const [flipRotation, setFlipRotation] = useState(0)
  const [cardSize, setCardSize] = useState(null)
  const [imageZoom, setImageZoom] = useState(1)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const imageViewportRef = useRef(null)
  const imageElementRef = useRef(null)
  const imagePointersRef = useRef(new Map())
  const imagePinchRef = useRef(null)
  const imageDragRef = useRef(null)
  const imageSwipeRef = useRef(null)
  const textSwipeRef = useRef(null)
  const ignoreImageClickRef = useRef(false)
  const cachedImage = useCachedImageUrl(question?.explanationImageUrl)

  useEffect(() => {
    setImageFailed(false)
    setActiveContent(question?.explanationImageUrl ? 'image' : 'text')
    setFlipRotation(question?.explanationImageUrl ? 0 : 180)
    setCardSize(null)
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
  }, [question?.id, question?.explanationImageUrl])

  useEffect(() => {
    const handleResize = () => updateCardSize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (cachedImage.error) {
      setImageFailed(true)
      if (question?.explanation) {
        setActiveContent('text')
        setFlipRotation(180)
      }
    }
  }, [cachedImage.error, question?.explanation])

  if (!question) return null
  const hasText = Boolean(question.explanation)
  const hasImage = Boolean(question.explanationImageUrl)
  const imageAvailable = hasImage && !imageFailed

  function updateCardSize(image = imageElementRef.current) {
    if (!image?.complete || !image.naturalWidth) return
    setCardSize({ width: image.offsetWidth, height: image.offsetHeight })
  }

  function resetImageZoom() {
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
  }

  function zoomImage(factor) {
    const zoom = Math.min(5, Math.max(1, imageZoom * factor))
    setImageZoom(zoom)
    if (zoom === 1) setImageOffset({ x: 0, y: 0 })
  }

  function flipTo(content, direction) {
    if (content === activeContent) return
    if (content === 'image' && !imageAvailable) return
    if (content === 'text' && !hasText) return
    setActiveContent(content)
    setFlipRotation((rotation) => rotation + (direction > 0 ? 180 : -180))
    resetImageZoom()
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
      imageSwipeRef.current = null
      imagePinchRef.current = {
        startDistance: Math.hypot(first.x - second.x, first.y - second.y),
        startZoom: imageZoom,
      }
      return
    }

    imageSwipeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startZoom: imageZoom,
    }
    if (imageZoom > 1) {
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
        const zoom = Math.min(5, Math.max(1, pinch.startZoom * distance / pinch.startDistance))
        setImageZoom(zoom)
        setImageOffset((offset) =>
          zoom === 1 ? { x: 0, y: 0 } : constrainImageOffset(offset.x, offset.y, zoom)
        )
      }
      return
    }

    const drag = imageDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setImageOffset(
      constrainImageOffset(
        drag.offsetX + event.clientX - drag.startX,
        drag.offsetY + event.clientY - drag.startY
      )
    )
  }

  function endImagePointer(event) {
    const pointers = imagePointersRef.current
    const swipe = imageSwipeRef.current
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

    if (pointers.size === 0) {
      imageSwipeRef.current = null
      if (swipe && swipe.startZoom <= 1 && imageZoom <= 1 && hasText) {
        const deltaX = event.clientX - swipe.startX
        const deltaY = event.clientY - swipe.startY
        if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
          ignoreImageClickRef.current = true
          flipTo('text', deltaX)
        }
      }
    }
  }

  function startTextSwipe(event) {
    const touch = event.touches[0]
    if (touch) {
      textSwipeRef.current = { x: touch.clientX, y: touch.clientY }
    }
  }

  function finishTextSwipe(event) {
    const start = textSwipeRef.current
    textSwipeRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch || !imageAvailable) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      flipTo('image', deltaX)
    }
  }

  return (
    <div className="image-viewer-overlay help-viewer-overlay" onClick={onClose}>
      <section
        className="help-flip-card"
        style={cardSize ? { width: `${cardSize.width}px`, height: `${cardSize.height}px` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={t('help')}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="help-flip-inner"
          style={{ transform: `rotateY(${flipRotation}deg)` }}
        >
          <div className="help-flip-face help-flip-image-face">
            <div
              className="image-viewer-viewport"
              ref={imageViewportRef}
              onWheel={handleImageWheel}
              onPointerDown={startImagePointer}
              onPointerMove={moveImagePointer}
              onPointerUp={endImagePointer}
              onPointerCancel={endImagePointer}
              onDoubleClick={(event) => {
                if (!event.target.closest('.image-viewer-image')) return
                event.preventDefault()
                setImageZoom((zoom) => {
                  const nextZoom = zoom > 1 ? 1 : 2
                  if (nextZoom === 1) setImageOffset({ x: 0, y: 0 })
                  return nextZoom
                })
              }}
              onClick={(event) => {
                event.stopPropagation()
                if (ignoreImageClickRef.current) {
                  ignoreImageClickRef.current = false
                  return
                }
                if (!event.target.closest('.image-viewer-image')) onClose()
              }}
            >
              {cachedImage.url && !imageFailed ? (
                <img
                  ref={imageElementRef}
                  className={`image-viewer-image${imageZoom > 1 ? ' is-zoomed' : ''}`}
                  src={toFileUrl(cachedImage.url)}
                  alt={t('imageMode')}
                  draggable="false"
                  onLoad={(event) => updateCardSize(event.currentTarget)}
                  style={{
                    transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom})`,
                  }}
                  onError={() => {
                    setImageFailed(true)
                    if (hasText) {
                      setActiveContent('text')
                      setFlipRotation(180)
                    }
                  }}
                />
              ) : (
                <p className="drawer-image-error">{t('imageLoadFailed')}</p>
              )}
            </div>
          </div>
          <div className="help-flip-face help-flip-text-face">
            <div
              className="glass help-modal-frame"
              onTouchStart={startTextSwipe}
              onTouchEnd={finishTextSwipe}
              onTouchCancel={() => {
                textSwipeRef.current = null
              }}
            >
              <div className="help-modal-body">
                {hasText ? (
                  <p>{question.explanation}</p>
                ) : imageFailed ? (
                  <p className="drawer-image-error">{t('imageLoadFailed')}</p>
                ) : (
                  <p style={{ color: 'var(--text-dim)' }}>{t('noExplanation')}</p>
                )}
              </div>
            </div>
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
