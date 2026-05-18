import Link from 'next/link'

const features = [
  {
    icon: '🎓',
    title: 'Gestão de alunos',
    text: 'Cadastros, turmas, matrículas e acompanhamento completo.',
  },
  {
    icon: '▦',
    title: 'Frequência inteligente',
    text: 'Controle diário de presença com QR Code e modo portaria.',
  },
  {
    icon: '📊',
    title: 'Relatórios escolares',
    text: 'Indicadores, rankings e relatórios completos da sua escola.',
  },
  {
    icon: '💬',
    title: 'Comunicação',
    text: 'Envio de avisos e mensagens para responsáveis via WhatsApp.',
  },
  {
    icon: '🛡️',
    title: 'Segurança e confiança',
    text: 'Controle de acesso, proteção de dados e rotina escolar organizada.',
  },
  {
    icon: '👥',
    title: 'Para toda a escola',
    text: 'Alunos, professores, gestores e responsáveis conectados.',
  },
]

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #f6f9ff 0%, #eef6ff 48%, #eaf4ff 100%)',
        color: '#07122f',
      }}
    >
      <header
        style={{
          height: 112,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 7vw',
          background: 'rgba(255,255,255,0.82)',
          borderBottom: '1px solid #dbe7f5',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img
            src="/logoteste.png"
            alt="SchoolOS"
            style={{
              width: 100,
              maxWidth: '42vw',
              height: 'auto',
              display: 'block',
            }}
          />
        </Link>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          <a href="#recursos" style={navLink}>
            Recursos
          </a>
          <a href="#funcionalidades" style={navLink}>
            Funcionalidades
          </a>
          <a href="#escolas" style={navLink}>
            Para escolas
          </a>
          <a href="https://wa.me/5588921826192" target="_blank" style={navLink}>
            Contato
          </a>

          <Link href="/login" style={loginTopButton}>
            Entrar na plataforma
          </Link>
        </nav>
      </header>

      <section
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '48px 32px 64px',
          display: 'grid',
          gridTemplateColumns: '0.95fr 1fr',
          gap: 28,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid #dbe7f5',
            borderRadius: 34,
            padding: '52px 46px',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: '#eaf2ff',
              color: '#0f3f9f',
              padding: '10px 18px',
              borderRadius: 999,
              fontWeight: 900,
              marginBottom: 44,
            }}
          >
            <span style={{ color: '#2457e6' }}>●</span>
            Plataforma Inteligente de Gestão Escolar
          </div>

          <img
            src="/logocompleta3.png"
            alt="SchoolOS Gestão Escolar Inteligente"
            style={{
              width: '100%',
              maxWidth: 520,
              height: 'auto',
              display: 'block',
              marginBottom: 44,
            }}
          />

          <p
            style={{
              fontSize: 25,
              lineHeight: 1.55,
              color: '#4f6685',
              maxWidth: 690,
              margin: 0,
            }}
          >
            A plataforma completa para escolas de ensino fundamental e médio.
            Mais controle, segurança e comunicação em um único ambiente.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginTop: 42,
            }}
          >
            <Link href="/login" style={primaryButton}>
              ↪ Entrar na plataforma
            </Link>

            <a
              href="https://wa.me/5588921826192"
              target="_blank"
              rel="noreferrer"
              style={secondaryButton}
            >
              ◉ Falar no WhatsApp
            </a>
          </div>

          <div
            id="escolas"
            style={{
              marginTop: 42,
              paddingTop: 34,
              borderTop: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 26,
            }}
          >
            <MiniInfo
              icon="🏫"
              title="Gestão completa"
              text="Todos os módulos que sua escola precisa."
            />
            <MiniInfo
              icon="🛡️"
              title="Segurança total"
              text="Dados protegidos com tecnologia de ponta."
            />
          </div>

          <div
            style={{
              marginTop: 40,
              paddingTop: 30,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 26,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Link href="/politica-de-privacidade" style={legalLink}>
              🛡️ Política de Privacidade
            </Link>

            <span style={{ color: '#cbd5e1' }}>|</span>

            <Link href="/termos-de-uso" style={legalLink}>
              📄 Termos de Uso
            </Link>
          </div>
        </div>

        <div
          id="recursos"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 18,
          }}
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #dbe7f5',
                borderRadius: 26,
                padding: 30,
                minHeight: 210,
                boxShadow: '0 18px 45px rgba(15, 23, 42, 0.055)',
              }}
            >
              <div
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 20,
                  background: '#eaf2ff',
                  color: '#2457e6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 31,
                  marginBottom: 22,
                  fontWeight: 900,
                }}
              >
                {feature.icon}
              </div>

              <h3
                style={{
                  margin: '0 0 12px',
                  fontSize: 22,
                  color: '#07122f',
                  fontWeight: 950,
                }}
              >
                {feature.title}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: '#526987',
                  fontSize: 17,
                  lineHeight: 1.55,
                }}
              >
                {feature.text}
              </p>
            </div>
          ))}

          <div
            id="funcionalidades"
            style={{
              gridColumn: '1 / -1',
              background: 'linear-gradient(135deg, #2457e6 0%, #0f49d8 100%)',
              borderRadius: 28,
              padding: '34px 40px',
              color: '#fff',
              minHeight: 190,
              display: 'grid',
              gridTemplateColumns: '170px 1fr',
              gap: 30,
              alignItems: 'center',
              boxShadow: '0 24px 50px rgba(36, 87, 230, 0.28)',
            }}
          >
            <div
              style={{
                width: 150,
                height: 110,
                borderRadius: 22,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 64,
              }}
            >
              🖥️
            </div>

            <div>
              <h2
                style={{
                  margin: '0 0 12px',
                  fontSize: 31,
                  lineHeight: 1.15,
                  fontWeight: 950,
                }}
              >
                Tudo que sua escola precisa em um só lugar
              </h2>

              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  lineHeight: 1.55,
                  opacity: 0.92,
                }}
              >
                Simplifique processos, ganhe tempo e melhore os resultados da
                sua escola.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function MiniInfo({
  icon,
  title,
  text,
}: {
  icon: string
  title: string
  text: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr',
        gap: 18,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: '#eaf2ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        {icon}
      </div>

      <div>
        <strong
          style={{
            display: 'block',
            color: '#07122f',
            fontSize: 17,
            marginBottom: 6,
          }}
        >
          {title}
        </strong>

        <span
          style={{
            color: '#526987',
            fontSize: 15,
            lineHeight: 1.45,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  )
}

const navLink: React.CSSProperties = {
  color: '#07122f',
  textDecoration: 'none',
}

const loginTopButton: React.CSSProperties = {
  background: '#2457e6',
  color: '#fff',
  padding: '17px 28px',
  borderRadius: 15,
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: '0 14px 30px rgba(36, 87, 230, 0.24)',
}

const primaryButton: React.CSSProperties = {
  background: '#2457e6',
  color: '#fff',
  padding: '18px 28px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 950,
  boxShadow: '0 18px 35px rgba(36, 87, 230, 0.25)',
}

const secondaryButton: React.CSSProperties = {
  background: '#fff',
  color: '#07122f',
  padding: '18px 28px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 950,
  border: '1px solid #cbd8ea',
}

const legalLink: React.CSSProperties = {
  color: '#526987',
  textDecoration: 'none',
  fontWeight: 900,
}