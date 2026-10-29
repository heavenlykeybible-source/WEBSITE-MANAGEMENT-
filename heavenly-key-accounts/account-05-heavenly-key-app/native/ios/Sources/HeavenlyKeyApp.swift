import SwiftUI
import WebKit

@main
struct HeavenlyKeyApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                ResourcesView().tabItem { Label("Resources", systemImage: "books.vertical") }
                JournalView().tabItem { Label("My Notes", systemImage: "note.text") }
                PrayerView().tabItem { Label("Prayer", systemImage: "hands.sparkles") }
            }.tint(Color(red: 0.39, green: 0.08, blue: 0.18))
        }
    }
}

struct Resource: Identifiable {
    let id: String
    let title: String
    let symbol: String
    let address: String
}
struct ResourcesView: View {
    @State private var selected: Resource?
    private let resources = [
        Resource(id: "bible", title: "Authorised King James Version", symbol: "book.closed", address: "https://apps.heavenlykey.org/bible.html"),
        Resource(id: "walk", title: "My Walk With God", symbol: "figure.walk", address: "https://apps.heavenlykey.org/walk-offline.html"),
        Resource(id: "study", title: "Bible Study in My Walk With God", symbol: "books.vertical", address: "https://apps.heavenlykey.org/walk-offline.html#walk-bible-study"),
        Resource(id: "eternity", title: "Eternity in View", symbol: "sun.max", address: "https://apps.heavenlykey.org/eternity-in-view/"),
        Resource(id: "community", title: "Global Christian Social Network", symbol: "person.3", address: "https://global.heavenlykey.org"),
        Resource(id: "radio", title: "Heavenly Key Radio", symbol: "radio", address: "https://radio.heavenlykey.org")
    ]
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Taking Christ to the nations of the world.").font(.headline)
                    Text("Bible, discipleship and fellowship. Your notes and prayer list are saved on this device.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Section("Ministry resources") {
                    ForEach(resources) { resource in
                        Button { selected = resource } label: {
                            Label(resource.title, systemImage: resource.symbol).padding(.vertical, 8)
                        }
                    }
                }
            }.navigationTitle("Heavenly Key")
             .sheet(item: $selected) { resource in ResourceBrowser(resource: resource) }
        }
    }
}
struct ResourceBrowser: View {
    let resource: Resource
    @Environment(\.dismiss) private var dismiss
    @State private var reload = UUID()
    @State private var failed = false
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if failed {
                    VStack {
                        Text("Unable to load this resource. Check your connection.")
                        Button("Try Again") { failed = false; reload = UUID() }
                    }.padding()
                }
                MinistryWebView(url: URL(string: resource.address)!, failed: $failed).id(reload)
            }.navigationTitle(resource.title).navigationBarTitleDisplayMode(.inline)
             .toolbar {
                 ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                 ToolbarItem(placement: .primaryAction) { ShareLink(item: URL(string: resource.address)!) }
             }
        }
    }
}
struct MinistryWebView: UIViewRepresentable {
    let url: URL
    @Binding var failed: Bool
    func makeCoordinator() -> Coordinator { Coordinator(failed: $failed) }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.load(URLRequest(url: url))
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var failed: Bool
        init(failed: Binding<Bool>) { _failed = failed }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code != NSURLErrorCancelled { failed = true }
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code != NSURLErrorCancelled { failed = true }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            let host = url.host?.lowercased() ?? ""
            if url.scheme == "https" && (host == "heavenlykey.org" || host.hasSuffix(".heavenlykey.org")) {
                if navigationAction.targetFrame == nil { webView.load(URLRequest(url: url)); decisionHandler(.cancel) }
                else { decisionHandler(.allow) }
            } else {
                if navigationAction.targetFrame?.isMainFrame != false &&
                    ["https", "mailto", "tel"].contains(url.scheme ?? "") {
                    UIApplication.shared.open(url)
                }
                decisionHandler(.cancel)
            }
        }
    }
}
struct JournalView: View {
    @AppStorage("hkem.native.journal.v1") private var journal = ""
    @State private var confirmClear = false
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading) {
                Text("Scripture notes and reflections").font(.headline)
                TextEditor(text: $journal).accessibilityLabel("My scripture notes")
                Text("Saved automatically on this device.").font(.caption).foregroundStyle(.secondary)
            }.padding().navigationTitle("My Notes")
             .toolbar {
                 ToolbarItem(placement: .primaryAction) { ShareLink(item: journal) }
                 ToolbarItem(placement: .secondaryAction) {
                     Button("Clear Notes", role: .destructive) { confirmClear = true }
                 }
             }.confirmationDialog("Delete all notes on this device?", isPresented: $confirmClear, titleVisibility: .visible) {
                 Button("Delete Notes", role: .destructive) { journal = "" }
             }
        }
    }
}
struct PrayerItem: Identifiable, Codable {
    var id = UUID()
    var text: String
    var answered = false
}
struct PrayerView: View {
    @AppStorage("hkem.native.prayers.v1") private var stored = Data()
    @State private var items: [PrayerItem] = []
    @State private var draft = ""
    @State private var storageError = false
    @State private var showStorageError = false
    private func save() {
        guard let data = try? JSONEncoder().encode(items) else { storageError = true; return }
        stored = data
    }
    var body: some View {
        NavigationStack {
            List {
                Section("Add a prayer") {
                    TextField("Prayer request", text: $draft, axis: .vertical)
                    Button("Save Prayer") {
                        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !text.isEmpty else { return }
                        items.append(PrayerItem(text: text)); draft = ""; save()
                    }.disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || storageError)
                }
                Section("My prayers") {
                    ForEach(items) { item in
                        Button {
                            guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
                            items[index].answered.toggle(); save()
                        } label: {
                            Label(item.text, systemImage: item.answered ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(item.answered ? .secondary : .primary)
                        }.accessibilityHint("Toggle answered")
                    }.onDelete { offsets in
                        guard !storageError else { return }
                        items.remove(atOffsets: offsets); save()
                    }
                }
                Text("Saved on this device. Deleting the app removes local notes and prayers.")
                    .font(.caption).foregroundStyle(.secondary)
            }.navigationTitle("Prayer")
             .onAppear {
                 guard !stored.isEmpty else { return }
                 do { items = try JSONDecoder().decode([PrayerItem].self, from: stored) }
                 catch { storageError = true; showStorageError = true }
             }.alert("Saved prayers could not be read. They have been preserved.", isPresented: $showStorageError) {
                 Button("OK") {}
             }
        }
    }
}
