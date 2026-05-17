using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Program
{
    private const string Marker = "\n__QR_SECURITY_CHECK_PAYLOAD_ZIP_V1__\n";
    private const string AppRootName = "QR보안점검표";
    private const string BundleDirName = "배포패키지";
    private const string AppExeDirName = "QR보안점검표 관리자";
    private const string AppExeName = "QR보안점검표 관리자.exe";
    private const string ShortcutName = "QR보안점검표 관리자.lnk";
    private const string AppIconFileName = "app_icon.ico";
    private const uint ShcneAssocChanged = 0x08000000;
    private const uint ShcnfIdList = 0x0000;

    [DllImport("shell32.dll")]
    private static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);

    [STAThread]
    private static int Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        string defaultInstallRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppRootName
        );
        using InstallerForm form = new(defaultInstallRoot);
        Application.Run(form);
        return form.ExitCode;
    }

    private sealed class InstallerForm : Form
    {
        private readonly TextBox installPathBox = new();
        private readonly CheckBox desktopShortcutBox = new();
        private readonly CheckBox startMenuShortcutBox = new();
        private readonly Button installButton = new();
        private readonly Button cancelButton = new();
        private readonly ProgressBar progressBar = new();
        private readonly Label statusLabel = new();
        private bool installing;
        private bool completed;

        public int ExitCode { get; private set; }

        public InstallerForm(string defaultInstallRoot)
        {
            Text = "QR보안점검표 관리자 설치";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ClientSize = new Size(680, 430);
            Font = new Font("Malgun Gothic", 10F, FontStyle.Regular, GraphicsUnit.Point);
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

            Label title = new()
            {
                Text = "QR보안점검표 관리자 설치",
                Font = new Font(Font.FontFamily, 18F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(28, 24)
            };
            Controls.Add(title);

            Label subtitle = new()
            {
                Text = "설치 위치와 바로가기 옵션을 선택한 뒤 설치를 누르세요.",
                ForeColor = Color.FromArgb(71, 85, 105),
                AutoSize = true,
                Location = new Point(31, 66)
            };
            Controls.Add(subtitle);

            GroupBox destinationBox = new()
            {
                Text = "설치 위치",
                Location = new Point(28, 104),
                Size = new Size(624, 104)
            };
            Controls.Add(destinationBox);

            installPathBox.Text = defaultInstallRoot;
            installPathBox.Location = new Point(18, 42);
            installPathBox.Size = new Size(476, 30);
            destinationBox.Controls.Add(installPathBox);

            Button browseButton = new()
            {
                Text = "찾아보기...",
                Location = new Point(506, 40),
                Size = new Size(100, 34)
            };
            browseButton.Click += (_, _) => BrowseInstallPath();
            destinationBox.Controls.Add(browseButton);

            GroupBox optionBox = new()
            {
                Text = "바로가기 옵션",
                Location = new Point(28, 224),
                Size = new Size(624, 88)
            };
            Controls.Add(optionBox);

            desktopShortcutBox.Text = "바탕화면 바로가기 만들기";
            desktopShortcutBox.Checked = true;
            desktopShortcutBox.AutoSize = true;
            desktopShortcutBox.Location = new Point(20, 38);
            optionBox.Controls.Add(desktopShortcutBox);

            startMenuShortcutBox.Text = "시작 메뉴 바로가기 만들기";
            startMenuShortcutBox.Checked = true;
            startMenuShortcutBox.AutoSize = true;
            startMenuShortcutBox.Location = new Point(280, 38);
            optionBox.Controls.Add(startMenuShortcutBox);

            progressBar.Location = new Point(28, 330);
            progressBar.Size = new Size(624, 20);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            Controls.Add(progressBar);

            statusLabel.Text = "설치 준비됨";
            statusLabel.ForeColor = Color.FromArgb(71, 85, 105);
            statusLabel.AutoSize = false;
            statusLabel.Location = new Point(28, 358);
            statusLabel.Size = new Size(624, 24);
            Controls.Add(statusLabel);

            installButton.Text = "설치";
            installButton.Location = new Point(452, 388);
            installButton.Size = new Size(94, 34);
            installButton.Click += async (_, _) => await InstallOrCloseAsync();
            Controls.Add(installButton);

            cancelButton.Text = "취소";
            cancelButton.Location = new Point(558, 388);
            cancelButton.Size = new Size(94, 34);
            cancelButton.Click += (_, _) => Close();
            Controls.Add(cancelButton);

            FormClosing += (_, e) =>
            {
                if (installing)
                {
                    e.Cancel = true;
                }
            };
        }

        private void BrowseInstallPath()
        {
            using FolderBrowserDialog dialog = new()
            {
                Description = "QR보안점검표 관리자 설치 위치를 선택하세요.",
                SelectedPath = installPathBox.Text,
                ShowNewFolderButton = true,
                UseDescriptionForTitle = true
            };
            if (dialog.ShowDialog(this) == DialogResult.OK)
            {
                installPathBox.Text = dialog.SelectedPath;
            }
        }

        private async Task InstallOrCloseAsync()
        {
            if (completed)
            {
                Close();
                return;
            }

            string installRoot = installPathBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(installRoot))
            {
                MessageBox.Show(this, "설치 위치를 입력하세요.", "설치 위치 확인", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            installing = true;
            ExitCode = 1;
            installPathBox.Enabled = false;
            desktopShortcutBox.Enabled = false;
            startMenuShortcutBox.Enabled = false;
            installButton.Enabled = false;
            cancelButton.Enabled = false;
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.MarqueeAnimationSpeed = 25;
            SetStatus("설치를 준비하는 중입니다...");

            bool createDesktopShortcut = desktopShortcutBox.Checked;
            bool createStartMenuShortcut = startMenuShortcutBox.Checked;
            try
            {
                string installedPath = await Task.Run(
                    () => InstallPackage(installRoot, createDesktopShortcut, createStartMenuShortcut, SetStatusSafe)
                );
                progressBar.Style = ProgressBarStyle.Continuous;
                progressBar.Value = 100;
                SetStatus("설치가 완료되었습니다.");
                completed = true;
                ExitCode = 0;
                installButton.Text = "마침";
                installButton.Enabled = true;
                MessageBox.Show(
                    this,
                    "QR보안점검표 설치가 완료되었습니다.\n\n바탕화면 또는 시작 메뉴의 바로가기로 실행하세요.\n\n설치 위치:\n" + installedPath,
                    "설치 완료",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
            catch (Exception ex)
            {
                progressBar.Style = ProgressBarStyle.Continuous;
                progressBar.Value = 0;
                ExitCode = 1;
                SetStatus("설치 실패: " + ex.Message);
                installButton.Enabled = true;
                cancelButton.Enabled = true;
                installPathBox.Enabled = true;
                desktopShortcutBox.Enabled = true;
                startMenuShortcutBox.Enabled = true;
                MessageBox.Show(
                    this,
                    "설치 중 오류가 발생했습니다.\n\n" + ex.Message + "\n\n로그: " + WriteInstallErrorLog(ex),
                    "설치 오류",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            finally
            {
                installing = false;
            }
        }

        private void SetStatusSafe(string message)
        {
            if (IsHandleCreated)
            {
                BeginInvoke(new Action(() => SetStatus(message)));
            }
        }

        private void SetStatus(string message)
        {
            statusLabel.Text = message;
        }
    }

    private static string InstallPackage(string installRoot, bool createDesktopShortcut, bool createStartMenuShortcut, Action<string> report)
    {
        string? tempRoot = null;
        try
        {
            report("설치 파일을 확인하는 중입니다...");
            string selfPath = Environment.ProcessPath
                ?? Process.GetCurrentProcess().MainModule?.FileName
                ?? throw new InvalidOperationException("Setup executable path was not found.");
            byte[] self = File.ReadAllBytes(selfPath);
            byte[] marker = Encoding.UTF8.GetBytes(Marker);
            int markerIndex = LastIndexOf(self, marker);
            if (markerIndex < 0)
            {
                throw new InvalidOperationException("Embedded deployment package was not found.");
            }

            tempRoot = Path.Combine(Path.GetTempPath(), "QR_security_check_setup_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            string payloadZip = Path.Combine(tempRoot, "payload.zip");
            using (FileStream fs = File.Create(payloadZip))
            {
                int payloadStart = markerIndex + marker.Length;
                fs.Write(self, payloadStart, self.Length - payloadStart);
            }

            report("배포 파일 압축을 해제하는 중입니다...");
            string extractRoot = Path.Combine(tempRoot, "extract");
            Directory.CreateDirectory(extractRoot);
            ZipFile.ExtractToDirectory(payloadZip, extractRoot, overwriteFiles: true);

            string bundleRoot = FindBundleRoot(extractRoot);
            installRoot = Path.GetFullPath(installRoot);
            string targetRoot = Path.Combine(installRoot, BundleDirName);
            Directory.CreateDirectory(installRoot);

            string fullInstallRoot = Path.GetFullPath(installRoot);
            string fullTargetRoot = Path.GetFullPath(targetRoot);
            if (!fullTargetRoot.StartsWith(fullInstallRoot, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Unsafe install target path.");
            }

            report("기존 설치 파일을 정리하는 중입니다...");
            if (Directory.Exists(targetRoot))
            {
                Directory.Delete(targetRoot, recursive: true);
            }
            Directory.CreateDirectory(targetRoot);

            report("프로그램 파일을 복사하는 중입니다...");
            CopyDirectory(bundleRoot, targetRoot);

            string exePath = Path.Combine(targetRoot, "1_Windows_Admin_Program", AppExeDirName, AppExeName);
            if (!File.Exists(exePath))
            {
                throw new FileNotFoundException("Admin application executable was not found.", exePath);
            }

            string appDirectory = Path.GetDirectoryName(exePath) ?? targetRoot;
            string shortcutIconPath = PrepareShortcutIcon(appDirectory, targetRoot);

            if (createDesktopShortcut)
            {
                report("바탕화면 바로가기를 만드는 중입니다...");
                string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), ShortcutName);
                CreateShortcut(desktopShortcut, exePath, appDirectory, AppExeDirName, shortcutIconPath);
            }

            if (createStartMenuShortcut)
            {
                report("시작 메뉴 바로가기를 만드는 중입니다...");
                string startDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppRootName);
                Directory.CreateDirectory(startDir);
                string startShortcut = Path.Combine(startDir, ShortcutName);
                CreateShortcut(startShortcut, exePath, appDirectory, AppExeDirName, shortcutIconPath);
            }

            if (createDesktopShortcut || createStartMenuShortcut)
            {
                NotifyShellIconChanged();
            }

            string guidePath = Path.Combine(installRoot, "설치_완료_안내.txt");
            File.WriteAllText(
                guidePath,
                "QR보안점검표 설치가 완료되었습니다." + Environment.NewLine + Environment.NewLine
                    + "설치 위치:" + Environment.NewLine + targetRoot + Environment.NewLine + Environment.NewLine
                    + "처음 사용할 때는 프로그램 안의 도움말/매뉴얼 또는 설치 폴더의 README_먼저읽기.md를 확인하세요."
                    + Environment.NewLine,
                Encoding.UTF8
            );

            report("임시 파일을 정리하는 중입니다...");
            return targetRoot;
        }
        finally
        {
            if (tempRoot != null)
            {
                TryDelete(tempRoot);
            }
        }
    }

    private static string FindBundleRoot(string extractRoot)
    {
        if (Directory.Exists(Path.Combine(extractRoot, "1_Windows_Admin_Program")))
        {
            return extractRoot;
        }
        foreach (string dir in Directory.GetDirectories(extractRoot))
        {
            if (Directory.Exists(Path.Combine(dir, "1_Windows_Admin_Program")))
            {
                return dir;
            }
        }
        throw new DirectoryNotFoundException("Deployment package structure was not found.");
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

    private static string PrepareShortcutIcon(string appDirectory, string targetRoot)
    {
        string? sourceIconPath = ResolveInstalledIconPath(appDirectory, targetRoot);
        if (sourceIconPath == null)
        {
            return string.Empty;
        }

        byte[] iconBytes = File.ReadAllBytes(sourceIconPath);
        string hash = Convert.ToHexString(SHA256.HashData(iconBytes)).Substring(0, 12).ToLowerInvariant();
        string iconDirectory = Path.Combine(appDirectory, "icons");
        Directory.CreateDirectory(iconDirectory);
        string shortcutIconPath = Path.Combine(iconDirectory, "app_icon_" + hash + ".ico");
        File.Copy(sourceIconPath, shortcutIconPath, overwrite: true);
        return shortcutIconPath;
    }

    private static string? ResolveInstalledIconPath(string appDirectory, string targetRoot)
    {
        foreach (string candidate in new[]
        {
            Path.Combine(appDirectory, "_internal", "resources", AppIconFileName),
            Path.Combine(appDirectory, "resources", AppIconFileName),
            Path.Combine(targetRoot, "1_Windows_Admin_Program", AppExeDirName, "_internal", "resources", AppIconFileName)
        })
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static void NotifyShellIconChanged()
    {
        try
        {
            SHChangeNotify(ShcneAssocChanged, ShcnfIdList, IntPtr.Zero, IntPtr.Zero);
        }
        catch
        {
        }
    }

    private static void CreateShortcut(string shortcutPath, string targetPath, string workingDirectory, string description, string shortcutIconPath)
    {
        Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null) return;
        object? shell = Activator.CreateInstance(shellType);
        if (shell == null) return;
        if (File.Exists(shortcutPath))
        {
            File.Delete(shortcutPath);
        }
        object shortcut = shellType.InvokeMember(
            "CreateShortcut",
            System.Reflection.BindingFlags.InvokeMethod,
            null,
            shell,
            new object[] { shortcutPath }
        )!;
        Type shortcutType = shortcut.GetType();
        shortcutType.InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
        shortcutType.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { workingDirectory });
        string iconLocation = File.Exists(shortcutIconPath) ? shortcutIconPath + ",0" : targetPath + ",0";
        shortcutType.InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { iconLocation });
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
                if (buffer[i + j] != pattern[j])
                {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    private static string WriteInstallErrorLog(Exception ex)
    {
        string logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppRootName);
        Directory.CreateDirectory(logDir);
        string logPath = Path.Combine(logDir, "install_error.log");
        File.WriteAllText(logPath, ex.ToString(), Encoding.UTF8);
        return logPath;
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, recursive: true);
            }
        }
        catch
        {
        }
    }
}
