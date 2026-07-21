import { NextResponse } from 'next/server'
import { processWhatsAppQueue } from '@/lib/whatsapp/processWhatsAppQueue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function validateAuthorization(
  request: Request
) {
  const cronSecret =
    process.env.CRON_SECRET

  if (!cronSecret) {
    return {
      valid: false,
      status: 500,
      error:
        'CRON_SECRET não configurado no servidor.',
    }
  }

  const authorization =
    request.headers.get('authorization')

  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {
    return {
      valid: false,
      status: 401,
      error: 'Não autorizado.',
    }
  }

  return {
    valid: true,
    status: 200,
    error: null,
  }
}

async function handleWorkerRequest(
  request: Request
) {
  const authorization =
    validateAuthorization(request)

  if (!authorization.valid) {
    return NextResponse.json(
      {
        error: authorization.error,
      },
      {
        status: authorization.status,
      }
    )
  }

  try {
    const url = new URL(request.url)

    const requestedBatch =
      Number(
        url.searchParams.get('batch') ||
        '10'
      )

    const batchSize =
      Number.isFinite(requestedBatch)
        ? Math.max(
            1,
            Math.min(
              Math.floor(requestedBatch),
              20
            )
          )
        : 10

    const result =
      await processWhatsAppQueue(
        batchSize
      )

    return NextResponse.json({
      success: true,
      ...result,
      processedAt:
        new Date().toISOString(),
    })
  } catch (error) {
    console.error(
      '[WHATSAPP WORKER ROUTE] erro:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao processar fila.',
      },
      {
        status: 500,
      }
    )
  }
}

/*
 * O Vercel Cron chama rotas por GET.
 */
export async function GET(
  request: Request
) {
  return handleWorkerRequest(request)
}

/*
 * POST permite acionamento interno ou
 * teste manual protegido.
 */
export async function POST(
  request: Request
) {
  return handleWorkerRequest(request)
}