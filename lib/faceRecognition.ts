let faceapi: any = null
let modelsLoaded = false

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

  if (typeof window === 'undefined') return

  await loadScript(
    'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
  )

  faceapi = (window as any).faceapi

  if (!faceapi) {
    throw new Error('face-api.js não carregado.')
  }

  await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models')

  modelsLoaded = true
}

export async function generateFaceEmbeddingFromBlob(
  imageBlob: Blob
): Promise<number[] | null> {
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
          inputSize: 320,
          scoreThreshold: 0.5,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) return null

    return Array.from(detection.descriptor)
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