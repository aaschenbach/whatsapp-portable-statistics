# Prepara os dados do painel de estatisticas a partir do pendrive gerado pelo whatsapp-portable-viewer.
# Uso: powershell -File preparar-dados.ps1 [-Pendrive "C:\caminho\pendrive"] [-Saida "C:\outro\estatisticas.js"]
# (ou duplo clique em preparar-dados.bat)
param(
    [string]$Pendrive,   # pasta gerada pelo viewer (a que contem a pasta data)
    [string]$Saida       # opcional: arquivo de saida (padrao: dados\estatisticas.js)
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = '1'
Set-Location -LiteralPath $PSScriptRoot

function Fail([string]$text) { Write-Host "[ERRO] $text" -ForegroundColor Red; exit 1 }

if (-not $Pendrive) {
    Write-Host 'Informe a pasta do pendrive gerada pelo whatsapp-portable-viewer' -ForegroundColor Cyan
    Write-Host '(a pasta que contem a subpasta "data"; a pasta Media nao e usada).'
    $Pendrive = Read-Host 'Pasta'
}
$Pendrive = $Pendrive.Trim().Trim('"')
if (-not (Test-Path -LiteralPath (Join-Path $Pendrive 'data\chats.js'))) {
    Fail "Nao encontrei data\chats.js em '$Pendrive'. Informe a pasta gerada pelo viewer (a que contem a pasta data)."
}

$script = Join-Path $PSScriptRoot 'scripts\anonimizar.py'
$extra = @()
if ($Saida) { $extra = @('--saida', $Saida) }

function Test-Python([string]$exe, [string[]]$pre) {
    try {
        $v = & $exe @pre --version 2>&1
        return ($LASTEXITCODE -eq 0 -and "$v" -match 'Python 3')
    } catch { return $false }
}

Write-Host ''
Write-Host 'Anonimizando e gerando o arquivo de estatisticas...' -ForegroundColor Cyan
if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv run --no-project $script $Pendrive @extra
} elseif (Test-Python 'python' @()) {
    & python $script $Pendrive @extra
} elseif (Test-Python 'py' @('-3')) {
    & py -3 $script $Pendrive @extra
} else {
    Fail 'Nao encontrei o uv nem o Python 3. Instale o uv (https://docs.astral.sh/uv/) ou o Python 3 e rode de novo.'
}
if ($LASTEXITCODE -ne 0) { Fail 'A geracao falhou. Veja a mensagem acima.' }

Write-Host ''
Write-Host 'Pronto. Abra estatisticas.html neste diretorio para ver o painel.' -ForegroundColor Green
Write-Host 'O arquivo gerado nao contem nomes, telefones nem texto de mensagens.'
