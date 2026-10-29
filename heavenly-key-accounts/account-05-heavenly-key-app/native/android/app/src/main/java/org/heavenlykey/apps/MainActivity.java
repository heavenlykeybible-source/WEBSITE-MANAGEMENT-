package org.heavenlykey.apps;

import android.app.Activity;
import android.os.Bundle;
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
  if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
   settings.setSafeBrowsingEnabled(true);
  }
  settings.setJavaScriptCanOpenWindowsAutomatically(false);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  CookieManager.getInstance().setAcceptThirdPartyCookies(browser,false);
  browser.setWebChromeClient(new WebChromeClient());
  browser.setWebViewClient(new WebViewClient() {
   @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
    handler.cancel();
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
    Uri url=request.getUrl();
    String host=url.getHost();
    if("https".equalsIgnoreCase(url.getScheme()) && host!=null && (host.equals("heavenlykey.org")||host.endsWith(".heavenlykey.org"))) return false;
    if (!request.isForMainFrame()) return true;
    if (!"https".equalsIgnoreCase(url.getScheme()) && !"mailto".equalsIgnoreCase(url.getScheme()) && !"tel".equalsIgnoreCase(url.getScheme())) return true;
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
