# Account 10 SocialPlus — planned feature requirements

## VIP Contact Auto-Welcome

**Status:** Planned; not implemented or enabled.

### Purpose
Allow the account owner to maintain a private allowlist of important contacts. When a listed phone number sends an inbound message through a supported, connected messaging channel, SocialPlus sends one short personalised welcome and delivers the original message to the owner's normal inbox without forcing the sender through the standard AI/customer-service protocol.

### Owner-managed contact record
- Phone number in canonical international format (E.164).
- Display name.
- Optional title or form of address (for example, Mr, Mrs, Pastor, Evangelist or Bishop).
- Optional per-contact welcome text; otherwise use the owner's configured default.
- Enabled/disabled state and audit metadata.

### Required message flow
1. Verify the inbound event using the provider's signature/authentication mechanism.
2. Normalise the sender's phone number and perform an exact match against enabled VIP records.
3. Persist and deliver the original inbound message to the owner's inbox immediately; the greeting must not block, replace, suppress or delay delivery.
4. Send the configured greeting once per conversation/window, subject to provider policy, consent and message-template rules.
5. Bypass ordinary bot menus, intent classification, "I want to talk" steps and automated customer-service routing for that VIP interaction.
6. Leave all subsequent conversation replies under the owner's normal manual control unless the owner explicitly enables another behaviour.

### Safety, privacy and reliability requirements
- Never match by display name alone; phone number is the primary identifier.
- Do not expose the VIP list to public clients or unauthorised staff.
- Encrypt or otherwise protect stored contact data; enforce least-privilege access and audit add/edit/disable/delete actions.
- Make greeting deduplication idempotent so webhook retries do not send duplicate welcomes.
- If greeting delivery fails, preserve and deliver the original inbound message; show a retryable status to the owner without blocking the inbox.
- Provide a per-contact and global pause switch.
- Respect channel-specific consent, opt-out, business-initiated messaging windows, approved templates and rate limits. Never send a greeting where provider policy prohibits it.
- Do not automatically send repeated greetings for every message in the same active conversation. Make the greeting frequency/window configurable by the owner.
- Record delivery status and errors without logging message secrets or unnecessary personal data.

### Acceptance tests
- A saved VIP number receives the correct personalised greeting.
- An unknown number follows the ordinary customer-service flow.
- A VIP message reaches the owner inbox even when greeting delivery fails or times out.
- A VIP does not encounter bot menus or the "I want to talk" protocol.
- Duplicate webhook delivery does not create duplicate greetings.
- Disabled/deleted VIP records no longer trigger greetings.
- International number formatting variations normalise to the same exact E.164 identity.
- Unauthorized users cannot read or modify VIP records.
- Provider policy, consent and opt-out restrictions are enforced for every supported channel.

### Dependencies and release gate
Implementation depends on confirming the supported messaging channels, provider webhook/send APIs, owner authentication and authorisation, contact-data retention policy, and provider policy constraints. Build and test in staging before enabling for production. This feature is not part of the current launch claim and must not be represented as implemented until code, provider integration and acceptance tests are complete.
