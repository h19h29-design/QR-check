param(
    [switch]$SkipInstall
)

# 개발 실행 스크립트입니다. PowerShell에서 실행하세요.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not $SkipInstall) {
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r requirements.txt
}

$env:PYTHONPATH = Join-Path $Root "src"
& $Python (Join-Path $Root "src\main.py")

