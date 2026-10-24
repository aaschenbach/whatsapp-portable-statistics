# 1. Preparar os dados

## Passo 1: tenha a saída do viewer

Siga o guia do [whatsapp-portable-viewer](https://github.com/aaschenbach/whatsapp-portable-viewer/blob/main/README.pt-BR.md) até
gerar o visualizador. Você terá uma pasta (normalmente `pendrive`) com esta aparência:

```
pendrive/
  index.html
  data/
    chats.js          ← usado
    chat_1.js ...     ← usados (um por conversa)
    fulltext.js       (busca do viewer; não usado)
    thumbs/           (não usado)
  Media/              (fotos, áudios, documentos; NÃO é usada)
```

## Passo 2: rode o script de preparação

Na pasta deste projeto:

| Sistema | Como |
|---|---|
| Windows | dê dois cliques em `preparar-dados.bat` |
| Windows (PowerShell) | `.\preparar-dados.ps1` ou `.\preparar-dados.ps1 -Pendrive "D:\pendrive"` |
| Linux / macOS | `bash preparar-dados.sh` ou `bash preparar-dados.sh /caminho/do/pendrive` |

Se você não informar a pasta, o script pergunta. Informe **a pasta que contém `data`** (não a `data` em si, e não a `Media`).
O arquivo de saída é opcional: `-Saida "C:\outro\estatisticas.js"` (PowerShell) ou o segundo argumento (`.sh`).

O script usa o `uv` se ele existir; senão, tenta o `python`/`py -3`. Se não achar nenhum, avisa o que instalar.

### O que o script faz

1. Lê **apenas** `data/chats.js` (para saber o que é grupo) e `data/chat_*.js` (as mensagens). Nada de `Media`.
2. Descarta nomes, telefones e textos. Guarda só: data e hora, direção (enviada ou recebida), tipo de mídia, se a mensagem é uma
   **automática**, um **encerramento**, se a conversa veio de **anúncio**, se é **grupo**, e as **ligações**.
3. Renumera as conversas (os ids originais não vão para a saída).
4. Grava **um único arquivo**: `dados/estatisticas.js`. Ele é bem menor que os arquivos de origem.

## Passo 3: abra o painel

Dê dois cliques em `estatisticas.html`. Se aparecer "Nenhum dado carregado", o arquivo `dados/estatisticas.js` não existe:
rode o passo 2.

## Atualizar com um backup novo

Gere o viewer de novo (veja o [capítulo do viewer sobre novo backup](https://github.com/aaschenbach/whatsapp-portable-viewer/blob/main/docs/08-novo-backup.md))
e rode o script de preparação outra vez. O `dados/estatisticas.js` é substituído. Seus ajustes na tela ficam salvos no navegador.

## Levar o painel para outro computador

Depois de rodar o script, copie **esta pasta** (poucos MB). Não é preciso levar o pendrive nem a pasta `Media`.

## Deixar tudo "virgem"

Para começar do zero (por exemplo, antes de entregar a pasta a outra pessoa), apague `dados/estatisticas.js`. O painel volta a
mostrar a orientação de preparação. Nada mais precisa ser limpo.
