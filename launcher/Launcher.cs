using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Program
{
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [STAThread]
    private static void Main()
    {
        SetProcessDPIAware();
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        bool first;
        using (var mutex = new Mutex(true, @"Local\RelayControlCenterLauncher", out first))
        {
            if (!first) { MessageBox.Show("The Relay launcher is already open.", "Relay Control Center"); return; }
            var install = new Installation(Path.Combine(Environment.GetFolderPath(
                Environment.SpecialFolder.LocalApplicationData), "Relay", "Launcher"), AppDomain.CurrentDomain.BaseDirectory);
            Application.Run(new Launcher(install));
        }
    }
}

internal sealed class Wave : Control
{
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer { Interval = 35 };
    public Wave()
    {
        DoubleBuffered = true;
        timer.Tick += (s,e) => { if (Visible) Invalidate(); };
        if (SystemInformation.IsMenuAnimationEnabled) timer.Start();
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing) timer.Dispose();
        base.Dispose(disposing);
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TranslateTransform(1,1);
        g.ScaleTransform((Width-2)/494f, (Height-2)/144f);
        var rect = new RectangleF(0,0,494,144);
        using (var shape = Rounded.Path(rect,16))
        using (var fill = new LinearGradientBrush(rect, Color.FromArgb(25,32,52),Color.FromArgb(40,57,92),15f))
        {
            g.FillPath(fill,shape);
            g.SetClip(shape);
            double phase = clock.Elapsed.TotalSeconds * .62;
            for (int j=0;j<31;j++)
            {
                double v = j/15.0-1;
                var points = new PointF[86];
                for (int k=0;k<points.Length;k++)
                {
                    double t = k/85.0;
                    points[k] = new PointF((float)(178+332*t), (float)(85+
                        Math.Sin(6.8*t+phase+v*.9)*28+Math.Cos(3*t-phase*.5)*13+v*(16+10*t)));
                }
                using (var fade = new LinearGradientBrush(new Point(178,0),new Point(500,0),
                    Color.FromArgb(0,136,168,255),Color.FromArgb(140,158,203,255)))
                using (var pen = new Pen(fade,1f)) g.DrawLines(pen,points);
            }
            g.ResetClip();
            using (var edge = new Pen(Color.FromArgb(65,84,121))) g.DrawPath(edge,shape);
        }
        using (var accent = new SolidBrush(Color.FromArgb(161,186,255)))
        using (var white = new SolidBrush(Color.FromArgb(247,244,255)))
        using (var small = new Font("Consolas",10,FontStyle.Bold,GraphicsUnit.Pixel))
        using (var big = new Font("Segoe UI",31,FontStyle.Bold,GraphicsUnit.Pixel))
        {
            g.FillPolygon(accent,new[]{new Point(20,37),new Point(30,19),new Point(37,19),new Point(27,37)});
            g.FillPolygon(accent,new[]{new Point(32,37),new Point(42,19),new Point(47,19),new Point(37,37)});
            g.DrawString("R E L A Y",small,accent,54,22);
            g.DrawString("Control Center",big,white,18,55);
        }
    }
}

internal static class Rounded
{
    public static GraphicsPath Path(RectangleF r,float radius)
    {
        float d = radius*2;
        var path = new GraphicsPath();
        path.AddArc(r.Left,r.Top,d,d,180,90);
        path.AddArc(r.Right-d,r.Top,d,d,270,90);
        path.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);
        path.AddArc(r.Left,r.Bottom-d,d,d,90,90);
        path.CloseFigure();
        return path;
    }
}

internal sealed class ActionButton : Button
{
    public bool Primary;
    private bool hover;
    public ActionButton(string text, bool primary)
    {
        Text = text; Primary = primary;
        Cursor = Cursors.Hand;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        DoubleBuffered = true;
    }
    protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new RectangleF(1,1,Width-3,Height-3);
        Color color = !Enabled ? Color.FromArgb(39,37,46) : Primary ?
            (hover ? Color.FromArgb(151,177,255) : Color.FromArgb(128,157,255)) :
            (hover ? Color.FromArgb(56,48,69) : Color.FromArgb(30,36,49));
        using (var path = Rounded.Path(rect,9))
        using (var fill = new SolidBrush(color))
        using (var edge = new Pen(Focused ? Color.White : Primary ? color : Color.FromArgb(65,59,76)))
        {
            e.Graphics.FillPath(fill,path);
            e.Graphics.DrawPath(edge,path);
        }
        TextRenderer.DrawText(e.Graphics, Text, Font, ClientRectangle,
            !Enabled ? Color.Gray : Primary ? Color.FromArgb(27,17,40) : Color.GhostWhite,
            TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter);
    }
}

