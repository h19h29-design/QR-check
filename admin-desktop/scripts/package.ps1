param(
    [switch]$SkipInstall,
    [switch]$SkipTests,
    [switch]$NoZip,
    [string]$OutputRoot = (Join-Path $env:USERPROFILE "Downloads")
)

# PyInstaller 실행 파일과 학교 배포용 묶음을 만듭니다.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $Root
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

function Resolve-OutputDirectory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }

    $Item = Get-Item -LiteralPath $Path
    if (-not $Item.PSIsContainer) {
        throw "OutputRoot가 폴더가 아닙니다: $Path"
    }

    return $Item.FullName
}

foreach ($RelativePath in @(
    "apps-script\Code.gs",
    "apps-script\appsscript.json",
    "docs\09_RELEASE_CHECKLIST.md",
    "release\mobile_submit_preview.html",
    "release\mobile_admin_preview.html",
    "sample-data\sample_submissions.json",
    "README.md",
    "admin-desktop\README.md"
)) {
    $SourcePath = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $SourcePath)) {
        throw "배포 묶음 원본 파일이 없습니다: $SourcePath"
    }
}

$OutputRoot = Resolve-OutputDirectory -Path $OutputRoot
New-ProjectVenv
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python)) {
    throw "가상환경 Python을 찾지 못했습니다: $Python"
}

if (-not $SkipInstall) {
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r requirements.txt
}

$env:PYTHONPATH = Join-Path $Root "src"
if (-not $SkipTests) {
    & $Python -m pytest
}

$AppName = "QR" + [string]::Concat([char[]](0xBCF4, 0xC548, 0xC810, 0xAC80, 0xD45C)) + " " + [string]::Concat([char[]](0xAD00, 0xB9AC, 0xC790))
$SpecPath = Join-Path $Root "build\spec"
$WorkPath = Join-Path $Root "build\pyinstaller"
$DistPath = Join-Path $Root "dist"
New-Item -ItemType Directory -Force -Path $SpecPath | Out-Null
New-Item -ItemType Directory -Force -Path $WorkPath | Out-Null

& $Python -m PyInstaller `
    --noconfirm `
    --windowed `
    --name $AppName `
    --paths "src" `
    --specpath $SpecPath `
    --workpath $WorkPath `
    --distpath $DistPath `
    "src\main.py"

$AppDist = Join-Path $DistPath $AppName
$ExePath = Join-Path $AppDist "$AppName.exe"
$InternalPath = Join-Path $AppDist "_internal"
if (-not (Test-Path -LiteralPath $ExePath)) {
    throw "실행 파일이 생성되지 않았습니다: $ExePath"
}
if (-not (Test-Path -LiteralPath $InternalPath)) {
    throw "PyInstaller _internal 폴더가 생성되지 않았습니다: $InternalPath"
}

$DateStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BundleName = "QR_security_check_deploy_$DateStamp"
$BundleRoot = Join-Path $OutputRoot $BundleName
if (Test-Path -LiteralPath $BundleRoot) {
    throw "이미 같은 이름의 배포 폴더가 있습니다: $BundleRoot"
}

New-Item -ItemType Directory -Force -Path $BundleRoot | Out-Null

$WindowsDir = Join-Path $BundleRoot "1_Windows_Admin_Program"
$AppsScriptDir = Join-Path $BundleRoot "2_Google_AppsScript_Code"
$ManualsDir = Join-Path $BundleRoot "3_Manuals"
$PreviewDir = Join-Path $BundleRoot "4_UI_Previews"
$SampleDir = Join-Path $BundleRoot "5_Sample_Data"
New-Item -ItemType Directory -Force -Path $WindowsDir, $AppsScriptDir, $ManualsDir, $PreviewDir, $SampleDir | Out-Null

Copy-Item -LiteralPath $AppDist -Destination $WindowsDir -Recurse -Force
Copy-Item -Path (Join-Path $RepoRoot "apps-script\*") -Destination $AppsScriptDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "docs") -Destination $ManualsDir -Recurse -Force
$ProjectReadme = Join-Path $RepoRoot "README.md"
$AdminReadme = Join-Path $Root "README.md"
Copy-Item -LiteralPath $ProjectReadme -Destination (Join-Path $ManualsDir "README_project.md") -Force
Copy-Item -LiteralPath $AdminReadme -Destination (Join-Path $ManualsDir "README_admin_desktop.md") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "CHANGELOG.md") -Destination $ManualsDir -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "PLAN.md") -Destination $ManualsDir -Force
Copy-Item -Path (Join-Path $RepoRoot "release\*.html") -Destination $PreviewDir -Force
Copy-Item -Path (Join-Path $RepoRoot "sample-data\*") -Destination $SampleDir -Recurse -Force
$ReleaseReadme = Get-ChildItem -LiteralPath (Join-Path $RepoRoot "release") -Filter "README_*.md" | Select-Object -First 1
if (-not $ReleaseReadme) {
    throw "release 폴더에서 README_*.md 파일을 찾지 못했습니다."
}
Copy-Item -LiteralPath $ReleaseReadme.FullName -Destination $BundleRoot -Force

$ReleaseReadmeInBundle = Get-ChildItem -LiteralPath $BundleRoot -Filter "README_*.md" | Select-Object -First 1
if (-not $ReleaseReadmeInBundle) {
    throw "배포 묶음 루트에 먼저읽기 README가 없습니다: $BundleRoot"
}

$RequiredPaths = @(
    "1_Windows_Admin_Program\$AppName\$AppName.exe",
    "1_Windows_Admin_Program\$AppName\_internal",
    "2_Google_AppsScript_Code\Code.gs",
    "2_Google_AppsScript_Code\appsscript.json",
    "3_Manuals\README_admin_desktop.md",
    "3_Manuals\README_project.md",
    "3_Manuals\docs\09_RELEASE_CHECKLIST.md",
    "4_UI_Previews\mobile_submit_preview.html",
    "5_Sample_Data\sample_submissions.json"
)
foreach ($RelativePath in $RequiredPaths) {
    $FullPath = Join-Path $BundleRoot $RelativePath
    if (-not (Test-Path -LiteralPath $FullPath)) {
        throw "배포 묶음 필수 파일이 없습니다: $FullPath"
    }
}

$ZipPath = $null
if (-not $NoZip) {
    $ZipPath = Join-Path $OutputRoot "$BundleName.zip"
    Compress-Archive -LiteralPath $BundleRoot -DestinationPath $ZipPath -Force
    if (-not (Test-Path -LiteralPath $ZipPath)) {
        throw "배포 zip이 생성되지 않았습니다: $ZipPath"
    }
}

Write-Host "dist root ready: $DistPath"
Write-Host "release folder ready: $BundleRoot"
if ($ZipPath) {
    Write-Host "release zip ready: $ZipPath"
}
