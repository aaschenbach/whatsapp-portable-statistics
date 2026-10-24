# 0. Visão geral

## O que este projeto faz

```
 whatsapp-portable-viewer                    ESTE PROJETO
 ───────────────────────                     ────────────
 Backup do celular                           preparar-dados (.bat / .ps1 / .sh)
   │  descriptografa e gera                    │  lê só data/chats.js e data/chat_*.js
   ▼                                           ▼
 pasta "pendrive"  ──────────────────────►   dados/estatisticas.js   (sem nomes, telefones nem texto)
   data/   (conversas)                          │
   Media/  (fotos, áudios...  NÃO é usada)      ▼
                                             estatisticas.html  ──►  gráficos, tabelas, PDF / CSV / XLSX
```

O resultado é uma pasta de arquivos comuns. **Não há servidor, não há programa para instalar e não precisa de internet**
para abrir o painel. Qualquer navegador atual (Chrome, Edge, Firefox, Safari) funciona.

## Relação com o viewer

Este projeto é um **subproduto** do [whatsapp-portable-viewer](https://github.com/aaschenbach/whatsapp-portable-viewer), mas são
**produtos separados**:

- O viewer descriptografa o backup e gera o visualizador de conversas. É lá que você faz tudo o que envolve celular, chave e backup.
- Este projeto **só lê** a pasta que o viewer gerou. Ele **não roda** o viewer e **não altera** nada nela.
- Você não precisa copiar a pasta `Media` (muitas vezes a maior parte do pendrive) nem levar o pendrive para usar o painel.

## O que você precisa

| Item | Detalhe |
|---|---|
| Saída do whatsapp-portable-viewer | a pasta gerada (normalmente `pendrive`), com a subpasta `data` |
| [`uv`](https://docs.astral.sh/uv/) **ou** Python 3.8+ | só para o script de preparação (usa só a biblioteca padrão) |
| Um navegador atual | para abrir `estatisticas.html`, offline |

## Quanto tempo leva

| Etapa | Tempo típico |
|---|---|
| Preparar os dados (a 1ª vez com `uv` pode baixar o Python) | de alguns segundos a 1 ou 2 minutos |
| Abrir o painel | instantâneo |

## O que o painel NÃO faz

- Não descriptografa backups (isso é do viewer).
- Não mostra nomes, telefones nem o texto das mensagens, **por desenho**.
- Não identifica quem da sua equipe respondeu: ele só vê "enviada" e "recebida".
- Não conhece respostas dadas por ligação, por outro número ou fora do backup.
