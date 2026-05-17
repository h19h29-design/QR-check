param(
    [switch]$SkipInstall,
    [switch]$SkipTests,
    [switch]$KeepBuild,
    [string]$Version = "",
    [string]$OutputRoot = (Join-Path $env:USERPROFILE "Downloads")
)

# 학교 배포용 단일 설치 EXE를 만듭니다.
# 설치 EXE는 배포 ZIP을 내부에 포함하고, 실행 시 현재 사용자 폴더에 설치한 뒤
# 바탕화면/시작 메뉴 바로가기를 생성합니다. 관리자 권한은 요구하지 않습니다.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $Root
$PackageScript = Join-Path $PSScriptRoot "package.ps1"

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

function Get-ProjectVersion {
    if ($Version) {
        return $Version.TrimStart("v")
    }
    $Changelog = Join-Path $RepoRoot "CHANGELOG.md"
    $Line = Select-String -Path $Changelog -Pattern "^##\s+([0-9]+\.[0-9]+\.[0-9]+)" | Select-Object -First 1
    if ($Line -and $Line.Matches.Count -gt 0) {
        return $Line.Matches[0].Groups[1].Value
    }
    return "0.0.0"
}

function Write-InstallerSource {
    param([string]$BuildRoot)

    @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <EnableCompressionInSingleFile>true</EnableCompressionInSingleFile>
    <UseWindowsForms>true</UseWindowsForms>
    <ApplicationIcon>app_icon.ico</ApplicationIcon>
    <AssemblyName>QR_security_check_setup_stub</AssemblyName>
  </PropertyGroup>
</Project>
'@ | Set-Content -LiteralPath (Join-Path $BuildRoot "QrSecurityCheckSetup.csproj") -Encoding UTF8

    $IconPath = Join-Path $Root "src\resources\app_icon.ico"
    if (-not (Test-Path -LiteralPath $IconPath)) {
        throw "설치 아이콘을 찾지 못했습니다: $IconPath"
    }
    Copy-Item -LiteralPath $IconPath -Destination (Join-Path $BuildRoot "app_icon.ico") -Force

    $SetupProgram = Join-Path $Root "installer\SetupProgram.cs"
    if (-not (Test-Path -LiteralPath $SetupProgram)) {
        throw "설치 프로그램 소스를 찾지 못했습니다: $SetupProgram"
    }
    Copy-Item -LiteralPath $SetupProgram -Destination (Join-Path $BuildRoot "Program.cs") -Force
    return

    @'
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    private const string Marker = "\n__QR_SECURITY_CHECK_PAYLOAD_ZIP_V1__\n";
    private const string AppRootName = "QR\ubcf4\uc548\uc810\uac80\ud45c";
    private const string BundleDirName = "\ubc30\ud3ec\ud328\ud0a4\uc9c0";
    private const string AppExeDirName = "QR\ubcf4\uc548\uc810\uac80\ud45c \uad00\ub9ac\uc790";
    private const string AppExeName = "QR\ubcf4\uc548\uc810\uac80\ud45c \uad00\ub9ac\uc790.exe";
    private const string ShortcutName = "QR\ubcf4\uc548\uc810\uac80\ud45c \uad00\ub9ac\uc790.lnk";

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    [STAThread]
    private static int Main()
    {
        try
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string selfPath = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName ?? throw new InvalidOperationException("Setup executable path was not found.");
            byte[] self = File.ReadAllBytes(selfPath);
            byte[] marker = Encoding.UTF8.GetBytes(Marker);
            int markerIndex = LastIndexOf(self, marker);
            if (markerIndex < 0)
                throw new InvalidOperationException("Embedded deployment package was not found.");

            string tempRoot = Path.Combine(Path.GetTempPath(), "QR_security_check_setup_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            string payloadZip = Path.Combine(tempRoot, "payload.zip");
            using (FileStream fs = File.Create(payloadZip))
            {
                int payloadStart = markerIndex + marker.Length;
                fs.Write(self, payloadStart, self.Length - payloadStart);
            }

            string extractRoot = Path.Combine(tempRoot, "extract");
            Directory.CreateDirectory(extractRoot);
            ZipFile.ExtractToDirectory(payloadZip, extractRoot, overwriteFiles: true);

            string bundleRoot = FindBundleRoot(extractRoot);
            string defaultInstallRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppRootName);
            string? installRoot = ChooseInstallRoot(defaultInstallRoot);
            if (string.IsNullOrWhiteSpace(installRoot))
            {
                TryDelete(tempRoot);
                return 0;
            }
            installRoot = Path.GetFullPath(installRoot);
            string targetRoot = Path.Combine(installRoot, BundleDirName);
            Directory.CreateDirectory(installRoot);

            string fullInstallRoot = Path.GetFullPath(installRoot);
            string fullTargetRoot = Path.GetFullPath(targetRoot);
            if (!fullTargetRoot.StartsWith(fullInstallRoot, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Unsafe install target path.");

            if (Directory.Exists(targetRoot))
                Directory.Delete(targetRoot, recursive: true);
            Directory.CreateDirectory(targetRoot);
            CopyDirectory(bundleRoot, targetRoot);

            string exePath = Path.Combine(targetRoot, "1_Windows_Admin_Program", AppExeDirName, AppExeName);
            if (!File.Exists(exePath))
                throw new FileNotFoundException("Admin application executable was not found.", exePath);

            string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), ShortcutName);
            CreateShortcut(desktopShortcut, exePath, Path.GetDirectoryName(exePath) ?? targetRoot, AppExeDirName);

            string startDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppRootName);
            Directory.CreateDirectory(startDir);
            string startShortcut = Path.Combine(startDir, ShortcutName);
            CreateShortcut(startShortcut, exePath, Path.GetDirectoryName(exePath) ?? targetRoot, AppExeDirName);

            string guidePath = Path.Combine(installRoot, "\uc124\uce58_\uc644\ub8cc_\uc548\ub0b4.txt");
            File.WriteAllText(guidePath,
                "QR\ubcf4\uc548\uc810\uac80\ud45c \uc124\uce58\uac00 \uc644\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4." + Environment.NewLine + Environment.NewLine +
                "\uc124\uce58 \uc704\uce58:" + Environment.NewLine + targetRoot + Environment.NewLine + Environment.NewLine +
                "\ucc98\uc74c \uc0ac\uc6a9\ud560 \ub54c\ub294 \ud504\ub85c\uadf8\ub7a8 \uc548\uc758 \ub3c4\uc6c0\ub9d0/\ub9e4\ub274\uc5bc \ub610\ub294 \uc124\uce58 \ud3f4\ub354\uc758 README_\uba3c\uc800\uc77d\uae30.md\ub97c \ud655\uc778\ud558\uc138\uc694." + Environment.NewLine,
                Encoding.UTF8);

            TryDelete(tempRoot);
            MessageBoxW(IntPtr.Zero,
                "QR\ubcf4\uc548\uc810\uac80\ud45c \uc124\uce58\uac00 \uc644\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4.\n\n\ubc14\ud0d5\ud654\uba74\uc758 'QR\ubcf4\uc548\uc810\uac80\ud45c \uad00\ub9ac\uc790' \ubc14\ub85c\uac00\uae30\ub85c \uc2e4\ud589\ud558\uc138\uc694.\n\n\uc124\uce58 \uc704\uce58:\n" + targetRoot,
                "QR\ubcf4\uc548\uc810\uac80\ud45c \uc124\uce58 \uc644\ub8cc",
                0x00000040);
            return 0;
        }
        catch (Exception ex)
        {
            try
            {
                string logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppRootName);
                Directory.CreateDirectory(logDir);
                string logPath = Path.Combine(logDir, "install_error.log");
                File.WriteAllText(logPath, ex.ToString(), Encoding.UTF8);
                MessageBoxW(IntPtr.Zero, "\uc124\uce58 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.\n\n" + ex.Message + "\n\n\ub85c\uadf8: " + logPath, "QR\ubcf4\uc548\uc810\uac80\ud45c \uc124\uce58 \uc624\ub958", 0x00000010);
            }
            catch
            {
                MessageBoxW(IntPtr.Zero, "\uc124\uce58 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.\n\n" + ex.Message, "QR\ubcf4\uc548\uc810\uac80\ud45c \uc124\uce58 \uc624\ub958", 0x00000010);
            }
            return 1;
        }
    }

    private static string FindBundleRoot(string extractRoot)
    {
        if (Directory.Exists(Path.Combine(extractRoot, "1_Windows_Admin_Program")))
            return extractRoot;
        foreach (string dir in Directory.GetDirectories(extractRoot))
        {
            if (Directory.Exists(Path.Combine(dir, "1_Windows_Admin_Program")))
                return dir;
        }
        throw new DirectoryNotFoundException("Deployment package structure was not found.");
    }

    private static string? ChooseInstallRoot(string defaultInstallRoot)
    {
        Directory.CreateDirectory(defaultInstallRoot);
        using FolderBrowserDialog dialog = new FolderBrowserDialog
        {
            Description = "QR보안점검표 관리자 설치 위치를 선택하세요.",
            SelectedPath = defaultInstallRoot,
            ShowNewFolderButton = true,
            UseDescriptionForTitle = true
        };
        DialogResult result = dialog.ShowDialog();
        return result == DialogResult.OK ? dialog.SelectedPath : null;
    }

    private static void CopyDirectory(string source, string destination)
    {
        foreach (string dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
        {
            Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, dir)));
        }
        foreach (string file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            string dest = Path.Combine(destination, Path.GetRelativePath(source, file));
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(file, dest, overwrite: true);
        }
    }

    private static void CreateShortcut(string shortcutPath, string targetPath, string workingDirectory, string description)
    {
        Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null) return;
        object? shell = Activator.CreateInstance(shellType);
        if (shell == null) return;
        object shortcut = shellType.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath })!;
        Type shortcutType = shortcut.GetType();
        shortcutType.InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
        shortcutType.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { workingDirectory });
        shortcutType.InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
        shortcutType.InvokeMember("Description", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { description });
        shortcutType.InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, shortcut, Array.Empty<object>());
    }

    private static int LastIndexOf(byte[] buffer, byte[] pattern)
    {
        for (int i = buffer.Length - pattern.Length; i >= 0; i--)
        {
            bool match = true;
            for (int j = 0; j < pattern.Length; j++)
            {
                if (buffer[i + j] != pattern[j]) { match = false; break; }
            }
            if (match) return i;
        }
        return -1;
    }

    private static void TryDelete(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, recursive: true); } catch { }
    }
}
'@ | Set-Content -LiteralPath (Join-Path $BuildRoot "Program.cs") -Encoding UTF8
}

