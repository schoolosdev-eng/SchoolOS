let faceapi: any = null
let modelsLoaded = false
let modelsLoadingPromise: Promise<void> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Erro ao carregar ${src}`))

    document.body.appendChild(script)
  })
}

function getFaceApiBackendDecision() {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined'
  ) {
    return {
      backend: 'webgl' as const,
      reason: 'server_or_unknown',
    }
  }

  const platform =
    (navigator.platform || '')
      .toLowerCase()

  const userAgent =
    (navigator.userAgent || '')
      .toLowerCase()

  const touchPoints =
    navigator.maxTouchPoints || 0

  const screenWidth =
    window.screen.width || 0

  const screenHeight =
    window.screen.height || 0

  const minScreenDimension =
    Math.min(
      screenWidth,
      screenHeight
    )

  /*
   * Tablet ou dispositivo grande
   * controlado por toque.
   *
   * Em celulares, normalmente a menor
   * dimensão fica abaixo de 600.
   */
  const isLargeTouchDevice =
    touchPoints > 0 &&
    minScreenDimension >= 600

  const isAndroid =
    userAgent.includes('android')

  /*
   * Alguns tablets Android em modo
   * desktop podem esconder "Android"
   * no User Agent.
   *
   * O Galaxy Tab pode aparecer como
   * Linux ARM.
   */
  const isArmLinux =
    platform.includes('linux') &&
    (
      platform.includes('arm') ||
      platform.includes('aarch')
    )

  /*
   * CPU para tablets Android / ARM
   * grandes controlados por toque.
   */
  if (
    isLargeTouchDevice &&
    (
      isAndroid ||
      isArmLinux
    )
  ) {
    return {
      backend: 'cpu' as const,

      reason:
        isAndroid
          ? 'large_android_touch_device'
          : 'large_arm_linux_touch_device',
    }
  }

  /*
   * Celulares, notebooks e desktops
   * continuam com WebGL.
   */
  return {
    backend: 'webgl' as const,
    reason: 'default_webgl',
  }
}

export async function loadFaceModels() {
  if (modelsLoaded) return

  if (modelsLoadingPromise) {
    return modelsLoadingPromise
  }

  modelsLoadingPromise = (async () => {
    if (
      typeof window ===
      'undefined'
    ) {
      return
    }

    await loadScript(
      'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
    )

    faceapi =
      (window as any).faceapi

    if (!faceapi) {
      throw new Error(
        'face-api.js não carregado.'
      )
    }

    const initialBackend =
  typeof faceapi.tf?.getBackend ===
    'function'
    ? faceapi.tf.getBackend()
    : null

const backendDecision =
  getFaceApiBackendDecision()

const preferredBackend =
  backendDecision.backend

console.log(
  '[FACE API] decisão de backend:',
  {
    initialBackend,
    preferredBackend,
    reason:
      backendDecision.reason,

    platform:
      navigator.platform ||
      null,

    userAgent:
      navigator.userAgent ||
      null,

    touchPoints:
      navigator.maxTouchPoints ||
      0,

    screenWidth:
      window.screen.width,

    screenHeight:
      window.screen.height,
  }
)

if (faceapi.tf) {

  const backendSet =
    await faceapi.tf.setBackend(
      preferredBackend
    )

  await faceapi.tf.ready()

  const activeBackend =
    typeof faceapi.tf.getBackend ===
      'function'
      ? faceapi.tf.getBackend()
      : null

  console.log(
    '[FACE API] backend selecionado:',
    {
      requestedBackend:
        preferredBackend,

      activeBackend,

      backendSet:
        Boolean(backendSet),

      reason:
        backendDecision.reason,
    }
  )

  if (
    activeBackend !==
    preferredBackend
  ) {
    throw new Error(
      `Não foi possível ativar o backend ${preferredBackend} do face-api. Backend atual: ${
        activeBackend ||
        'desconhecido'
      }.`
    )
  }
}

    await Promise.all([
      faceapi.nets
        .tinyFaceDetector
        .loadFromUri(
          '/models'
        ),

      faceapi.nets
        .faceRecognitionNet
        .loadFromUri(
          '/models'
        ),

      faceapi.nets
        .faceLandmark68Net
        .loadFromUri(
          '/models'
        ),
    ])

    modelsLoaded = true

    console.log(
      '[FACE API] modelos carregados com sucesso'
    )
  })()

  try {
    await modelsLoadingPromise
  } finally {
    modelsLoadingPromise = null
  }
}

export async function generateFaceEmbeddingFromBlob(
  imageBlob: Blob
): Promise<number[] | null> {
  if (
    !imageBlob ||
    imageBlob.size === 0
  ) {
    return null
  }

  await loadFaceModels()

  const imageCanvas =
    await createCanvasFromBlob(
      imageBlob
    )

  console.log(
    '[FACE API] iniciando detecção:',
    {
      width:
        imageCanvas.width,
      height:
        imageCanvas.height,
    }
  )

    const detection =
  await faceapi
    .detectSingleFace(
      imageCanvas,
      new faceapi
        .TinyFaceDetectorOptions(
          {
            inputSize: 416,
            scoreThreshold:
              0.4,
          }
        )
    )
    .withFaceLandmarks()

    if (!detection) return null

    const box = detection.detection.box

    const padding = Math.max(box.width, box.height) * 0.35

    const sx = Math.max(0, box.x - padding)
    const sy = Math.max(0, box.y - padding)
    const sw =
  Math.min(
    imageCanvas.width - sx,
    box.width +
      padding * 2
  )

const sh =
  Math.min(
    imageCanvas.height - sy,
    box.height +
      padding * 2
  )

    const faceCanvas = document.createElement('canvas')
    faceCanvas.width = 224
    faceCanvas.height = 224

    const ctx = faceCanvas.getContext('2d')
    if (!ctx) return null

    if (
  sw <= 0 ||
  sh <= 0
) {
  console.error(
    '[FACE API] recorte facial inválido:',
    {
      sx,
      sy,
      sw,
      sh,
      imageWidth:
        imageCanvas.width,
      imageHeight:
        imageCanvas.height,
    }
  )

  return null
}

    ctx.drawImage(
  imageCanvas,
  sx,
  sy,
  sw,
  sh,
  0,
  0,
  224,
  224
)

    const refinedDetection = await faceapi
      .detectSingleFace(
        faceCanvas,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.25,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!refinedDetection) {
      const fallbackDetection =
  await faceapi
    .detectSingleFace(
      imageCanvas,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.4,
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!fallbackDetection) return null

      return Array.from(fallbackDetection.descriptor)
    }

    return Array.from(refinedDetection.descriptor)

}

async function createCanvasFromBlob(
  imageBlob: Blob
): Promise<HTMLCanvasElement> {
  if (!imageBlob || imageBlob.size === 0) {
    throw new Error(
      'Blob de imagem vazio.'
    )
  }

  const imageUrl =
    URL.createObjectURL(imageBlob)

  try {
    const image =
      new Image()

    image.src =
      imageUrl

    /*
     * Primeiro tentamos decode().
     *
     * Em alguns navegadores Android o evento
     * load pode ocorrer antes de todas as
     * propriedades da imagem estarem prontas
     * para determinadas bibliotecas.
     */
    if (
      typeof image.decode ===
      'function'
    ) {
      try {
        await image.decode()
      } catch {
        /*
         * O fallback abaixo aguardará onload.
         */
      }
    }

    if (
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      await new Promise<void>(
        (resolve, reject) => {
          image.onload = () =>
            resolve()

          image.onerror = () =>
            reject(
              new Error(
                'Não foi possível decodificar a imagem facial.'
              )
            )
        }
      )
    }

    const width =
      image.naturalWidth

    const height =
      image.naturalHeight

    console.log(
      '[FACE API] imagem decodificada:',
      {
        width,
        height,
        blobSize:
          imageBlob.size,
      }
    )

    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new Error(
        `Imagem facial possui dimensões inválidas: ${width}x${height}.`
      )
    }

    const canvas =
      document.createElement(
        'canvas'
      )

    canvas.width =
      width

    canvas.height =
      height

    const ctx =
      canvas.getContext(
        '2d',
        {
          willReadFrequently:
            true,
        }
      )

    if (!ctx) {
      throw new Error(
        'Não foi possível criar o canvas facial.'
      )
    }

    ctx.drawImage(
      image,
      0,
      0,
      width,
      height
    )

    console.log(
      '[FACE API] canvas preparado:',
      {
        width:
          canvas.width,
        height:
          canvas.height,
      }
    )

    return canvas
  } finally {
    URL.revokeObjectURL(
      imageUrl
    )
  }
}

export function calculateFaceDistance(a: number[], b: number[]) {
  if (a.length !== b.length) return Infinity

  let sum = 0

  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }

  return Math.sqrt(sum)
}

export async function calculateFaceQuality(
  imageBlob: Blob
): Promise<number> {
  await loadFaceModels()

  const imageUrl = URL.createObjectURL(imageBlob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()

      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = imageUrl
    })

    const detection = await faceapi
      .detectSingleFace(
        img,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.4,
        })
      )
      .withFaceLandmarks()

    if (!detection) {
      return 0
    }

    const box = detection.detection.box

    let score = 0

    // confiança da detecção
    score += detection.detection.score * 40

    // tamanho do rosto
    const faceArea = box.width * box.height
    const imageArea = img.width * img.height

    const faceRatio = faceArea / imageArea

    score += Math.min(faceRatio * 300, 30)

    // centralização
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    const offsetX = Math.abs(centerX - img.width / 2)
    const offsetY = Math.abs(centerY - img.height / 2)

    const normalizedOffset =
      (offsetX / img.width + offsetY / img.height) / 2

    score += Math.max(0, 20 - normalizedOffset * 40)

    return Math.round(score)
  } catch {
    return 0
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}