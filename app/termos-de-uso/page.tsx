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
            Termos de Uso
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
            Bem-vindo ao SchoolOS.
Estes Termos de Uso regulam o acesso e utilização da plataforma SchoolOS, destinada à gestão educacional de instituições de ensino.

Ao acessar ou utilizar a plataforma, você concorda integralmente com estes Termos.
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
            O SchoolOS é uma plataforma SaaS de gestão escolar desenvolvida para auxiliar instituições de ensino fundamental e médio em atividades administrativas, acadêmicas e pedagógicas.

A plataforma poderá disponibilizar funcionalidades como:

gestão de alunos;
gestão de professores e gestores;
controle de frequência;
relatórios e dashboards;
comunicação escolar;
envio de atividades;
lançamento de notas;
qr code para presença;
armazenamento de documentos;
notificações escolares.
          </PolicySection>

          <PolicySection title="2. Cadastro e acesso">
            Para utilizar determinadas funcionalidades, o usuário deverá possuir uma conta válida.

O usuário se compromete a:

fornecer informações verdadeiras;
manter seus dados atualizados;
proteger suas credenciais de acesso;
não compartilhar sua conta com terceiros.

O SchoolOS poderá suspender ou encerrar contas em caso de uso indevido, fraude ou violação destes Termos.
          </PolicySection>

          <PolicySection title="3. Responsabilidade da instituição de ensino">
            A instituição de ensino é responsável por:

garantir autorização adequada para tratamento de dados dos alunos;
obter consentimentos necessários quando exigidos por lei;
utilizar a plataforma conforme legislação aplicável;
gerenciar permissões internas de usuários.
          </PolicySection>

          <PolicySection title="4. Planos e assinaturas">
            O SchoolOS poderá disponibilizar planos gratuitos e pagos.

Cada plano poderá possuir:

limites de alunos;
limites de armazenamento;
funcionalidades específicas;
módulos disponíveis conforme contratação.

O não pagamento poderá resultar em:

limitação de funcionalidades;
suspensão temporária;
cancelamento do acesso.
          </PolicySection>

          <PolicySection title="5. Disponibilidade da plataforma">
            O SchoolOS busca manter alta disponibilidade dos serviços, mas não garante funcionamento ininterrupto.

Poderão ocorrer:

manutenções;
atualizações;
indisponibilidades temporárias;
falhas externas de infraestrutura.
          </PolicySection>

          <PolicySection title="6. Condutas proibidas">
            É proibido utilizar o SchoolOS para:

atividades ilegais;
invasões ou tentativas de acesso indevido;
compartilhamento de malware;
fraude;
uso abusivo da infraestrutura;
violação de dados de terceiros.
          </PolicySection>

          <PolicySection title="7. Propriedade intelectual">
            Todos os direitos relacionados ao SchoolOS, incluindo:

marca;
identidade visual;
código-fonte;
interface;
funcionalidades;
documentação;

pertencem ao SchoolOS, salvo quando indicado de forma diversa.

É proibida a reprodução, engenharia reversa ou redistribuição sem autorização.
          </PolicySection>

          <PolicySection title="8. Privacidade e proteção de dados">
            O tratamento de dados pessoais ocorre conforme nossa Política de Privacidade.

Ao utilizar o sistema, o usuário declara estar ciente das práticas descritas na política correspondente.
          </PolicySection>

          <PolicySection title="9. Limitação de responsabilidade">
            O SchoolOS não se responsabiliza por:

uso inadequado da plataforma pela instituição;
informações inseridas por usuários;
decisões pedagógicas ou administrativas tomadas pela escola;
falhas decorrentes de terceiros ou força maior.
          </PolicySection>

          <PolicySection title="10. Encerramento de acesso">
            O SchoolOS poderá limitar, suspender ou encerrar acessos em caso de:

descumprimento destes Termos;
comportamento abusivo;
tentativa de exploração da plataforma;
violação de segurança.
          </PolicySection>

          <PolicySection title="11. Alterações destes Termos">
            Os presentes Termos poderão ser atualizados periodicamente.

O uso continuado da plataforma após alterações representa concordância com a versão atualizada.
          </PolicySection>

          <PolicySection title="12. Legislação aplicável">
            Este documento será regido pelas leis da República Federativa do Brasil, especialmente pela:

Lei Geral de Proteção de Dados (LGPD);
Marco Civil da Internet;
legislação civil aplicável.
          </PolicySection>

          <PolicySection title="13. Contato">
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