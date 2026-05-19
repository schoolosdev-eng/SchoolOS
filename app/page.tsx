'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CSSProperties } from 'react'

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
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <main className="page">
      <header className="header">
  <Link href="/" className="logoLink">
    <img src="/logoteste.png" alt="SchoolOS" className="topLogo" />
  </Link>

  <button
    className="menuButton"
    onClick={() => setMenuOpen((prev) => !prev)}
    aria-label="Abrir menu"
  >
    {menuOpen ? '✕' : '☰'}
  </button>

  <nav className={`nav ${menuOpen ? 'navOpen' : ''}`}>
    <a href="#recursos" style={navLink} onClick={() => setMenuOpen(false)}>
      Recursos
    </a>

    <a href="#funcionalidades" style={navLink} onClick={() => setMenuOpen(false)}>
      Funcionalidades
    </a>

    <a href="#escolas" style={navLink} onClick={() => setMenuOpen(false)}>
      Para escolas
    </a>

    <a
      href="https://wa.me/5588921826192"
      target="_blank"
      style={navLink}
      onClick={() => setMenuOpen(false)}
    >
      Contato
    </a>

    <Link
  href="/login"
  className="school-button school-button-primary school-button-small"
  onClick={() => setMenuOpen(false)}
>
  Entrar
</Link>
  </nav>
</header>

      <section className="hero">
        <div className="heroCard">
          <div className="pill">
            <span>●</span>
            Plataforma Inteligente de Gestão Escolar
          </div>

          <img
            src="/logocompleta3.png"
            alt="SchoolOS Gestão Escolar Inteligente"
            className="mainLogo"
          />

          <p className="heroText">
            A plataforma completa para escolas de ensino fundamental e médio.
            Mais controle, segurança e comunicação em um único ambiente.
          </p>

          <div className="buttons">
            <Link
  href="/login"
  className="school-button school-button-primary school-button-small"
>
              ↪ Entrar na plataforma
            </Link>

            <a
              href="https://wa.me/5588921826192"
              target="_blank"
              rel="noreferrer"
              className="school-button school-button-secondary school-button-large"
            >
              ◉ Falar no WhatsApp
            </a>
          </div>

          <div id="escolas" className="miniGrid">
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

          <div className="legalArea">
            <Link href="/politica-de-privacidade" style={legalLink}>
              🛡️ Política de Privacidade
            </Link>

            <span>|</span>

            <Link href="/termos-de-uso" style={legalLink}>
              📄 Termos de Uso
            </Link>
          </div>
        </div>

        <div id="recursos" className="featuresGrid">
          {features.map((feature) => (
            <div key={feature.title} className="featureCard">
              <div className="featureIcon">{feature.icon}</div>

              <h3>{feature.title}</h3>

              <p>{feature.text}</p>
            </div>
          ))}

          <div id="funcionalidades" className="blueCard">
            <div className="blueIcon">🖥️</div>

            <div>
              <h2>Tudo que sua escola precisa em um só lugar</h2>

              <p>
                Simplifique processos, ganhe tempo e melhore os resultados da
                sua escola.
              </p>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f6f9ff 0%, #eef6ff 48%, #eaf4ff 100%);
          color: #07122f;
        }

        .header {
          min-height: 112px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 7vw;
          background: rgba(255, 255, 255, 0.82);
          border-bottom: 1px solid #dbe7f5;
          backdrop-filter: blur(14px);
        }

        .logoLink {
          text-decoration: none;
          flex-shrink: 0;
        }

        .topLogo {
          width: 100px;
          max-width: 42vw;
          height: auto;
          display: block;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 32px;
          font-size: 16px;
          font-weight: 800;
        }

        .hero {
          max-width: 1440px;
          margin: 0 auto;
          padding: 48px 32px 64px;
          display: grid;
          grid-template-columns: 0.95fr 1fr;
          gap: 28px;
          align-items: stretch;
        }

        .heroCard {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #dbe7f5;
          border-radius: 34px;
          padding: 52px 46px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
        }

        .menuButton {
  display: none;
  width: 46px;
  height: 46px;
  border: 1px solid #cbd8ea;
  border-radius: 14px;
  background: #fff;
  color: #07122f;
  font-size: 24px;
  font-weight: 900;
  cursor: pointer;
}

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: #eaf2ff;
          color: #0f3f9f;
          padding: 10px 18px;
          border-radius: 999px;
          font-weight: 900;
          margin-bottom: 44px;
        }

        .pill span {
          color: #2457e6;
        }

        .mainLogo {
          width: 100%;
          max-width: 520px;
          height: auto;
          display: block;
          margin-bottom: 44px;
        }

        .heroText {
          font-size: 25px;
          line-height: 1.55;
          color: #4f6685;
          max-width: 690px;
          margin: 0;
        }

        .buttons {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 42px;
        }

        .miniGrid {
          margin-top: 42px;
          padding-top: 34px;
          border-top: 1px solid #e2e8f0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 26px;
        }

        .legalArea {
          margin-top: 40px;
          padding-top: 30px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 26px;
          flex-wrap: wrap;
          align-items: center;
        }

        .legalArea span {
          color: #cbd5e1;
        }

        .featuresGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .featureCard {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #dbe7f5;
          border-radius: 26px;
          padding: 30px;
          min-height: 210px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.055);
        }

        .featureIcon {
          width: 66px;
          height: 66px;
          border-radius: 20px;
          background: #eaf2ff;
          color: #2457e6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 31px;
          margin-bottom: 22px;
          font-weight: 900;
        }

        .featureCard h3 {
          margin: 0 0 12px;
          font-size: 22px;
          color: #07122f;
          font-weight: 950;
        }

        .featureCard p {
          margin: 0;
          color: #526987;
          font-size: 17px;
          line-height: 1.55;
        }

        .blueCard {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #2457e6 0%, #0f49d8 100%);
          border-radius: 28px;
          padding: 34px 40px;
          color: #fff;
          min-height: 190px;
          display: grid;
          grid-template-columns: 170px 1fr;
          gap: 30px;
          align-items: center;
          box-shadow: 0 24px 50px rgba(36, 87, 230, 0.28);
        }

        .blueIcon {
          width: 150px;
          height: 110px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 64px;
        }

        .blueCard h2 {
          margin: 0 0 12px;
          font-size: 31px;
          line-height: 1.15;
          font-weight: 950;
        }

        .blueCard p {
          margin: 0;
          font-size: 18px;
          line-height: 1.55;
          opacity: 0.92;
        }

        @media (max-width: 1100px) {
          .header {
            flex-direction: column;
            align-items: center;
          }

          .nav {
            justify-content: center;
            flex-wrap: wrap;
            gap: 16px;
          }

          .hero {
            grid-template-columns: 1fr;
            padding: 34px 22px 52px;
          }

          .heroCard {
            padding: 42px 34px;
          }

          .mainLogo {
            max-width: 460px;
          }
        }

        @media (max-width: 760px) {
          .header {
            min-height: auto;
            padding: 18px 20px;
          }

          .topLogo {
            width: 86px;
          }

          .menuButton {
  display: flex;
  align-items: center;
  justify-content: center;
}

.header {
  flex-direction: row;
  position: relative;
}

.nav {
  position: absolute;
  top: calc(100% + 10px);
  left: 14px;
  right: 14px;
  display: none;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #dbe7f5;
  border-radius: 22px;
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.16);
  z-index: 50;
}

