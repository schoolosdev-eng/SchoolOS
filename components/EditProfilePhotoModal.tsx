'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type EditProfilePhotoModalProps = {
  isOpen: boolean
  file: File | null
  onCancel: () => void
  onConfirm: (file: File) => void | Promise<void>
}

type Position = {
  x: number
  y: number
}

type DragState = {
  pointerId: number
  startPointerX: number
  startPointerY: number
  startPositionX: number
  startPositionY: number
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(Math.max(value, min), max)
}

export default function EditProfilePhotoModal(
  props: EditProfilePhotoModalProps
) {
  const cropAreaRef = useRef<HTMLDivElement | null>(null)

  const dragStateRef = useRef<DragState | null>(null)

  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const [imageWidth, setImageWidth] = useState(0)
  const [imageHeight, setImageHeight] = useState(0)

  const [cropSize, setCropSize] = useState(0)

  const [zoom, setZoom] = useState(1)

  const [position, setPosition] = useState<Position>({
    x: 0,
    y: 0,
  })

  const [errorMessage, setErrorMessage] = useState('')

  const [isConfirming, setIsConfirming] = useState(false)

  /*
   * ObjectURL da imagem selecionada.
   */
  useEffect(() => {
    if (!props.isOpen || !props.file) {
      setImageUrl(null)
      setErrorMessage('')
      setImageWidth(0)
      setImageHeight(0)
      setZoom(1)
      setPosition({
        x: 0,
        y: 0,
      })
      setIsConfirming(false)

      return
    }

    const objectUrl = URL.createObjectURL(props.file)

    setImageUrl(objectUrl)
    setErrorMessage('')
    setImageWidth(0)
    setImageHeight(0)
    setZoom(1)
    setPosition({
      x: 0,
      y: 0,
    })

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [props.isOpen, props.file])

  /*
   * Mede o tamanho real da área de recorte.
   *
   * Em desktop ela tende a ficar próxima de 360px.
   * Em telas menores ela se adapta automaticamente.
   */
  useEffect(() => {
    if (!props.isOpen) return

    const cropArea = cropAreaRef.current

    if (!cropArea) return

    function updateCropSize() {
      if (!cropAreaRef.current) return

      const rect =
        cropAreaRef.current.getBoundingClientRect()

      setCropSize(rect.width)
    }

    updateCropSize()

    const observer = new ResizeObserver(() => {
      updateCropSize()
    })

    observer.observe(cropArea)

    return () => {
      observer.disconnect()
    }
  }, [props.isOpen])

  /*
   * Matemática única utilizada para desenhar a imagem.
   *
   * Essa mesma matemática será utilizada no canvas
   * na próxima etapa.
   */
  const imageMetrics = useMemo(() => {
    if (
      cropSize <= 0 ||
      imageWidth <= 0 ||
      imageHeight <= 0
    ) {
      return null
    }

    const baseScale = Math.max(
      cropSize / imageWidth,
      cropSize / imageHeight
    )

    const finalScale = baseScale * zoom

    const drawWidth = imageWidth * finalScale
    const drawHeight = imageHeight * finalScale

    const maxOffsetX = Math.max(
      0,
      (drawWidth - cropSize) / 2
    )

    const maxOffsetY = Math.max(
      0,
      (drawHeight - cropSize) / 2
    )

    return {
      baseScale,
      finalScale,
      drawWidth,
      drawHeight,
      maxOffsetX,
      maxOffsetY,
    }
  }, [
    cropSize,
    imageWidth,
    imageHeight,
    zoom,
  ])

  /*
   * Se o zoom mudar, os limites também mudam.
   *
   * Garantimos que a posição atual continue dentro
   * dos novos limites e nunca apareça área vazia.
   */
  useEffect(() => {
    if (!imageMetrics) return

    setPosition((current) => {
      const nextX = clamp(
        current.x,
        -imageMetrics.maxOffsetX,
        imageMetrics.maxOffsetX
      )

      const nextY = clamp(
        current.y,
        -imageMetrics.maxOffsetY,
        imageMetrics.maxOffsetY
      )

      if (
        nextX === current.x &&
        nextY === current.y
      ) {
        return current
      }

      return {
        x: nextX,
        y: nextY,
      }
    })
  }, [imageMetrics])

  function handleImageLoad(
    event: React.SyntheticEvent<HTMLImageElement>
  ) {
    const image = event.currentTarget

    if (
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      setErrorMessage(
        'Não foi possível carregar esta imagem.'
      )

      return
    }

    setImageWidth(image.naturalWidth)
    setImageHeight(image.naturalHeight)

    setZoom(1)

    setPosition({
      x: 0,
      y: 0,
    })

    setErrorMessage('')
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (!imageMetrics) return

    event.preventDefault()

    event.currentTarget.setPointerCapture(
      event.pointerId
    )

    dragStateRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startPositionX: position.x,
      startPositionY: position.y,
    }
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    const dragState = dragStateRef.current

    if (
      !dragState ||
      dragState.pointerId !== event.pointerId ||
      !imageMetrics
    ) {
      return
    }

    event.preventDefault()

    const deltaX =
      event.clientX - dragState.startPointerX

    const deltaY =
      event.clientY - dragState.startPointerY

    const nextX = clamp(
      dragState.startPositionX + deltaX,
      -imageMetrics.maxOffsetX,
      imageMetrics.maxOffsetX
    )

    const nextY = clamp(
      dragState.startPositionY + deltaY,
      -imageMetrics.maxOffsetY,
      imageMetrics.maxOffsetY
    )

    setPosition({
      x: nextX,
      y: nextY,
    })
  }

  function endPointerInteraction(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    const dragState = dragStateRef.current

    if (
      !dragState ||
      dragState.pointerId !== event.pointerId
    ) {
      return
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      )
    }

    dragStateRef.current = null
  }

  async function createFinalPhotoFile() {
  if (
    !imageUrl ||
    !imageMetrics ||
    cropSize <= 0
  ) {
    throw new Error(
      'A imagem ainda não está pronta para ser processada.'
    )
  }

  const image = new Image()

  image.src = imageUrl

  try {
    await image.decode()
  } catch {
    throw new Error(
      'Não foi possível interpretar a imagem selecionada. Tente escolher outro arquivo.'
    )
  }

  if (
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0
  ) {
    throw new Error(
      'A imagem selecionada possui dimensões inválidas.'
    )
  }

  const outputSize = 512

  const canvas = document.createElement('canvas')

  canvas.width = outputSize
  canvas.height = outputSize

  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error(
      'Não foi possível preparar a imagem para salvar.'
    )
  }

  /*
   * A prévia foi calculada usando cropSize.
   *
   * Agora transformamos todas as medidas da prévia
   * proporcionalmente para o canvas de 512x512.
   */
  const outputRatio =
    outputSize / cropSize

  const finalDrawWidth =
    imageMetrics.drawWidth * outputRatio

  const finalDrawHeight =
    imageMetrics.drawHeight * outputRatio

  const finalPositionX =
    position.x * outputRatio

  const finalPositionY =
    position.y * outputRatio

  /*
   * Assim como na interface, a imagem parte
   * exatamente do centro da área de recorte.
   */
  const finalX =
    outputSize / 2 -
    finalDrawWidth / 2 +
    finalPositionX

  const finalY =
    outputSize / 2 -
    finalDrawHeight / 2 +
    finalPositionY

  ctx.clearRect(
    0,
    0,
    outputSize,
    outputSize
  )

  ctx.drawImage(
    image,
    finalX,
    finalY,
    finalDrawWidth,
    finalDrawHeight
  )

  const blob = await new Promise<Blob | null>(
    (resolve) => {
      canvas.toBlob(
        (result) => {
          resolve(result)
        },
        'image/jpeg',
        0.92
      )
    }
  )

  if (!blob) {
    throw new Error(
      'Não foi possível gerar o arquivo final da foto.'
    )
  }

  return new File(
    [blob],
    `foto-perfil-${Date.now()}.jpg`,
    {
      type: 'image/jpeg',
    }
  )
}

