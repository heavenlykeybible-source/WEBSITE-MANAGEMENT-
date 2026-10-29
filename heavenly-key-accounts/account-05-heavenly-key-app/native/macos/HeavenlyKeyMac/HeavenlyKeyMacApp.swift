import SwiftUI
import WebKit
import AppKit

@main
struct HeavenlyKeyMacApp: App {
    var body: some Scene {
        WindowGroup {
            HeavenlyKeyMacBrowser()
                .frame(minWidth: 800, minHeight: 550)
        }
    }
}

struct HeavenlyKeyMacBrowser: NSViewRepresentable {
    private let home = URL(string: "https://apps.heavenlykey.org/experience.html")!

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let browser = WKWebView(frame: .zero, configuration: configuration)
        browser.navigationDelegate = context.coordinator
        browser.allowsBackForwardNavigationGestures = true
        browser.load(URLRequest(url: home))
        return browser
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

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
            let trusted = scheme == "https"
                && url.host?.lowercased() == "apps.heavenlykey.org"
                && url.user == nil && url.password == nil
            if trusted && !url.path.hasPrefix("/api/native-download/") {
                decisionHandler(.allow)
                return
            }
            decisionHandler(.cancel)
            if ["https", "mailto", "tel"].contains(scheme)
                && (scheme != "https" || (url.host != nil && url.user == nil && url.password == nil)) {
                NSWorkspace.shared.open(url)
            }
        }
    }
}