.navOpen {
  display: flex;
}

.nav a {
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}

          .hero {
            padding: 24px 14px 42px;
          }

          .heroCard {
            border-radius: 26px;
            padding: 30px 22px;
          }

          .pill {
            font-size: 13px;
            line-height: 1.35;
            margin-bottom: 28px;
          }

          .mainLogo {
            max-width: 100%;
            margin-bottom: 28px;
          }

          .heroText {
            font-size: 19px;
            line-height: 1.5;
          }

          .buttons {
            flex-direction: column;
            margin-top: 30px;
          }

          .buttons a {
            width: 100%;
            text-align: center;
            box-sizing: border-box;
          }

          .miniGrid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .legalArea {
            flex-direction: column;
            align-items: flex-start;
            gap: 14px;
          }

          .legalArea span {
            display: none;
          }

          .featuresGrid {
            grid-template-columns: 1fr;
          }

          .featureCard {
            min-height: auto;
            padding: 24px;
          }

          .blueCard {
            grid-template-columns: 1fr;
            padding: 28px 24px;
          }

          .blueIcon {
            width: 100%;
            height: 96px;
            font-size: 52px;
          }

          .blueCard h2 {
            font-size: 25px;
          }

          .blueCard p {
            font-size: 16px;
          }
        }
      `}</style>
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

const navLink: CSSProperties = {
  color: '#07122f',
  textDecoration: 'none',
}

const loginTopButton: CSSProperties = {
  background: '#2457e6',
  color: '#fff',
  padding: '15px 24px',
  borderRadius: 15,
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: '0 14px 30px rgba(36, 87, 230, 0.24)',
}

const primaryButton: CSSProperties = {
  background: '#2457e6',
  color: '#fff',
  padding: '18px 28px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 950,
  boxShadow: '0 18px 35px rgba(36, 87, 230, 0.25)',
}

const secondaryButton: CSSProperties = {
  background: '#fff',
  color: '#07122f',
  padding: '18px 28px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 950,
  border: '1px solid #cbd8ea',
}

const legalLink: CSSProperties = {
  color: '#526987',
  textDecoration: 'none',
  fontWeight: 900,
}