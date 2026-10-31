# Validação da primeira versão

Executada em 31/10/2026, com Node.js 24, SQLite local e dados fictícios.

| Verificação            | Resultado                           |
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
