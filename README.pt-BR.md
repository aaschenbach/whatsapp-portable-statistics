# WhatsApp Portable Statistics (guia em português)

[![CI](https://github.com/aaschenbach/whatsapp-portable-statistics/actions/workflows/ci.yml/badge.svg)](https://github.com/aaschenbach/whatsapp-portable-statistics/actions/workflows/ci.yml)
[![Licença: Unlicense](https://img.shields.io/badge/Licen%C3%A7a-Unlicense-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-≥3.8-blue.svg)](https://www.python.org/)
[![uv](https://img.shields.io/badge/gerenciado%20com-uv-7C3AED.svg)](https://docs.astral.sh/uv/)
[![Plataforma](https://img.shields.io/badge/plataforma-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#resumo-em-3-passos)
[![Idioma](https://img.shields.io/badge/interface-pt--BR-orange.svg)](README.md#language)

Um **painel de estatísticas de atendimento**, **offline e anonimizado**, para quem atende clientes pelo **WhatsApp** ou
**WhatsApp Business**. Ele é um **subproduto do [whatsapp-portable-viewer](https://github.com/aaschenbach/whatsapp-portable-viewer)**:
você usa o viewer para gerar a saída do seu backup e este projeto transforma essa saída em números e gráficos, **sem nomes,
sem telefones e sem o texto das mensagens**, e **sem precisar levar o pendrive inteiro**.

> **Este projeto depende do [whatsapp-portable-viewer](https://github.com/aaschenbach/whatsapp-portable-viewer).**
> Primeiro você gera o viewer (é lá que se descriptografa o backup); depois usa este projeto. Ele apenas **lê** a pasta
> gerada pelo viewer e nunca altera nada nela. São produtos separados.

![Visão geral](docs/img/01-visao-geral.png)

## O que você vai ter no final

- **Contatos** únicos e **novos**, por dia, semana, mês, trimestre, semestre e ano.
- **Mensagens recebidas e enviadas**, por tipo de mídia: texto, imagem, documento, áudio, vídeo (e figurinha/outros).
- **Tempo de resposta** nos dois sentidos (média, mediana e P90), tempo até a 1ª resposta a novos contatos e % dentro da meta.
- **Ligações**: recebidas e feitas, atendidas e perdidas, voz e vídeo, duração e tempo para retornar uma ligação perdida.
- **Comparação** com o período anterior (ou o mesmo período do ano anterior) e a opção **"Somente período fechado"**.
- Período personalizado, gráficos de painel moderno (barras, empilhado, linhas, área e rosca) e **tabelas** para tudo.
- **Exportação em PDF, CSV e XLSX.**
- Um script que **copia o painel para um pendrive ou pasta** (só o necessário, conferido por SHA-256).
- Horário de atendimento, volume **fora do horário**, mapa de calor por dia e hora; sábados, domingos e feriados podem ser desconsiderados.
- Mensagens **automáticas** (saudação e ausência) e **encerramentos** ("obrigada", "ok", "tchau") podem ser desconsiderados.
- Cada número tem um botão **"i"** com uma explicação curta e um "Saiba mais" com a regra de cálculo completa.
- **Nomes e telefones nunca são exibidos nem exportados.**

## Por onde começar

| Se você... | Faça isto |
|---|---|
| Quer o caminho mais rápido | Siga o [resumo em 3 passos](#resumo-em-3-passos) abaixo |
| Quer entender cada etapa | Leia o [guia](docs/00-visao-geral.md) na ordem |
| Ainda não tem a saída do viewer | Comece pelo [guia do viewer](https://github.com/aaschenbach/whatsapp-portable-viewer/blob/main/README.pt-BR.md) |
| Quer só ver como fica | Veja [as telas da demonstração](docs/02-usando-o-painel.md) (dados fictícios) |

## Resumo em 3 passos (e um quarto, opcional)

1. **Gere o viewer** com o [whatsapp-portable-viewer](https://github.com/aaschenbach/whatsapp-portable-viewer) até ter a pasta de saída
   (normalmente `pendrive`), que contém uma subpasta `data`.
2. **Prepare os dados.** Nesta pasta, rode e informe a pasta gerada pelo viewer (a que contém `data`):
   - Windows: dê dois cliques em `preparar-dados.bat` (ou `.\preparar-dados.ps1 -Pendrive "D:\pendrive"`).
   - Linux/macOS: `bash preparar-dados.sh /caminho/do/pendrive`.

   Precisa do [`uv`](https://docs.astral.sh/uv/) **ou** do Python 3.8 ou superior (só a biblioteca padrão). O script lê só
   `data/chats.js` e `data/chat_*.js` (a pasta `Media` **não** é usada) e grava **um único arquivo**, `dados/estatisticas.js`.
3. **Abra `estatisticas.html`** com dois cliques. Funciona em qualquer navegador atual, sem internet.

4. **(Opcional) Leve para um pendrive ou pasta.** Rode `copiar-painel` e informe o destino (`E:` para um pendrive, ou uma pasta
   como `C:\stats`):
   - Windows: dê dois cliques em `copiar-painel.bat` (ou `.\copiar-painel.ps1 -Destino E:`).
   - Linux/macOS: `bash copiar-painel.sh /media/usb`.

   Ele copia **só o necessário** (as duas páginas, `stats/` e, se você concordar, `dados/estatisticas.js`) para uma subpasta
   `Estatisticas`, confere cada arquivo por SHA-256 e **nunca apaga nada** no destino. Opções: `-SemDados` / `--sem-dados` (para
   publicar o painel sem os dados) e `-Demo` / `--demo` (com dados fictícios).

Para atualizar, rode o viewer e o script de preparação de novo. Você **não precisa** do pendrive do viewer nem da pasta `Media`
para usar o painel em outro computador.

## Índice do guia

0. [Visão geral](docs/00-visao-geral.md): o que é, o que você precisa
1. [Preparar os dados](docs/01-preparar-os-dados.md): do viewer ao arquivo de estatísticas
2. [Usando o painel](docs/02-usando-o-painel.md): filtros, abas, comparação, exportação
3. [Ajustes e regras](docs/03-ajustes-e-regras.md): dias desconsiderados, horário, automáticas, encerramentos
4. [Problemas comuns](docs/04-problemas-comuns.md)
5. [Como funciona](docs/05-como-funciona.md): formato dos dados, cálculos e limites

Também: [segurança e privacidade](docs/seguranca-e-privacidade.md) e [créditos e licenças](docs/creditos.md).

## Demonstração

As capturas de tela usam uma **demonstração 100% fictícia**, gerada por `demo/gerar_demo.py`. Veja [demo/README.md](demo/README.md).

## Aviso importante

O arquivo `dados/estatisticas.js` não contém nomes, telefones nem texto de mensagens, mas contém **datas e horários** de mensagens
e ligações. Avalie isso antes de publicá-lo. Use apenas **os seus próprios dados**, em contas que você tem direito de acessar.
Este projeto **não é afiliado** ao WhatsApp nem à Meta.