function New-SetupExe {
    param(
        [string]$BuildRoot,
        [string]$PayloadZip,
        [string]$SetupExe
    )

    Write-InstallerSource -BuildRoot $BuildRoot
    $ProjectPath = Join-Path $BuildRoot "QrSecurityCheckSetup.csproj"
    & dotnet publish $ProjectPath -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true
    $Stub = Join-Path $BuildRoot "bin\Release\net8.0-windows\win-x64\publish\QR_security_check_setup_stub.exe"
    if (-not (Test-Path -LiteralPath $Stub)) {
        throw "설치 stub 생성 실패: $Stub"
    }

    $Marker = [Text.Encoding]::UTF8.GetBytes("`n__QR_SECURITY_CHECK_PAYLOAD_ZIP_V1__`n")
    $StubBytes = [IO.File]::ReadAllBytes($Stub)
    $ZipBytes = [IO.File]::ReadAllBytes($PayloadZip)
    $Out = [IO.File]::Open($SetupExe, [IO.FileMode]::Create, [IO.FileAccess]::Write)
    try {
        $Out.Write($StubBytes, 0, $StubBytes.Length)
        $Out.Write($Marker, 0, $Marker.Length)
        $Out.Write($ZipBytes, 0, $ZipBytes.Length)
    } finally {
        $Out.Dispose()
    }
}

