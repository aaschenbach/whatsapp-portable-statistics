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

### Identificar o canal de origem dos contatos (opcional)

Se você tiver um arquivo `origens.json` (veja `origens.exemplo.json` como ponto de partida), passe-o com `-Origens`:

```powershell
.\preparar-dados.ps1 -Pendrive "D:\pendrive" -Origens ".\origens.json"
```
```bash
bash preparar-dados.sh /caminho/do/pendrive "" ./origens.json
```

Se você não passar o argumento e o arquivo `origens.exemplo.json` existir na pasta do projeto, o script pergunta se
quer usá-lo. O arquivo de exemplo contém canais genéricos (Instagram, Google, site, TikTok, Facebook, indicação, YouTube)
como ponto de partida.

O `origens.json` é específico do seu negócio; edite-o com os canais e termos que fazem sentido para você. Veja o formato
completo em [README.pt-BR.md](../README.pt-BR.md#identificar-o-canal-de-origem-dos-contatos-opcional).

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

## Levar o painel para um pendrive ou uma pasta

Depois de rodar o script de preparação, use o `copiar-painel` para colocar o painel num pendrive ou numa pasta (por exemplo, para
usar em outro computador ou publicar num site). Ele copia **só o necessário**, sem você montar a lista de arquivos.

| Sistema | Como |
|---|---|
| Windows | dê dois cliques em `copiar-painel.bat` |
| Windows (PowerShell) | `.\copiar-painel.ps1` ou `.\copiar-painel.ps1 -Destino E:` |
| Linux / macOS | `bash copiar-painel.sh` ou `bash copiar-painel.sh /media/usb` |

O **destino** pode ser a letra do pendrive (`E`, `E:` ou `E:\`) ou uma pasta (`C:\stats`, `/media/usb`, `~/stats`). Se a pasta não
existir, ela é criada.

**O que ele copia** (e só isso):

```
estatisticas.html
ajuda.html
stats/                      (código e estilos; inclui o Chart.js e a licença dele)
dados/estatisticas.js       (o arquivo gerado pelo preparar-dados; só se você concordar)
```

Não vão `scripts/`, `demo/`, `docs/`, `tests/`, `.git/`, os READMEs nem a pasta `Media`.

**Como ele se comporta**

- Grava numa subpasta **`Estatisticas`** do destino (assim não se mistura com outros arquivos do pendrive, nem com os do viewer).
- Se o arquivo de dados ainda não existe, avisa e **para**: rode antes o `preparar-dados`.
- **Pergunta** se deve copiar o arquivo de dados, porque ele tem as datas e horários de cada mensagem (sem nomes, telefones nem texto).
- Se já existe um painel no destino, **pergunta antes de substituir** os arquivos do painel. Nunca apaga nada, nem outros arquivos nem um
  `dados/estatisticas.js` antigo (e avisa quando um antigo continua lá).
- **Confere cada arquivo copiado por SHA-256** e mostra um resumo. Confere também se há espaço no destino.

| Opção | Efeito |
|---|---|
| `-SemDados` (`--sem-dados`) | copia o painel sem o arquivo de dados, por exemplo para publicar num site |
| `-Demo` (`--demo`) | copia com **dados fictícios** da demonstração, em vez dos seus |
| `-Sim` (`--sim`) | responde "sim" a tudo, sem perguntar |
| `--subpasta NOME` | usa outro nome de subpasta (`--subpasta ""` grava direto na raiz do destino) |

Depois, abra `estatisticas.html` dentro de `Estatisticas`. No pendrive, funciona offline, de qualquer computador.

## Deixar tudo "virgem"

Para começar do zero (por exemplo, antes de entregar a pasta a outra pessoa), apague `dados/estatisticas.js`. O painel volta a
mostrar a orientação de preparação. Nada mais precisa ser limpo.