async function handleConfirm() {
  if (isConfirming) return

  try {
    setIsConfirming(true)
    setErrorMessage('')

    const finalFile =
      await createFinalPhotoFile()

    await props.onConfirm(finalFile)
  } catch (error) {
    console.error(
      '[EDIT PROFILE PHOTO] erro ao gerar foto:',
      error
    )

    setErrorMessage(
      error instanceof Error
        ? error.message
        : 'Não foi possível preparar a foto. Tente novamente.'
    )
  } finally {
    setIsConfirming(false)
  }
}

  if (!props.isOpen || !props.file) {
    return null
  }

  return (
    <div
      onClick={props.onCancel}
      style={overlayStyle}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={modalStyle}
      >
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>
              Foto de perfil
            </div>

            <h2 style={titleStyle}>
              Ajustar foto de perfil
            </h2>

            <p style={descriptionStyle}>
              Arraste a foto com o mouse ou dedo e
              ajuste o zoom.
            </p>
          </div>

          <button
            type="button"
            onClick={props.onCancel}
            aria-label="Fechar editor de foto"
            style={closeButtonStyle}
          >
            ✕
          </button>
        </div>

        <div style={cropWrapperStyle}>
          <div
            ref={cropAreaRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointerInteraction}
            onPointerCancel={endPointerInteraction}
            style={{
              ...cropAreaStyle,
              cursor: imageMetrics
                ? 'grab'
                : 'default',
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Foto selecionada"
                draggable={false}
                onLoad={handleImageLoad}
                onError={() => {
                  setErrorMessage(
                    'A imagem selecionada é inválida ou está corrompida.'
                  )
                }}
                style={{
                  ...imageStyle,

                  width: imageMetrics
                    ? imageMetrics.drawWidth
                    : 0,

                  height: imageMetrics
                    ? imageMetrics.drawHeight
                    : 0,

                  transform: `
                    translate(-50%, -50%)
                    translate(
                      ${position.x}px,
                      ${position.y}px
                    )
                  `,
                }}
              />
            ) : (
              <div style={placeholderStyle}>
                Carregando imagem...
              </div>
            )}

            <div style={centerGuideVerticalStyle} />

            <div style={centerGuideHorizontalStyle} />

            <div style={innerGuideStyle} />
          </div>
        </div>

        {errorMessage && (
          <div style={errorStyle}>
            {errorMessage}
          </div>
        )}

        <div style={controlsStyle}>
          <div style={zoomHeaderStyle}>
            <span>Zoom</span>

            <span>
              {zoom.toFixed(2)}x
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            disabled={
              !imageMetrics ||
              Boolean(errorMessage)
            }
            onChange={(event) => {
              setZoom(
                Number(event.target.value)
              )
            }}
            style={rangeStyle}
          />

          <div style={hintStyle}>
            Arraste diretamente a imagem para
            posicioná-la dentro do recorte.
          </div>
        </div>

        <div style={actionsStyle}>
          <button
            type="button"
            onClick={props.onCancel}
            style={cancelButtonStyle}
          >
            Cancelar
          </button>

          <button
  type="button"
  onClick={handleConfirm}
  disabled={
    !imageMetrics ||
    Boolean(errorMessage) ||
    isConfirming
  }
  style={{
    ...confirmButtonStyle,

    opacity:
      !imageMetrics ||
      Boolean(errorMessage) ||
      isConfirming
        ? 0.55
        : 1,

    cursor:
      !imageMetrics ||
      Boolean(errorMessage) ||
      isConfirming
        ? 'not-allowed'
        : 'pointer',
  }}
>
  {isConfirming
    ? 'Preparando foto...'
    : 'Usar esta foto'}
</button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  background: 'rgba(15, 23, 42, 0.62)',
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  maxHeight: '95vh',
  overflowY: 'auto',
  padding: 24,
  borderRadius: 28,
  background: '#ffffff',
  boxShadow:
    '0 30px 90px rgba(15, 23, 42, 0.4)',
  boxSizing: 'border-box',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  marginBottom: 20,
}

