# 테스트와 기본 빌드 검증을 수행합니다.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function New-ProjectVenv {
    if (Test-Path -LiteralPath ".venv") {
        return
    }

    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($PythonCommand) {
        & $PythonCommand.Source -m venv .venv
        if ($LASTEXITCODE -eq 0) {
            return
        }
    }

    $PyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        & $PyLauncher.Source -3 -m venv .venv
        if ($LASTEXITCODE -eq 0) {
            return
        }
    }

    throw "Python 3.11 이상이 필요합니다. python 또는 py 명령을 PowerShell에서 실행할 수 있게 설치한 뒤 다시 실행하세요."
}

New-ProjectVenv
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python)) {
    throw "가상환경 Python을 찾지 못했습니다: $Python"
}

& $Python -m pip install --upgrade pip
& $Python -m pip install -r requirements.txt
$env:PYTHONPATH = Join-Path $Root "src"
& $Python -m pytest
