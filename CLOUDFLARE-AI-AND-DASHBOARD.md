# Built-in Cloudflare AI and review dashboard

The app now includes a native Workers AI binding named AI. Enable it with CLOUDFLARE_AI_ENABLED=true. It defaults to the fixed model @cf/meta/llama-3.3-70b-instruct-fp8-fast, which supports function calling. No OpenAI key is required; there is no automatic paid-model fallback. Cloudflare AI is available to staff; member workspaces retain their own separately configured providers.

Cloudflare's 10,000-Neuron free allocation is AI compute, not website visits or 10,000 messages. It is shared across the Cloudflare account and resets at 00:00 UTC (1:00 am Africa/Lagos). On Workers Free, inference stops when the daily allowance is exhausted. Website requests, D1 and R2 have their own quotas. The app also limits staff to 40 chat messages daily, 900 output tokens per inference, four tool actions per message, and bounded context. This message guard is separate from Neurons; it does not estimate or report an exact remaining Neuron balance. Other applications in the same account can consume the allocation too. Do not upgrade the account or enable paid models without a spending decision by the owner.

The assistant reads connected sites using existing scoped tools and submits proposed changes to Waiting. It cannot approve, publish, change permissions, or run arbitrary shell commands. Cloudflare maintenance bypass tools are excluded from this built-in assistant. The full staged review retains owner reauthentication, immutable candidate hashes, revision checks, preview requirements and publication records.

The login and dashboard use royal blue, wine red, yellow accents and dark text. Desktop navigation is grouped in a side panel; phone navigation scrolls horizontally. Waiting items are expandable rows with submitter, destination, proposal version, created and sent/received times, a visual preview where supported, and access to the full approval screen. Worker source proposals show source review, not a simulated runtime deployment. File previews retain their sandbox. SQLite timestamps are interpreted as UTC and displayed in Africa/Lagos. Uploaded-file submissions record a received timestamp when finalized; existing proposals use their recorded creation timestamp as a fallback. Sent/received is the server submission event, not separately measured sender transport time.

Direct human editing routes elsewhere in the existing system retain their earlier behavior; this release's approval guarantee covers AI proposals and queued uploads. This dashboard does not disable third-party editors or Cloudflare/GitHub access outside the application.

Local validation: run `node tests/run.mjs`. Tests cover native Cloudflare tool outputs, default account selection, staff/member isolation, quota failures, action limits, proposal-only edits, queue metadata and Lagos dates, plus existing security/release/account tests.

Official references:
https://developers.cloudflare.com/workers-ai/platform/pricing/
https://developers.cloudflare.com/workers-ai/configuration/bindings/
https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
