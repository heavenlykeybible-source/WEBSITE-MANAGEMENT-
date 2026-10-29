import SwiftUI
import WebKit
import UIKit

@main
struct HeavenlyKeyApp: App {
    var body: some Scene {
        WindowGroup {
            HeavenlyKeyWebView()
                .ignoresSafeArea(edges: .bottom)
        }
    }
}

/// Native application shell. Reading public content does not require a ministry login.
/// Each protected member service remains responsible for its own authentication.
struct HeavenlyKeyWebView: UIViewRepresentable {
    private let homeURL = URL(string: "https://apps.heavenlykey.org/experience.html")!

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: homeURL, cachePolicy: .useProtocolCachePolicy))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url,
                  let scheme = url.scheme?.lowercased() else {
                decisionHandler(.cancel)
                return
            }

            // Keep only Account 5 pages inside the native shell.
            // Hand installer links to Safari; WKWebView must not pretend to install an IPA.
            let firstParty = scheme == "https"
                && url.host?.lowercased() == "apps.heavenlykey.org"
                && url.user == nil && url.password == nil
            if firstParty && !url.path.hasPrefix("/api/native-download/") {
                decisionHandler(.allow)
                return
            }

            decisionHandler(.cancel)
            guard ["https", "mailto", "tel"].contains(scheme),
                  (scheme != "https" || (url.host != nil && url.user == nil && url.password == nil)) else {
                return
            }
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }

        func webView(
            _ webView: WKWebView,
            didReceive challenge: URLAuthenticationChallenge,
            completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
        ) {
            // Use iOS system trust evaluation, never bypass certificate failures.
            completionHandler(.performDefaultHandling, nil)
        }
    }
}