internal sealed class Launcher : Form
{
    private readonly Installation install;
    private readonly Label status = new Label { AutoSize = false, ForeColor = Color.FromArgb(195,187,205) };
    private readonly ActionButton launch = new ActionButton("Launch",true);
    private readonly ActionButton repair = new ActionButton("Install/Repair",false);
    private readonly ActionButton quit = new ActionButton("Quit",false);
    private bool busy, fadingOut, finished;
    private readonly System.Windows.Forms.Timer fade = new System.Windows.Forms.Timer { Interval = 16 };

    public Launcher(Installation install)
    {
        this.install = install;
        Text = "Relay Control Center";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        AutoScaleDimensions = new SizeF(96,96);
        AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Segoe UI",10);
        ClientSize = new Size(542,297);
        BackColor = Color.FromArgb(14,17,25);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        var wave = new Wave { Bounds = new Rectangle(24,20,494,144) };
        status.SetBounds(27,179,490,47);
        launch.SetBounds(24,233,190,42);
        repair.SetBounds(224,233,185,42);
        quit.SetBounds(419,233,99,42);
        Controls.AddRange(new Control[]{wave,status,launch,repair,quit});
        AcceptButton = launch;
        CancelButton = quit;
        if (SystemInformation.IsMenuAnimationEnabled) Opacity = 0;
        fade.Tick += (s,e) => {
            Opacity = Math.Max(0, Math.Min(1, Opacity + (fadingOut ? -.16 : .12)));
            if (fadingOut && Opacity == 0) { finished = true; fade.Stop(); Close(); }
            else if (!fadingOut && Opacity == 1) fade.Stop();
        };
        FormClosed += (s,e) => fade.Dispose();
        Shown += (s,e) => {
            if (Opacity < 1) fade.Start();
            try { status.Text = install.Find() == null ? "Choose Install/Repair to set up your control center." : "Ready to launch."; }
            catch (IOException) { status.Text = "Choose Install/Repair to restore the control center."; }
        };
        launch.Click += async (s,e) => await Work(false);
        repair.Click += async (s,e) => await Work(true);
        quit.Click += (s,e) => Close();
        FormClosing += (s,e) => {
            if (e.CloseReason != CloseReason.UserClosing || finished) return;
            if (busy) { e.Cancel = true; return; }
            if (SystemInformation.IsMenuAnimationEnabled) { e.Cancel = true; fadingOut = true; fade.Start(); }
        };
    }

    private async Task Work(bool installing)
    {
        if (busy) return;
        busy = true;
        launch.Enabled = repair.Enabled = quit.Enabled = false;
        status.Text = installing ? "Preparing installation…" : "Opening the control center…";
        try
        {
            if (installing)
                await Task.Run(() => install.Repair(message => Invoke(new Action(() => status.Text = message))));
            else await Task.Run(() => install.Launch());
            status.Text = installing ? "Installation verified. Choose Launch to open the control center." : "Control center opened.";
        }
        catch (Exception exc)
        {
            status.Text = installing ? "Installation could not finish. You can retry Install/Repair." : "Unable to launch. Choose Install/Repair to restore the app.";
            string detail = exc.Message;
            if (installing && File.Exists(install.LogPath)) detail += "\n\nRepair log:\n"+install.LogPath;
            MessageBox.Show(this,detail,Text,MessageBoxButtons.OK,MessageBoxIcon.Information);
        }
        finally { busy = false; launch.Enabled = repair.Enabled = quit.Enabled = true; }
        if (!installing && status.Text == "Control center opened.") Close();
    }
}
