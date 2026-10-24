# 4. Problemas comuns

## "Nenhum dado carregado" ao abrir o painel

O arquivo `dados/estatisticas.js` não existe (ou foi apagado). Rode `preparar-dados` (veja o [capítulo 1](01-preparar-os-dados.md)) e
recarregue a página.

## "Nao encontrei data\chats.js em ..."

Você informou a pasta errada. Informe **a pasta que contém a subpasta `data`** (normalmente `pendrive`), não a `data` em si nem a `Media`.
Se o viewer ainda não foi gerado, comece pelo [guia do viewer](https://github.com/aaschenbach/whatsapp-portable-viewer).

## "Nao encontrei o uv nem o Python 3"

Instale o [`uv`](https://docs.astral.sh/uv/) (no Windows: `winget install astral-sh.uv`) ou o Python 3.8+ e rode de novo. No Windows, o
"python" da Microsoft Store que apenas abre a loja não conta; o script percebe isso.

## O script demorou na primeira vez

Com o `uv`, a primeira execução pode baixar uma versão do Python. As seguintes são rápidas (poucos segundos).

## O Windows bloqueou o `.ps1`

Use o `preparar-dados.bat` (ele chama o PowerShell com a política liberada só para essa execução), ou rode
`powershell -ExecutionPolicy Bypass -File preparar-dados.ps1`. Se o arquivo veio de um download, clique com o botão direito →
Propriedades → **Desbloquear**.

## Os números não batem com o que eu esperava

1. Olhe a **linha de status**: período realmente usado, dias desconsiderados, horário, automáticas, encerramentos.
2. Lembre-se de que o período pode ter sido ajustado por **Somente período fechado**.
3. Abra o "i" → "Saiba mais" do número em questão: há uma seção **Atenção** com as principais causas de diferença.
4. Contatos que já existiam antes do início do backup aparecem como **novos** perto da data inicial dos dados.
5. Respostas dadas por ligação ou outro número não aparecem no backup.

## Faltam ligações

O painel mostra as ligações que o viewer exporta, isto é, as que têm uma mensagem de "chamada" na conversa. Ligações que o WhatsApp registra
sem essa mensagem não são exportadas pelo viewer e não aparecem aqui.

## O PDF não baixa sozinho

O PDF usa a janela de impressão do navegador: escolha "Salvar como PDF". É assim para funcionar sem internet e sem bibliotecas externas.

## Quero ajuda

Abra uma [issue](https://github.com/aaschenbach/whatsapp-portable-statistics/issues/new/choose) **sem** dados privados (veja o modelo).
Para reproduzir um problema, use a demonstração fictícia em `demo/`.
