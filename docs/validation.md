# Dentim · Validação

## Revisão atual: nome Dentim e acesso individual

A revisão atual adiciona login separado por profissional, cadastro pendente de aprovação, encerramento de sessão e painel identificado pelo nome do usuário conectado. A demonstração usa contas fictícias; a autenticação de produção permanece no Supabase.

Verificação executada em 31/10/2026 com Node.js 24, SQLite local, dados fictícios e Chromium. Esta revisão foi validada após as mudanças de autenticação; os resultados anteriores são mantidos separadamente como histórico. A cobertura inclui:

- Bloqueio de APIs clínicas sem sessão válida e recusa de credenciais incorretas.
- Login da administradora e do dentista, mostrando seus nomes completos no painel.
- Isolamento de pacientes e financeiro conforme o perfil, inclusive no Cérebro e no ZIP do Obsidian.
- Cadastro local pendente, aprovação em **Equipe** e primeiro acesso autorizado.
- Bloqueio de usuário suspenso, expiração da sessão e revogação após **Sair**.
- Persistência das credenciais e sessões locais sem armazenar senhas ou tokens de sessão em texto simples.
- Continuidade da jornada clínica, financeira e da navegação mobile.

| Verificação desta revisão | Resultado                                                  |
| ------------------------- | ---------------------------------------------------------- |
| `npm run typecheck`       | Passou                                                     |
| `npm run build`           | Passou, build de produção Next.js                          |
| `npm test`                | 33 testes passaram, incluindo 8 de autenticação local      |
| `npm run test:e2e`        | 9 testes passaram: 6 de regressão e 3 de acesso individual |

A jornada de navegador confirmou o nome completo da administradora, do dentista e de uma conta recém-aprovada no título do painel. Também verificou recusa de senha incorreta, bloqueio sem sessão, saída da conta, isolamento dos pacientes, cadastro pendente, aprovação pela interface **Equipe** e suspensão de uma sessão existente. As verificações locais não comprovam a integração Supabase em produção.

## Histórico: primeira versão

Executada em 31/10/2026, com Node.js 24, SQLite local e dados fictícios, **antes** da introdução do login individual na demonstração.

| Verificação            | Resultado anterior                  |
| ---------------------- | ----------------------------------- |
| `npm run typecheck`    | Passou                              |
| `npm run build`        | Passou, build otimizado Next.js     |
| `npm test`             | 25 testes passaram, nenhum ignorado |
| `npm run test:e2e`     | 6 testes passaram, nenhum ignorado  |
| `npm run format:check` | Passou                              |

Os testes de navegador usaram Chromium e o build de produção iniciado com `DEMO_MODE=true npm start`, sem configurar `APP_URL` local. A suíte verificou cadastro e persistência de pacientes, anamnese, odontograma permanente/misto e face, planejamento, evolução, notas, exportação ZIP do vault, agenda e confirmação, cobrança, pagamento parcial e saldo, despesas, CSV, aprovação de profissional, busca global, assistente documental e navegação mobile sem overflow horizontal.

Os testes de domínio também verificaram isolamento de pacientes por profissional, bloqueio de informações clínicas para recepção, restrições financeiras, aprovação, prevenção de pagamento duplicado/excedente, conflito de agenda, controle de concorrência, datas e validação da origem HTTP.

## Ainda não validado externamente

- Migração SQL executada em um projeto Supabase real.
- Cadastro, confirmação de e-mail e login Supabase em produção.
- Respostas da API xAI com uma chave e um modelo habilitados.
- Deploy no Render e restauração de backups.

Esses serviços não foram provisionados nem publicados nesta sessão. As instruções e configurações estão no README. A exportação Obsidian foi validada como ZIP com arquivos Markdown; não existe sincronização bidirecional ou importação nesta versão.
