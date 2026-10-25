# 5. Como funciona

## Visão técnica

```
pendrive/data/chats.js, chat_*.js   ──►  scripts/anonimizar.py   ──►  dados/estatisticas.js   ──►  estatisticas.html
(formato do whatsapp-portable-viewer)    (Python, só biblioteca padrão)  (números, sem texto)         (JavaScript, sem servidor)
```

| Arquivo | Papel |
|---|---|
| `scripts/anonimizar.py` | lê a saída do viewer, classifica e anonimiza, grava `dados/estatisticas.js` |
| `preparar-dados.ps1` / `.sh` / `.bat` | pedem a pasta, escolhem `uv` ou Python e chamam o `anonimizar.py` |
| `scripts/copiar_painel.py` | copia só o necessário para um pendrive ou pasta, confere por SHA-256 e nunca apaga nada |
| `copiar-painel.ps1` / `.sh` / `.bat` | pedem o destino, escolhem `uv` ou Python e chamam o `copiar_painel.py` |
| `estatisticas.html` | o painel (HTML + `stats/`) |
| `stats/stats-core.js` | carga dos dados, períodos, feriados, agregação e tempos de resposta |
| `stats/stats-export.js` | tabelas neutras, CSV e XLSX (gerador próprio, sem dependências) |
| `stats/stats.js` | interface: filtros, indicadores, gráficos, ajustes, relatório PDF |
| `stats/stats-glossario.js`, `ajuda.html`, `stats/ajuda.js` | explicações de cada número (uma única fonte) |
| `stats/lib/chart.umd.js` | [Chart.js](https://www.chartjs.org/) (MIT), embutido para funcionar offline |

## O que o viewer entrega e o que é usado

O viewer grava `data/chats.js` (lista de conversas) e `data/chat_<id>.js` (mensagens de cada uma). Cada mensagem tem, entre outros,
`t` (data e hora em milissegundos), `m` (1 = enviada), `y` (tipo: `t` texto, `i` imagem, `a` áudio, `v` vídeo, `g` GIF, `d` documento,
`s` figurinha, `k` chamada, `x` aviso do sistema...). O anonimizador usa só isso, mais a presença de aviso de anúncio e o texto
**apenas durante o processamento** (para detectar automáticas, encerramentos e canal de origem); o texto não é gravado.

## Formato de `dados/estatisticas.js`

**Sem `--origens` (v:1):**

```js
window.STATS_DATA = {
  v: 1,                   // versão do formato
  gerado: "AAAA-MM-DD",
  cats: "tidavso",        // categorias: texto, imagem, documento, áudio, vídeo, figurinha, outros
  chats: [                // uma entrada por conversa, ordenada pela 1ª mensagem; ids renumerados
    [ grupo, anuncio, [ [t, flags], ... ] ],
  ],
  calls: [ [t, enviada, video, duracao_s, grupo, indice_da_conversa], ... ]
};
```

**Com `--origens` (v:2):**

```js
window.STATS_DATA = {
  v: 2,
  origins: ["instagram", "google", "site"],  // rótulos dos canais configurados
  gerado: "AAAA-MM-DD",
  cats: "tidavso",
  chats: [
    [ grupo, anuncio, ori_idx, [ [t, flags], ... ] ],  // ori_idx: índice em origins, ou -1
  ],
  calls: [ [t, enviada, video, duracao_s, grupo, indice_da_conversa], ... ]
};
```

`flags` de cada mensagem: bits 0–2 = categoria (índice em `cats`), bit 3 = **encerramento**, bit 4 = **automática**, bit 5 = **enviada**.

## Detecção de automáticas e encerramentos

- **Automática** (somente nas conversas individuais): o texto normalizado (minúsculas, sem acentos, espaços colapsados, 12 caracteres
  ou mais) é enviado em, pelo menos, 5 conversas e, em pelo menos metade das vezes, até 10 s depois de uma mensagem do outro lado;
  ou em 8 ou mais conversas, em ao menos 30% das vezes, e esta ocorrência foi rápida.
- **Encerramento**: texto sem "?" (até 90 caracteres) formado só por expressões de uma lista (agradecimentos, "ok", despedidas...), ou
  sem nenhuma letra ou número (emoji), ou uma figurinha.

Os dois critérios são regras de texto, **não exatas**. As ressalvas estão na ajuda do painel.

## Cálculos principais

- **Contato novo**: data real da primeira mensagem (ignorando só as automáticas, se desconsideradas); dias desconsiderados não mudam isso.
- **Contatos ativos**: conversas com ao menos uma mensagem aceita no período. **Recorrentes**: ativos cuja primeira mensagem é anterior ao período.
- **Espera de resposta**: percorre as mensagens da conversa em ordem. A espera por resposta nossa começa na 1ª mensagem do contato ainda
  sem resposta (que não seja encerramento); a espera pela resposta do contato começa na nossa 1ª mensagem sem resposta. Termina na primeira
  mensagem do outro lado. O tempo descontando dias desconsiderados e, se pedido, só dentro do horário de atendimento; esperas acima do limite
  são descartadas; a espera entra no dia em que a resposta aconteceu.
- **Fora do horário**: dia fora dos dias de atendimento, hora fora da janela, ou feriado.
- **Período fechado**: o início avança ao começo do primeiro intervalo inteiro e o fim recua ao fim do último intervalo já encerrado.
- **Comparação**: veja "Comparação com outro período" na ajuda. A variação só é calculada quando os dois lados cobrem o mesmo número de dias.

## Testes

```bash
uv sync
uv run ruff check .
uv run pytest -q                  # anonimizador e cópia do painel, com dados inventados
node tests/check-glossary.js      # todo indicador e gráfico tem explicação, e toda referência "Ver ..." aponta para um item existente
```

O `anonimizar.py` foi conferido contra a implementação original em JavaScript (mesmas mensagens e mesmos números calculados) antes de
ela ser removida; a lógica de classificação vive agora só no Python.

## Limites conhecidos

- A interface está só em português do Brasil.
- Ligações sem mensagem de "chamada" na conversa não são exportadas pelo viewer.
- O painel não distingue quem da equipe respondeu.
- A lista de feriados é a de São Paulo; o horário de atendimento é único para todos os dias.
