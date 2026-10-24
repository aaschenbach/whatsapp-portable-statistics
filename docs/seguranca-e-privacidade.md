# Segurança e privacidade

## O que é sensível

| Item | Por quê | Cuidado |
|---|---|---|
| O backup, a chave de 64 dígitos, `msgstore.db`, `wa.db`, `Media/` e a saída do viewer (`pendrive/`) | contêm conversas **em texto aberto** | siga o [capítulo de segurança do viewer](https://github.com/aaschenbach/whatsapp-portable-viewer/blob/main/docs/seguranca-e-privacidade.md); nunca publique |
| `dados/estatisticas.js` | **não** tem nomes, telefones nem texto, mas tem **datas e horários** de cada mensagem e ligação, tipo de mídia, direção e marcações | trate como dado interno; veja abaixo antes de publicar |
| Exportações (PDF, CSV, XLSX) | só números e rótulos de período; sem nomes, telefones nem texto | confira antes de enviar, mesmo assim |
| Prints do painel | mostram os seus números reais | para documentação, use a demonstração fictícia (`demo/`) |

## Este projeto não envia seus dados

Tudo roda **no seu computador**. O script de preparação e o painel não enviam nada para a internet; o painel não carrega nada de fora
(o Chart.js vem junto, em `stats/lib/`). A internet só é usada, se for o caso, para o `uv` baixar o Python na primeira vez.
Você pode conferir lendo `scripts/anonimizar.py`, `preparar-dados.ps1` e `preparar-dados.sh`.

## O que "anonimizado" significa aqui

O arquivo gerado **não contém identificadores diretos**: nomes, telefones, ids originais das conversas e texto das mensagens. Mas ele
guarda, para cada conversa (renumerada), a sequência de datas e horários. Isso **não é à prova de reidentificação**: quem conhecer o
contexto (por exemplo, o horário exato em que alguém escreveu) pode reconhecer uma conversa. Considere o arquivo **pseudonimizado**, não
anônimo, no sentido da LGPD, e proteja-o de acordo.

## Antes de publicar qualquer coisa no GitHub ou num site

- Nunca versione: `dados/estatisticas.js`, `pendrive/`, `Media/`, `msgstore.db*`, `wa.db*`, `*.crypt15`, `encrypted_backup.key`, `*.vcf`,
  `contatos*.csv`, `logs/`. O `.gitignore` deste repositório já cobre isso, mas **confira o `git status`** antes de cada commit.
- Para publicar o painel como site, publique **apenas** as páginas e a pasta `stats/`, sem `dados/estatisticas.js`, ou use dados fictícios.
  Publicar o arquivo de dados expõe a atividade (datas e horários) da sua operação.
- Em prints e exemplos, use somente os dados fictícios da pasta `demo/`.

## Conversas têm dados de outras pessoas

Mesmo sem nomes, as estatísticas descrevem a atividade de pessoas reais (clientes, contatos, familiares). No Brasil, a **LGPD** (Lei
13.709/2018) se aplica a dados pessoais. Se o backup tem conversas **de trabalho ou de clientes**, avalie a base legal, o prazo de guarda e
quem pode ter acesso. Este projeto é uma ferramenta; a responsabilidade pelo uso dos dados é de quem o usa. Use apenas **os seus próprios
backups**, em aparelhos e contas que você tem direito de acessar.
