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

export async function loadFaceModels() {
  if (modelsLoaded) return

  if (modelsLoadingPromise) {
    return modelsLoadingPromise
  }

  modelsLoadingPromise = (async () => {
    if (typeof window === 'undefined') {
      return
    }

    await loadScript(
      'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
    )

    faceapi = (window as any).faceapi

    if (!faceapi) {
      throw new Error(
        'face-api.js não carregado.'
      )
    }

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(
        '/models'
      ),

      faceapi.nets.faceRecognitionNet.loadFromUri(
        '/models'
      ),

      faceapi.nets.faceLandmark68Net.loadFromUri(
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
  if (imageBlob.size === 0) {
    return null
  }

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

    if (!detection) return null

    const box = detection.detection.box

    const padding = Math.max(box.width, box.height) * 0.35

    const sx = Math.max(0, box.x - padding)
    const sy = Math.max(0, box.y - padding)
    const sw = Math.min(img.width - sx, box.width + padding * 2)
    const sh = Math.min(img.height - sy, box.height + padding * 2)

    const faceCanvas = document.createElement('canvas')
    faceCanvas.width = 224
    faceCanvas.height = 224

    const ctx = faceCanvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 224, 224)

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
      const fallbackDetection = await faceapi
        .detectSingleFace(
          img,
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
  } finally {
    URL.revokeObjectURL(imageUrl)
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