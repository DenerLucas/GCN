GESTÃO DE CAMPOS NORTE – AIRSOFT BRAGA
================================================

SPA (HTML + CSS + JavaScript Vanilla) para gestão de jogos de airsoft
na região de Braga, criada para substituir bots de Telegram.
Funciona 100% local (sem backend) através de uma Mock API com localStorage.

------------------------------------------------
FUNCIONALIDADES
------------------------------------------------

JOGADOR
- Ver jogos e vagas
- Estado: Aberto / Lotado / Fechado
- Entrar em jogo (APD obrigatório ou opção Convidado)
- Sair de jogo
- Lista Rápida de inscritos
- Exportar lista em Excel
- Imprimir lista
- Copiar link direto do jogo
- Ficheiro .ics (calendário)
- Abrir localização no mapa

ADMIN
- Criar, editar, abrir/fechar jogos
- Fixar/desafixar jogos
- Eliminar jogos
- Exportar CSV e Excel
- Criar moderadores
- Ver logs de auditoria
- Exportar logs (CSV / Excel)

MODERADOR
- Criar jogos do seu campo
- Editar apenas jogos criados por si
- Abrir/fechar e fixar jogos próprios
- Exportar CSV e Excel
- NÃO pode eliminar jogos
- NÃO pode gerir jogos de outros campos

Sistema desenhado para evitar sabotagem entre campos concorrentes.

------------------------------------------------
CREDENCIAIS PADRÃO (DEMO)
------------------------------------------------

ADMIN
Utilizador: admin
Senha: airsoft2025

MODERADOR (exemplo)
Utilizador: mod_stg
Senha: mod2025
Campo: STG

O Admin pode criar novos moderadores através do menu "Moderadores".

------------------------------------------------
ESTRUTURA DO PROJETO
------------------------------------------------

/index.html   -> Página principal e templates
/styles.css   -> Estilos (tema tático, mobile-first)
/app.js       -> Mock API, lógica, estado e auditoria

------------------------------------------------
COMO EXECUTAR
------------------------------------------------

Opção simples:
- Abrir o ficheiro index.html num browser moderno (Edge recomendado)

Opção com servidor local:
python3 -m http.server 8080
Abrir: http://localhost:8080

Compatível com:
- GitHub Pages
- Netlify
- Vercel
- Servidores estáticos

------------------------------------------------
PERSISTÊNCIA DE DADOS
------------------------------------------------

Os dados são guardados no localStorage:

- airsoft_games_v2        -> jogos e inscrições
- airsoft_users_v1        -> utilizadores (admin/mods)
- airsoft_audit_v1        -> logs de auditoria
- airsoft_user_id         -> ID do jogador
- airsoft_profile_v1      -> nickname/equipa/APD
- airsoft_role            -> role da sessão
- airsoft_name            -> utilizador autenticado
- airsoft_field           -> campo do moderador

Para resetar:
Limpar Local Storage no browser.

------------------------------------------------
LOGS DE AUDITORIA
------------------------------------------------

Regista:
- Login / Logout
- Criação de moderadores
- Criação, edição e eliminação de jogos
- Entradas e saídas de jogadores
- Exportações CSV e Excel

Apenas visível ao ADMIN.

------------------------------------------------
REGRAS DE NEGÓCIO
------------------------------------------------

- Vagas restantes = total - inscritos
- Não permite inscrições duplicadas
- Editar vagas valida inscritos existentes
- Status fechado bloqueia inscrições
- Lotado quando vagas = 0
- Ordenação: Fixados primeiro, depois por data
- Moderador só gere jogos próprios

------------------------------------------------
ROADMAP FUTURO (FASE 2)
------------------------------------------------

- PWA (instalação como app)
- Cache offline real
- Notificações push
- Multi-campo com branding
- Check-in por QR Code
- Estatísticas e relatórios

------------------------------------------------
LICENÇA
------------------------------------------------

Uso interno / demonstração.
Adaptar antes de produção.

------------------------------------------------
CONTACTO (PLACEHOLDER)
------------------------------------------------

airsoft.braga@example.com
