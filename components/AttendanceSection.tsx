type Result = {
  status: 'success' | 'duplicate' | 'error'
  message: string
  student?: {
    name: string
    className: string
    photo: string | null
  }
  time?: string
}

type RecentScan = {
  id: string
  status: 'success' | 'duplicate' | 'error'
  message: string
  studentName?: string
  className?: string
  photo?: string | null
  time: string
}

type AttendanceSectionProps = {
  result: Result | null
  recentScans?: RecentScan[]
  children: React.ReactNode
}

export default function AttendanceSection({
  result,
  recentScans = [],
  children,
}: AttendanceSectionProps) {
  const resultBg =
    result?.status === 'success'
      ? '#dcfce7'
      : result?.status === 'duplicate'
      ? '#fef3c7'
      : result?.status === 'error'
      ? '#fee2e2'
      : '#ffffff'

  return (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}
  >
    {/* RESULTADO PRINCIPAL */}
    {result && (
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          border: '1px solid',
          background:
            result.status === 'success'
              ? '#dcfce7'
              : result.status === 'duplicate'
              ? '#fef3c7'
              : '#fee2e2',
          borderColor:
            result.status === 'success'
              ? '#86efac'
              : result.status === 'duplicate'
              ? '#fde68a'
              : '#fecaca',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
        }}
      >
        {result.student?.photo && (
          <img
            src={result.student.photo}
            alt="Aluno"
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              objectFit: 'cover',
            }}
          />
        )}

        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#0f172a',
            }}
          >
            {result.student?.name || 'Leitura'}
          </div>

          <div style={{ fontSize: 14, color: '#334155' }}>
            {result.student?.className}
          </div>

          <div
            style={{
              marginTop: 6,
              fontWeight: 700,
              color:
                result.status === 'success'
                  ? '#15803d'
                  : result.status === 'duplicate'
                  ? '#b45309'
                  : '#b91c1c',
            }}
          >
            {result.message}
          </div>

          {result.time && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {result.time}
            </div>
          )}
        </div>
      </div>
    )}

    {/* SCANNER / CHILDREN */}
    <div
      style={{
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        padding: 16,
        background: '#ffffff',
      }}
    >
      {children}
    </div>

    {/* HISTÓRICO */}
    <div
      style={{
        borderRadius: 24,
        border: '1px solid #e2e8f0',
        background: 'rgba(255,255,255,0.94)',
        padding: 20,
      }}
    >
      <h3
        style={{
          margin: 0,
          marginBottom: 14,
          fontSize: 20,
          fontWeight: 900,
          color: '#0f172a',
        }}
      >
        Últimas leituras
      </h3>

      {recentScans.length === 0 ? (
        <div style={{ color: '#64748b' }}>
          Nenhuma leitura realizada ainda.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {recentScans.map((scan) => (
            <div
              key={scan.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              {scan.photo && (
                <img
                  src={scan.photo}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    objectFit: 'cover',
                  }}
                />
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>
                  {scan.studentName || 'Leitura'}
                </div>

                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {scan.className}
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    scan.status === 'success'
                      ? '#16a34a'
                      : scan.status === 'duplicate'
                      ? '#b45309'
                      : '#dc2626',
                }}
              >
                {scan.time}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)
}