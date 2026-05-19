'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const modules = [
  {
    title: 'Painel principal',
    description: 'Visão geral da escola, atalhos rápidos e acompanhamento dos principais indicadores.',
    image: '/modulos/dashboard.png',
  },
  {
    title: 'Presença por QR Code',
    description: 'Cadastro, fotos, dados escolares, turmas, responsáveis e organização dos estudantes.',
    image: '/modulos/alunos.png',
  },
  {
    title: 'Rankings de Presença',
    description: 'Registro de presença, leitura por QR Code, relatórios e acompanhamento diário.',
    image: '/modulos/frequencia.png',
  },
  {
    title: 'Relatórios profissionais',
    description: 'Dashboards de frequência, rankings, filtros por turma e impressão de relatórios.',
    image: '/modulos/relatorios.png',
  },
  {
    title: 'Turmas e atividades',
    description: 'Organização das turmas, atividades anexadas, professores vinculados e acompanhamento pedagógico.',
    image: '/modulos/turmas.png',
  },
  {
    title: 'Ocorrências e comunicação',
    description: 'Registro de ocorrências, avisos escolares e integração com WhatsApp para responsáveis.',
    image: '/modulos/ocorrencias.png',
  },
]

export default function Home() {

  const [windowWidth, setWindowWidth] = useState(1200)

  useEffect(() => {
    const updateWidth = () => setWindowWidth(window.innerWidth)

    updateWidth()
    window.addEventListener('resize', updateWidth)

    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const isMobile = windowWidth < 768
  const isTablet = windowWidth >= 768 && windowWidth < 1024

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #e0f2fe 100%)',
        color: '#0f172a',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <section
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0px 20px 70px',
        }}
      >
        <header
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 54,
  }}
>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <img
      src="/logocompleta5.png"
      alt="SchoolOS"
      style={{
        height: 220,
        width: 'auto',
        objectFit: 'contain',
      }}
    />
  </div>

          <Link
            href="/login"
            style={{
              textDecoration: 'none',
              background: '#0f172a',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 14,
              boxShadow: '0 16px 35px rgba(15, 23, 42, 0.25)',
            }}
          >
            Acessar sistema
          </Link>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            alignItems: 'center',
            gap: 36,
            marginBottom: 72,
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-flex',
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(37, 99, 235, 0.10)',
                color: '#1d4ed8',
                fontWeight: 800,
                fontSize: 13,
                marginBottom: 18,
              }}
            >
              Ferramenta escolar moderna e integrada
            </span>

            <h1
              style={{
                fontSize: 'clamp(38px, 6vw, 68px)',
                lineHeight: 1,
                letterSpacing: -2.6,
                margin: '0 0 20px',
                color: '#0f172a',
              }}
            >
              Tudo que sua escola precisa em um só painel.
            </h1>

            <p
              style={{
                fontSize: 18,
                lineHeight: 1.7,
                color: '#475569',
                maxWidth: 580,
                margin: '0 0 28px',
              }}
            >
              Organize alunos, professores, turmas, frequência, ocorrências,
              atividades e relatórios com uma experiência simples, bonita e
              preparada para o dia a dia da gestão escolar.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                href="/login"
                style={{
                  textDecoration: 'none',
                  background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                  color: '#fff',
                  padding: '15px 22px',
                  borderRadius: 16,
                  fontWeight: 900,
                  boxShadow: '0 18px 40px rgba(37, 99, 235, 0.30)',
                }}
              >
                Começar agora
              </Link>

              <a
                href="#modulos"
                style={{
                  textDecoration: 'none',
                  background: 'rgba(255,255,255,0.80)',
                  color: '#0f172a',
                  padding: '15px 22px',
                  borderRadius: 16,
                  fontWeight: 900,
                  border: '1px solid rgba(148,163,184,0.35)',
                }}
              >
                Ver módulos
              </a>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.78)',
              border: '1px solid rgba(148,163,184,0.28)',
              borderRadius: 30,
              padding: 14,
              boxShadow: '0 30px 80px rgba(15, 23, 42, 0.16)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <Image
              src="/modulos/dashboard2.png"
              alt="Painel principal do SchoolOS"
              width={900}
              height={560}
              priority
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: 22,
                display: 'block',
              }}
            />
          </div>
        </section>

        <section id="modulos">
          <div style={{ textAlign: 'center', marginBottom: 34 }}>
            <h2
              style={{
                fontSize: 'clamp(30px, 4vw, 46px)',
                letterSpacing: -1.4,
                margin: 0,
              }}
            >
              Veja por dentro os módulos da aplicação
            </h2>

            <p
              style={{
                color: '#64748b',
                fontSize: 17,
                lineHeight: 1.6,
                maxWidth: 720,
                margin: '14px auto 0',
              }}
            >
              Uma experiência visual pensada para gestores, professores,
              responsáveis e equipes escolares.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 22,
            }}
          >
            {modules.map((module) => (
              <article
                key={module.title}
                style={{
                  background: 'rgba(255,255,255,0.82)',
                  border: '1px solid rgba(148,163,184,0.28)',
                  borderRadius: 26,
                  overflow: 'hidden',
                  boxShadow: '0 22px 55px rgba(15, 23, 42, 0.10)',
                }}
              >
                <div
                  style={{
                    padding: 10,
                    background:
                      'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(6,182,212,0.10))',
                  }}
                >
                  <Image
                    src={module.image}
                    alt={module.title}
                    width={900}
                    height={560}
                    style={{
                      width: '100%',
                      height: 220,
                      objectFit: 'cover',
                      borderRadius: 20,
                      display: 'block',
                    }}
                  />
                </div>

                <div style={{ padding: 22 }}>
                  <h3
                    style={{
                      margin: '0 0 10px',
                      fontSize: 22,
                      letterSpacing: -0.5,
                      color: '#0f172a',
                    }}
                  >
                    {module.title}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: '#64748b',
                      lineHeight: 1.6,
                      fontSize: 15.5,
                    }}
                  >
                    {module.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 70,
            padding: 34,
            borderRadius: 30,
            background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
            color: '#fff',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            alignItems: 'center',
            gap: 24,
            boxShadow: '0 28px 70px rgba(15, 23, 42, 0.28)',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 'clamp(28px, 4vw, 42px)',
                margin: '0 0 12px',
                letterSpacing: -1.2,
              }}
            >
              Pronto para modernizar sua escola?
            </h2>

            <p
              style={{
                margin: 0,
                color: '#dbeafe',
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              Centralize a gestão escolar e acompanhe tudo com mais clareza,
              segurança e organização.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <Link
              href="/login"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                background: '#fff',
                color: '#1d4ed8',
                padding: '15px 24px',
                borderRadius: 16,
                fontWeight: 900,
              }}
            >
              Criar escola
            </Link>
          </div>
        </section>
      </section>
      <a
        href="https://wa.me/5588921826192?text=Olá!%20Tenho%20dúvidas%20sobre%20o%20SchoolOS."
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          left: isMobile ? 16 : 24,
          bottom: isMobile ? 16 : 24,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: isMobile ? 280 : 360,
          padding: isMobile ? '12px 14px' : '14px 18px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, #25D366, #16a34a)',
          color: '#ffffff',
          textDecoration: 'none',
          boxShadow: '0 18px 40px rgba(37, 211, 102, 0.35)',
          border: '1px solid rgba(255,255,255,0.25)',
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          <svg
  xmlns="http://www.w3.org/2000/svg"
  width="22"
  height="22"
  viewBox="0 0 24 24"
  fill="currentColor"
