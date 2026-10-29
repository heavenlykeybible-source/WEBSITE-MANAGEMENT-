package org.heavenlykey.apps;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.CookieManager;
import android.view.ViewGroup;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;


public final class MainActivity extends Activity {
 private WebView browser;
 private static final String START = "https://apps.heavenlykey.org/experience.html";
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  browser = new WebView(this);
  setContentView(browser,new ViewGroup.LayoutParams(-1,-1));
  WebSettings settings=browser.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);
  settings.setAllowContentAccess(false);
  settings.setAllowFileAccessFromFileURLs(false);
  settings.setAllowUniversalAccessFromFileURLs(false);
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
  settings.setJavaScriptCanOpenWindowsAutomatically(false);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  CookieManager.getInstance().setAcceptThirdPartyCookies(browser,false);
  // WebView does not handle attachment downloads automatically. Give verified
  // Account 5 native installers to the user's system browser without adding
  // broad storage permissions or silently fetching untrusted content.
  browser.setDownloadListener((downloadUrl, userAgent, disposition, mime, length) -> {
   try {
    Uri target=Uri.parse(downloadUrl);
    if (!"https".equalsIgnoreCase(target.getScheme()) ||
        !"apps.heavenlykey.org".equalsIgnoreCase(target.getHost()) ||
        target.getUserInfo()!=null ||
        !target.getPath().matches("^/api/native-download/[a-z0-9-]{1,64}/android$")) return;
    startActivity(new Intent(Intent.ACTION_VIEW,target).addCategory(Intent.CATEGORY_BROWSABLE));
   } catch(Exception ignored) { }
  });
  browser.setWebChromeClient(new WebChromeClient());
  browser.setWebViewClient(new WebViewClient() {
   @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
    handler.cancel();
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
    Uri url=request.getUrl();
    String host=url.getHost();
    // Keep only Account 5 pages inside this WebView. Open other ministry
    // services in the device browser so their separate security boundaries remain intact.
    if ("https".equalsIgnoreCase(url.getScheme()) && "apps.heavenlykey.org".equalsIgnoreCase(host) && url.getUserInfo()==null && !url.getPath().startsWith("/api/native-download/")) return false;
    if (!request.isForMainFrame()) return true;
    String scheme = url.getScheme();
    if (!"https".equalsIgnoreCase(scheme) && !"mailto".equalsIgnoreCase(scheme) && !"tel".equalsIgnoreCase(scheme)) return true;
    if ("https".equalsIgnoreCase(scheme) && (host==null || url.getUserInfo()!=null)) return true;
    try {startActivity(new Intent(Intent.ACTION_VIEW,url));}catch(Exception ignored){}
    return true;
   }
  });
  browser.loadUrl(START);
 }
 @Override public void onBackPressed() {
  if(browser!=null && browser.canGoBack()) browser.goBack();
  else super.onBackPressed();
 }
 @Override protected void onDestroy(){
  if(browser!=null){browser.destroy();browser=null;}
  super.onDestroy();
 }
}
