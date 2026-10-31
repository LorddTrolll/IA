# Dentim · Cérebro e Obsidian

O banco do Dentim é a fonte oficial dos dados estruturados. O Cérebro consulta esse banco e as notas salvas na aplicação; a recuperação funciona sem API externa. O assistente usa somente os pacientes e campos autorizados para o usuário conectado. Dentistas acessam apenas os pacientes vinculados ao seu perfil; trocar de profissional exige sair e entrar na conta correspondente. A exportação do vault segue as mesmas permissões da sessão.

## Exportação real

Em **Cérebro → Exportar vault**, baixe o ZIP, extraia-o e use **Abrir pasta como vault** no Obsidian. Cada paciente é identificado por ID estável, sem usar seu nome como caminho. O arquivo `Indice.md` conecta as notas de anamnese, odontograma, planejamento, evoluções e retornos. Financeiro só é incluído para perfis autorizados. A recepção recebe apenas dados cadastrais e financeiros autorizados.

A exportação funciona sem disco persistente no Render: o ZIP é gerado a partir dos dados atuais. É uma cópia pontual. Notas editadas no Obsidian não voltam automaticamente ao sistema. Importação com revisão de conflitos e sincronização bidirecional são trabalho futuro; nunca substitua o banco por uma pasta exportada.

Arquivos contêm dados de saúde. Mantenha o vault local protegido ou em sincronização privada. Não o adicione ao repositório público do código.

## Consulta documental e Grok

Sem `XAI_API_KEY`, a aplicação identifica explicitamente os resultados como busca documental local, sem interpretação por IA. Perguntas financeiras são sempre respondidas por cálculo direto em centavos, incluindo vencimentos e pagamentos parciais.

Para habilitar o Grok, configure no servidor:

- `XAI_API_KEY`: chave da sua conta xAI, nunca prefixada com `NEXT_PUBLIC_`.
- `XAI_MODEL`: identificador de um modelo de chat habilitado na conta. Consulte [a documentação oficial da xAI](https://docs.x.ai/docs/models) para os modelos disponíveis.
- Permita conexões HTTPS do backend a `api.x.ai`.

A integração utiliza `POST https://api.x.ai/v1/chat/completions`, autenticação Bearer e mensagens compatíveis com o formato de chat. O modelo é configurável para não depender de um nome de modelo descontinuado. A API tem cobrança própria e não foi validada contra uma conta real sem credenciais.

As fontes são limitadas ao prontuário autorizado e citadas na resposta. Não existe pesquisa externa nesta versão. Documentos recuperados são tratados como dados não confiáveis, não como instruções. O assistente não altera registros nem executa comandos; decisões clínicas permanecem com o profissional.
