using System;
using System.Diagnostics;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace HeavenlyKeyWindows;

public partial class MainWindow : Window
{
    private const string Home = "https://apps.heavenlykey.org/experience.html";

    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) =>
        {
            try
            {
                await Browser.EnsureCoreWebView2Async();
                Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
                Browser.CoreWebView2.Settings.IsScriptEnabled = true;
                Browser.CoreWebView2.NavigationStarting += NavigationStarting;
                Browser.CoreWebView2.NewWindowRequested += NewWindowRequested;
                Browser.CoreWebView2.DownloadStarting += DownloadStarting;
                Browser.CoreWebView2.Navigate(Home);
            }
            catch (Exception)
            {
                MessageBox.Show(
                    "The Microsoft Edge WebView2 Runtime is required. Install it from Microsoft's official website.",
                    "Heavenly Key", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        };
    }

    private static bool IsFirstParty(string text)
    {
        return Uri.TryCreate(text, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && uri.Host.Equals("apps.heavenlykey.org", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrEmpty(uri.UserInfo)
            && !uri.AbsolutePath.StartsWith("/api/native-download/", StringComparison.OrdinalIgnoreCase);
    }

    private static void OpenInSystemBrowser(string text)
    {
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri)) return;
        bool allowed = uri.Scheme == Uri.UriSchemeHttps
            && !string.IsNullOrEmpty(uri.Host)
            && string.IsNullOrEmpty(uri.UserInfo);
        if (!allowed) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch (Exception) { /* The system may not have a browser configured. */ }
    }

    private void NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (IsFirstParty(e.Uri)) return;
        e.Cancel = true;
        OpenInSystemBrowser(e.Uri);
    }

    private void NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        OpenInSystemBrowser(e.Uri);
    }

    private void DownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        // Never auto-save an unreviewed attachment from an embedded browser.
        e.Cancel = true;
        string url = e.DownloadOperation.Uri;
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && uri.Host.Equals("apps.heavenlykey.org", StringComparison.OrdinalIgnoreCase)
            && uri.AbsolutePath.StartsWith("/api/native-download/", StringComparison.OrdinalIgnoreCase))
            OpenInSystemBrowser(url);
    }
}
