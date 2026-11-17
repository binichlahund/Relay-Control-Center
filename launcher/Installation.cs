using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using Microsoft.Win32;

internal sealed class Installation
{
    private readonly string root, beside;
    private readonly string build = Assembly.GetExecutingAssembly().ManifestModule.ModuleVersionId.ToString("N");
    public string LogPath { get { return Path.Combine(root, "repair.log"); } }

    public Installation(string root, string beside)
    {
        this.root = Path.Combine(root,"Desktop2");
        this.beside = beside;
    }

    private string Pointer { get { return Path.Combine(root, build + ".txt"); } }
    private static bool Complete(string path)
    {
        return File.Exists(path) && File.Exists(Path.Combine(Path.GetDirectoryName(path),"WebView2Loader.dll"));
    }

    public string Find()
    {
        Guid id;
        if (File.Exists(Pointer) && Guid.TryParseExact(File.ReadAllText(Pointer),"N",out id))
        {
            var candidate = Path.Combine(root,id.ToString("N"),"Relay.exe");
            if (Complete(candidate)) return candidate;
        }
        foreach (string baseDir in new[]{beside,Path.Combine(beside,"ControlCenter")})
        {
            string local = Path.Combine(baseDir,"desktop","Relay.exe");
            if (Complete(local)) return local;
        }
        return null;
    }

    public void Launch()
    {
        var path = Find();
        if (path == null) { Repair(s=>{}); path = Find(); }
        using (var process = Process.Start(new ProcessStartInfo(path) {
            WorkingDirectory=Path.GetDirectoryName(path),UseShellExecute=false }))
            if (process.WaitForExit(1500) && process.ExitCode != 0)
                throw new InvalidOperationException("The dashboard could not start. Choose Install/Repair.");
    }

    private static bool HasWebView()
    {
        foreach (var hive in new[]{RegistryHive.LocalMachine,RegistryHive.CurrentUser})
        foreach (var view in new[]{RegistryView.Registry32,RegistryView.Registry64})
        using (var baseKey=RegistryKey.OpenBaseKey(hive,view))
        using (var clients=baseKey.OpenSubKey(@"Software\Microsoft\EdgeUpdate\Clients"))
        {
            if (clients==null) continue;
            foreach (var id in clients.GetSubKeyNames())
            using (var key=clients.OpenSubKey(id))
                if (key!=null && Convert.ToString(key.GetValue("name")).IndexOf("WebView2",StringComparison.OrdinalIgnoreCase)>=0
                    && !String.IsNullOrWhiteSpace(Convert.ToString(key.GetValue("pv")))) return true;
        }
        return false;
    }

    private static void EnsureWebView(string dir,Action<string> report)
    {
        if (HasWebView()) return;
        report("Installing Microsoft Edge WebView2 Runtime…");
        var setup=Path.Combine(dir,"MicrosoftEdgeWebview2Setup.exe");
        ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
        using (var client=new WebClient()) client.DownloadFile("https://go.microsoft.com/fwlink/p/?LinkId=2124703",setup);
        var verify=new ProcessStartInfo("powershell.exe",
            "-NoProfile -NonInteractive -Command \"$s=Get-AuthenticodeSignature -LiteralPath $env:RELAY_WEBVIEW_INSTALLER; if ($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { exit 1 }\""){
            CreateNoWindow=true,UseShellExecute=false};
        verify.EnvironmentVariables["RELAY_WEBVIEW_INSTALLER"]=setup;
        using (var signature=Process.Start(verify)){signature.WaitForExit();if(signature.ExitCode!=0)throw new InvalidDataException("Microsoft installer signature verification failed.");}
        using (var process=Process.Start(new ProcessStartInfo(setup,"/silent /install"){UseShellExecute=false}))
        {process.WaitForExit();if(process.ExitCode!=0 && !HasWebView())throw new InvalidOperationException("WebView2 installation failed.");}
        File.Delete(setup);
    }

    public void Repair(Action<string> report)
    {
        Directory.CreateDirectory(root);
        using (new FileStream(Path.Combine(root,"repair.lock"),FileMode.OpenOrCreate,FileAccess.Write,FileShare.None))
        using (var log=new StreamWriter(LogPath,false){AutoFlush=true})
        {
            string id=Guid.NewGuid().ToString("N"),dir=Path.Combine(root,id);
            Directory.CreateDirectory(dir);
            bool committed=false;
            try
            {
                report("Restoring the native dashboard and its WebView loader…");
                using (var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
                using (var zip=new ZipArchive(stream,ZipArchiveMode.Read)) zip.ExtractToDirectory(dir);
                foreach (string line in File.ReadAllLines(Path.Combine(dir,"checksums.txt")))
                {
                    string[] parts=line.Split(' ');
                    using (var hash=SHA256.Create())
                    using (var file=File.OpenRead(Path.Combine(dir,parts[1])))
                        if (BitConverter.ToString(hash.ComputeHash(file)).Replace("-","").ToLowerInvariant()!=parts[0])
                            throw new InvalidDataException("Dashboard verification failed.");
                }
                EnsureWebView(dir,report);
                var old=Find();
                var temp=Path.Combine(root,"current.tmp");
                File.WriteAllText(temp,id);
                if (File.Exists(Pointer)) File.Replace(temp,Pointer,null); else File.Move(temp,Pointer);
                committed=true;
                if(old!=null && Path.GetDirectoryName(Path.GetDirectoryName(old))==root)
                {
                    try { File.Delete(old); Directory.Delete(Path.GetDirectoryName(old),true); }
                    catch(IOException){} catch(UnauthorizedAccessException){}
                }
                log.WriteLine("Dashboard and WebView loader verified.");
            }
            catch(Exception e){log.WriteLine(e.ToString());throw;}
            finally {if(!committed)Directory.Delete(dir,true);}
        }
    }
}
