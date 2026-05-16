export default function PoliticaDePrivacidadePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #eff6ff 0%, #f8fafc 45%, #fefce8 100%)',
        padding: '48px 20px',
        color: '#0f172a',
      }}
    >
      <section
        style={{
          maxWidth: 980,
          margin: '0 auto',
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(148,163,184,0.28)',
          borderRadius: 28,
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '38px 36px',
            background:
              'linear-gradient(135deg, #0f3b78 0%, #1559b7 58%, #f5c542 160%)',
            color: '#fff',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.25)',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            SchoolOS
          </span>

          <h1
            style={{
              margin: '18px 0 10px',
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              lineHeight: 1.05,
              fontWeight: 900,
              letterSpacing: -1,
            }}
          >
            Política de Privacidade
          </h1>

          <p
            style={{
              maxWidth: 720,
              margin: 0,
              color: 'rgba(255,255,255,0.88)',
              fontSize: 17,
              lineHeight: 1.7,
            }}
          >
            Esta política explica como o SchoolOS coleta, utiliza, armazena e
            protege dados pessoais no contexto da gestão educacional.
          </p>

          <p
            style={{
              margin: '18px 0 0',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 14,
            }}
          >
            Última atualização: 16 de maio de 2026
          </p>
        </div>

        <div
          style={{
            padding: '34px 36px 42px',
            display: 'grid',
            gap: 22,
          }}
        >
          <PolicySection title="1. Sobre o SchoolOS">
            O SchoolOS é uma plataforma de gestão escolar voltada para
            instituições de ensino fundamental e médio, oferecendo recursos de
            gestão acadêmica, controle de frequência, comunicação escolar,
            relatórios pedagógicos, lançamento de notas e acompanhamento de
            desempenho.
          </PolicySection>

          <PolicySection title="2. Dados coletados">
            Podemos coletar dados de administradores, gestores, professores,
            alunos e responsáveis, incluindo nome completo, e-mail, telefone,
            turma, vínculo escolar, registros acadêmicos, notas, frequência,
            dados de acesso, ações realizadas na plataforma e informações
            necessárias ao funcionamento do sistema.
          </PolicySection>

          <PolicySection title="3. Dados de alunos e responsáveis">
            Em relação aos alunos, poderão ser tratados dados como nome,
            data de nascimento, turma, frequência, notas, histórico escolar e
            desempenho acadêmico. Em relação aos responsáveis, poderão ser
            tratados nome, e-mail, telefone/WhatsApp, vínculo com o aluno e
            justificativas de faltas com eventuais anexos.
          </PolicySection>

          <PolicySection title="4. Finalidade do uso dos dados">
            Os dados são utilizados para autenticação de usuários, gestão
            escolar, controle acadêmico, registro de presença, comunicação com
            responsáveis, geração de relatórios, segurança da plataforma,
            auditoria e cumprimento de obrigações legais.
          </PolicySection>

          <PolicySection title="5. Compartilhamento de dados">
            O SchoolOS não vende dados pessoais. Os dados poderão ser
            compartilhados apenas com a instituição de ensino vinculada,
            provedores essenciais de infraestrutura, autoridades competentes
            quando exigido por lei ou mediante autorização válida.
          </PolicySection>

          <PolicySection title="6. Segurança e armazenamento">
            Adotamos medidas técnicas e organizacionais para proteger os dados,
            incluindo HTTPS, autenticação segura, controle de acesso por perfil,
            isolamento entre escolas, registros de auditoria e boas práticas de
            segurança da informação.
          </PolicySection>

          <PolicySection title="7. Direitos dos titulares">
            Nos termos da LGPD, o titular dos dados poderá solicitar confirmação
            de tratamento, acesso, correção, anonimização, exclusão,
            portabilidade e revogação de consentimento, conforme aplicável.
          </PolicySection>

          <PolicySection title="8. Contato">
            Para dúvidas relacionadas à privacidade e proteção de dados, entre
            em contato pelos canais oficiais do SchoolOS.
            <br />
            <br />
            Site: <strong>https://schoolosapp.com</strong>
            <br />
            E-mail: <strong>schoolos.dev@gmail.com</strong>
          </PolicySection>
        </div>
      </section>
    </main>
  )
}

function PolicySection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        padding: '24px',
        borderRadius: 22,
        background: '#ffffff',
        border: '1px solid rgba(226,232,240,0.95)',
        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)',
      }}
    >
      <h2
        style={{
          margin: '0 0 10px',
          color: '#0f3b78',
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin: 0,
          color: '#334155',
          fontSize: 16,
          lineHeight: 1.75,
        }}
      >
        {children}
      </p>
    </section>
  )
}