const eyebrowStyle: React.CSSProperties = {
  marginBottom: 6,
  color: '#2563eb',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 26,
  fontWeight: 900,
}

const descriptionStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.5,
}

const closeButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  flexShrink: 0,
  border: 'none',
  borderRadius: 14,
  background: '#f1f5f9',
  color: '#334155',
  cursor: 'pointer',
  fontWeight: 900,
}

const cropWrapperStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
}

const cropAreaStyle: React.CSSProperties = {
  position: 'relative',

  width: '100%',
  maxWidth: 360,

  aspectRatio: '1 / 1',

  overflow: 'hidden',

  borderRadius: 20,

  border: '3px solid #2563eb',

  background: '#0f172a',

  boxShadow:
    '0 16px 40px rgba(37, 99, 235, 0.16)',

  touchAction: 'none',

  userSelect: 'none',
}

const imageStyle: React.CSSProperties = {
  position: 'absolute',

  left: '50%',
  top: '50%',

  maxWidth: 'none',

  objectFit: 'fill',

  userSelect: 'none',

  pointerEvents: 'none',
}

const placeholderStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#cbd5e1',
  fontSize: 14,
  fontWeight: 800,
}

const centerGuideVerticalStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: '50%',
  width: 1,
  background:
    'rgba(255, 255, 255, 0.28)',
  pointerEvents: 'none',
}

const centerGuideHorizontalStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  height: 1,
  background:
    'rgba(255, 255, 255, 0.28)',
  pointerEvents: 'none',
}

const innerGuideStyle: React.CSSProperties = {
  position: 'absolute',
  inset: '12%',
  border:
    '1px solid rgba(255, 255, 255, 0.28)',
  borderRadius: '50%',
  pointerEvents: 'none',
}

const errorStyle: React.CSSProperties = {
  marginTop: 14,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 13,
  fontWeight: 800,
}

const controlsStyle: React.CSSProperties = {
  marginTop: 20,
}

const zoomHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 8,
  color: '#334155',
  fontSize: 13,
  fontWeight: 800,
}

const rangeStyle: React.CSSProperties = {
  width: '100%',
}

const hintStyle: React.CSSProperties = {
  marginTop: 8,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 600,
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 22,
  flexWrap: 'wrap',
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '13px 17px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
}

const confirmButtonStyle: React.CSSProperties = {
  padding: '13px 18px',
  borderRadius: 14,
  border: 'none',
  background:
    'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#ffffff',
  fontWeight: 900,
}