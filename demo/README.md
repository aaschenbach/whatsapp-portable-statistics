# Demonstração (dados 100% fictícios)

Nada aqui vem de conversas reais. O gerador cria uma saída **fictícia no formato do whatsapp-portable-viewer** (`data/chats.js` e
`data/chat_N.js`), com contatos inventados, horários sorteados (semente fixa), mensagens automáticas, encerramentos, anúncios, ligações e
grupos. Serve para testar o fluxo, produzir as capturas de tela da documentação e rodar os testes.

```powershell
uv run demo/gerar_demo.py                       # cria demo/saida/pendrive/data/
uv run scripts/anonimizar.py demo/saida/pendrive   # gera dados/estatisticas.js a partir dela
start estatisticas.html
```

Para regenerar as imagens de `docs/img/` (precisa de Node 18+ e de Chrome, Edge ou Chromium):

```powershell
node demo/capturar.mjs
```

Depois, **apague `dados/estatisticas.js`** para deixar o painel "virgem" (ele está no `.gitignore`, mas contém os dados fictícios da demonstração).
