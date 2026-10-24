# Copia o painel de estatisticas para um pendrive ou uma pasta, so com o necessario, conferindo cada arquivo.
# Uso: powershell -File copiar-painel.ps1 [-Destino E:] [-SemDados] [-Demo] [-Sim]
# (ou duplo clique em copiar-painel.bat)
param(
    [string]$Destino,    # pendrive (E, E: ou E:\) ou pasta (C:\stats)
    [switch]$SemDados,   # nao copia dados\estatisticas.js (para publicar o painel vazio)
    [switch]$Demo,       # copia com dados FICTICIOS de demonstracao
    [switch]$Sim         # responde sim a todas as perguntas
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = '1'
Set-Location -LiteralPath $PSScriptRoot

function Fail([string]$text) { Write-Host "[ERRO] $text" -ForegroundColor Red; exit 1 }

if (-not $Destino) {
    Write-Host 'Para onde copiar o painel?' -ForegroundColor Cyan
    Write-Host '  Pendrive: informe a letra, por exemplo  E:  ou  E:\'
    Write-Host '  Pasta:    informe o caminho, por exemplo  C:\stats'
    $Destino = Read-Host 'Destino'
}
$Destino = $Destino.Trim().Trim('"')
if (-not $Destino) { Fail 'Informe o destino.' }

$script = Join-Path $PSScriptRoot 'scripts\copiar_painel.py'
$extra = @()
if ($SemDados) { $extra += '--sem-dados' }
if ($Demo) { $extra += '--demo' }
if ($Sim) { $extra += '--sim' }

function Test-Python([string]$exe, [string[]]$pre) {
    try {
        $v = & $exe @pre --version 2>&1
        return ($LASTEXITCODE -eq 0 -and "$v" -match 'Python 3')
    } catch { return $false }
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv run --no-project $script $Destino @extra
} elseif (Test-Python 'python' @()) {
    & python $script $Destino @extra
} elseif (Test-Python 'py' @('-3')) {
    & py -3 $script $Destino @extra
} else {
    Fail 'Nao encontrei o uv nem o Python 3. Instale o uv (https://docs.astral.sh/uv/) ou o Python 3 e rode de novo.'
}
exit $LASTEXITCODE
