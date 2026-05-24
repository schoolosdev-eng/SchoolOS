let faceapi: any = null

let modelsLoaded = false

export async function loadFaceModels() {
  if (modelsLoaded) return

  if (typeof window === 'undefined') {
    return
  }

  if (!faceapi) {
    faceapi = await import('face-api.js')
  }

  await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models')

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

    const detection = await (
  faceapi.detectSingleFace(
    img,
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    })
  ) as any
).withFaceDescriptor()

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