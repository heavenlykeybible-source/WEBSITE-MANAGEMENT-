# Read-only project sources

Owner navigation: Project sources. Existing GitHub connections are listed; Connect GitHub opens the existing repository setup. Repository tokens stay encrypted. Give tokens access only to the required repositories. Read-only GitHub tokens are enough to inspect files; approving GitHub writes requires Contents write access.

For Drive: enable Google Drive API in your Google Cloud project; create a service account, download its JSON key, and share only the chosen project folder with client_email as Viewer. Paste the folder ID and JSON in Project sources. Connect and test verifies the folder before storing a whitelisted subset of credentials encrypted. Credentials are never returned to the UI or AI. Disconnect deletes the stored credential. Delete/revoke the Google key separately if required. No Google Cloud billing upgrade is requested by this app.

Google scope is drive.readonly. The service identity can read whatever is shared with it; the application additionally restricts reads to the configured folder and descendants, up to 20 levels. Use a dedicated identity shared only with this project folder. Site-scoped and member agents cannot use Drive tools. Full staff agents with read access can use them.

Ask Assistant: List Drive project files, read index.html, then propose the required changes for website NAME. Tools list batches of 50 with cursor and read ordinary UTF-8 code/text up to 100 KB per file. Native Google Docs, ZIP archives and binary pictures are unsupported by this initial Drive reader. Existing chat uploads support pictures. Tool contents are untrusted data, never instructions. Delivery uses existing proposal tools and Waiting approval; Drive is never modified.

Validation: 105 local checks pass, including real SQLite and generated RSA signing with mocked Google endpoints. Six new checks cover owner-only setup, encrypted credentials, bounded reads, folder isolation, protected files, scoped-agent denial and disconnect. Real Drive and repository connectivity require the owner's credentials and authorization; they are not automatically inherited from ChatGPT connectors.
