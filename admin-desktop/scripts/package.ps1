# PyInstaller로 Windows 실행 파일을 만듭니다.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

$Python = Join-Path $Root ".venv\Scripts\python.exe"
& $Python -m pip install --upgrade pip
& $Python -m pip install -r requirements.txt
$env:PYTHONPATH = Join-Path $Root "src"
$AppName = "QR" + [string]::Concat([char[]](0xBCF4, 0xC548, 0xC810, 0xAC80, 0xD45C)) + " " + [string]::Concat([char[]](0xAD00, 0xB9AC, 0xC790))
& $Python -m PyInstaller --noconfirm --windowed --name $AppName --paths "src" "src\main.py"
