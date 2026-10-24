# Créditos e licenças

## O projeto de que este depende

- **[whatsapp-portable-viewer](https://github.com/aaschenbach/whatsapp-portable-viewer)**, do mesmo autor: descriptografa o backup do
  WhatsApp e gera o visualizador offline. Este projeto **usa a saída dele** (a pasta `data/`) e não funciona sem ela. Os dois são produtos
  separados; este nunca altera nada no viewer. Todo o trabalho de criptografia (por meio do
  [wa-crypt-tools](https://github.com/ElDavoo/wa-crypt-tools), de ElDavoo) fica no viewer; veja o
  [capítulo de créditos dele](https://github.com/aaschenbach/whatsapp-portable-viewer/blob/main/docs/creditos.md).

## Ferramentas e bibliotecas

- **[Chart.js](https://www.chartjs.org/)** (licença **MIT**): gráficos do painel, embutido em `stats/lib/chart.umd.js`. A licença está em
  [`stats/lib/chart.js-LICENSE.md`](../stats/lib/chart.js-LICENSE.md).
- **[uv](https://docs.astral.sh/uv/)** (Astral): gerenciador de Python usado pelos scripts (opcional).
- **pytest** e **ruff**: ferramentas de desenvolvimento.
- A geração de XLSX, CSV e PDF é própria (sem dependências).

## Licença deste projeto

[The Unlicense](../LICENSE): domínio público. Você pode usar, copiar, modificar, publicar e distribuir, para qualquer finalidade.

## Aviso

Este projeto **não é afiliado** ao WhatsApp nem à Meta. "WhatsApp" é marca registrada de seus titulares. O software é fornecido "como
está", sem garantias. Os números do painel dependem de regras de cálculo documentadas na ajuda; confira-as antes de tomar decisões.