function Test-InstallerPayload {
    param([string]$SetupExe)

    $Marker = [Text.Encoding]::UTF8.GetBytes("`n__QR_SECURITY_CHECK_PAYLOAD_ZIP_V1__`n")
    $Bytes = [IO.File]::ReadAllBytes($SetupExe)
    $Index = -1
    for ($i = $Bytes.Length - $Marker.Length; $i -ge 0; $i--) {
        $Ok = $true
        for ($j = 0; $j -lt $Marker.Length; $j++) {
            if ($Bytes[$i + $j] -ne $Marker[$j]) {
                $Ok = $false
                break
            }
        }
        if ($Ok) {
            $Index = $i
            break
        }
    }
    if ($Index -lt 0) {
        throw "설치 EXE 내부 payload marker를 찾지 못했습니다."
    }

    $TempRoot = Join-Path $env:TEMP ("QR_setup_verify_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $PayloadStart = $Index + $Marker.Length
    $PayloadZip = Join-Path $TempRoot "payload.zip"
    $Out = [IO.File]::Open($PayloadZip, [IO.FileMode]::Create, [IO.FileAccess]::Write)
    try {
        $Out.Write($Bytes, $PayloadStart, $Bytes.Length - $PayloadStart)
    } finally {
        $Out.Dispose()
    }
    $ExtractRoot = Join-Path $TempRoot "extract"
    Expand-Archive -LiteralPath $PayloadZip -DestinationPath $ExtractRoot -Force
    $Root = Get-ChildItem -LiteralPath $ExtractRoot -Directory | Where-Object {
        Test-Path -LiteralPath (Join-Path $_.FullName "1_Windows_Admin_Program")
    } | Select-Object -First 1
    if (-not $Root) {
        throw "검증 실패: 배포 패키지 루트가 없습니다."
    }
    $AdminProgramRoot = Join-Path $Root.FullName "1_Windows_Admin_Program"
    $AdminExe = Get-ChildItem -LiteralPath $AdminProgramRoot -Recurse -Filter "*.exe" | Select-Object -First 1
    if (-not $AdminExe) {
        throw "검증 실패: Windows 관리자 프로그램 exe를 찾지 못했습니다."
    }
    $AppsScript = Join-Path $Root.FullName "2_Google_AppsScript_Code\Code.gs"
    if (-not (Test-Path -LiteralPath $AppsScript)) {
        throw "검증 실패: Apps Script Code.gs를 찾지 못했습니다."
    }
    $Readme = Get-ChildItem -LiteralPath $Root.FullName -Filter "README_*.md" | Select-Object -First 1
    if (-not $Readme) {
        throw "검증 실패: README_*.md를 찾지 못했습니다."
    }
    Remove-Item -LiteralPath $TempRoot -Recurse -Force
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET SDK가 필요합니다. 설치 EXE를 만들려면 dotnet 명령을 PowerShell에서 사용할 수 있어야 합니다."
}

$OutputRoot = Resolve-OutputDirectory -Path $OutputRoot
$VersionNumber = Get-ProjectVersion
$StartedAt = Get-Date

$PackageParams = @{ OutputRoot = $OutputRoot }
if ($SkipInstall) { $PackageParams.SkipInstall = $true }
if ($SkipTests) { $PackageParams.SkipTests = $true }
& $PackageScript @PackageParams

$SourceFolder = Get-ChildItem -LiteralPath $OutputRoot -Directory -Filter "QR_security_check_deploy_*" |
    Where-Object { $_.LastWriteTime -ge $StartedAt.AddMinutes(-2) -and $_.Name -notmatch "_v[0-9]+\.[0-9]+\.[0-9]+_" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $SourceFolder) {
    $SourceFolder = Get-ChildItem -LiteralPath $OutputRoot -Directory -Filter "QR_security_check_deploy_*" |
        Where-Object { $_.Name -notmatch "_v[0-9]+\.[0-9]+\.[0-9]+_" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}
if (-not $SourceFolder) {
    throw "배포 폴더를 찾지 못했습니다."
}

$DateStamp = $SourceFolder.Name -replace "^QR_security_check_deploy_", ""
$VersionedName = "QR_security_check_deploy_v$VersionNumber`_$DateStamp"
$VersionedFolder = Join-Path $OutputRoot $VersionedName
$VersionedZip = Join-Path $OutputRoot "$VersionedName.zip"
if (Test-Path -LiteralPath $VersionedFolder) { Remove-Item -LiteralPath $VersionedFolder -Recurse -Force }
if (Test-Path -LiteralPath $VersionedZip) { Remove-Item -LiteralPath $VersionedZip -Force }
Copy-Item -LiteralPath $SourceFolder.FullName -Destination $VersionedFolder -Recurse -Force

$Commit = git -C $RepoRoot log -1 --oneline
@"
QR보안점검표 배포본

버전: v$VersionNumber
빌드일시: $DateStamp
소스 커밋: $Commit
원본 배포 폴더: $($SourceFolder.FullName)

처음 설치/사용할 때는 프로그램 안의 도움말/매뉴얼 또는 README_먼저읽기.md를 확인하세요.
"@ | Set-Content -LiteralPath (Join-Path $VersionedFolder "VERSION.txt") -Encoding UTF8
Compress-Archive -LiteralPath $VersionedFolder -DestinationPath $VersionedZip -Force

$InstallerStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BuildRoot = Join-Path $OutputRoot "QR_security_check_setup_builder_$InstallerStamp"
$SetupExe = Join-Path $OutputRoot "QR_security_check_setup_v$VersionNumber`_$InstallerStamp.exe"
$ReadmePath = Join-Path $OutputRoot "QR_security_check_setup_v$VersionNumber`_$InstallerStamp`_README.txt"
New-Item -ItemType Directory -Force -Path $BuildRoot | Out-Null

New-SetupExe -BuildRoot $BuildRoot -PayloadZip $VersionedZip -SetupExe $SetupExe
Test-InstallerPayload -SetupExe $SetupExe
$Hash = Get-FileHash -LiteralPath $SetupExe -Algorithm SHA256

@"
QR보안점검표 설치파일

설치파일:
$SetupExe

버전:
v$VersionNumber

이 파일은 관리자 권한 없이 설치할 수 있으며, 설치 중 원하는 설치 위치를 선택합니다.
기본 설치 위치:
%LOCALAPPDATA%\QR보안점검표\배포패키지

설치 후 바탕화면과 시작 메뉴에 'QR보안점검표 관리자' 바로가기를 만듭니다.
프로그램 안의 '도움말/매뉴얼' 메뉴에서 초기 설정과 사용법을 확인할 수 있습니다.

주의:
- 코드서명 인증서가 없는 무료 배포용 설치파일이라 Windows SmartScreen 경고가 나올 수 있습니다.
- Google Sheet/Apps Script 설정, Desktop Sync Key 등록, QR 생성까지 끝나야 실사용할 수 있습니다.

포함된 배포 ZIP:
$VersionedZip

SHA256:
$($Hash.Hash.ToLowerInvariant())
"@ | Set-Content -LiteralPath $ReadmePath -Encoding UTF8

if (-not $KeepBuild) {
    Remove-Item -LiteralPath $BuildRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "versioned release folder ready: $VersionedFolder"
Write-Host "versioned release zip ready: $VersionedZip"
Write-Host "installer ready: $SetupExe"
Write-Host "installer readme ready: $ReadmePath"
Write-Host "installer sha256: $($Hash.Hash.ToLowerInvariant())"