>
  <path d="M20.52 3.48A11.78 11.78 0 0012.04 0C5.52 0 .24 5.28.24 11.76c0 2.08.56 4.12 1.6 5.92L0 24l6.52-1.72a11.8 11.8 0 005.52 1.4h.04c6.48 0 11.76-5.28 11.76-11.76 0-3.12-1.2-6.04-3.32-8.44zm-8.48 18.2a9.8 9.8 0 01-5-1.36l-.36-.2-3.88 1.04 1.04-3.8-.24-.4a9.78 9.78 0 01-1.52-5.2c0-5.4 4.4-9.8 9.84-9.8 2.6 0 5.08 1 6.92 2.88a9.7 9.7 0 012.88 6.92c0 5.44-4.4 9.84-9.84 9.84zm5.4-7.36c-.28-.16-1.68-.84-1.92-.92-.28-.12-.44-.16-.64.16-.2.28-.72.92-.88 1.12-.16.2-.32.24-.6.08-.28-.16-1.16-.44-2.2-1.4-.8-.72-1.36-1.64-1.52-1.92-.16-.28-.04-.44.12-.6.12-.12.28-.32.4-.48.12-.16.16-.28.24-.48.08-.16.04-.36-.04-.52-.08-.16-.64-1.56-.88-2.12-.24-.6-.48-.52-.64-.52h-.56c-.2 0-.52.08-.8.36-.28.28-1.04 1-.96 2.4.08 1.4 1 2.76 1.16 2.96.16.2 2 3.08 4.88 4.2.68.28 1.24.44 1.68.56.72.24 1.36.2 1.88.12.56-.08 1.68-.68 1.92-1.36.24-.64.24-1.24.16-1.36-.08-.08-.24-.16-.52-.28z"/>
</svg>
        </span>

        <span style={{ fontSize: isMobile ? 12 : 14, lineHeight: 1.35 }}>
          Alguma dúvida? Clique aqui. Nossa meta é te ajudar!
        </span>
      </a>
    </main>
  )
}