# Planned Feature: VIP Personal Contact Recognition

**Status: PLANNED — not implemented or connected to a messaging provider.**

## Owner's requested behaviour

The owner will maintain a private list of trusted contacts. Each entry contains a person's display name and phone number. When a recognised contact sends a message through the connected messaging channel, the system should:

1. Match the verified sender phone number to the saved contact.
2. Send one brief, personalised welcome, for example: "Welcome, Mr Susupesi. It is a pleasure to hear from you."
3. Deliver the incoming message directly to the owner in the normal inbox.
4. Bypass the ordinary chatbot intake questions and "I want to talk" protocol.
5. Let the owner take over and chat normally. The AI must not interrupt or send competing replies while owner takeover is active.

Unknown contacts continue through the existing standard greeting and intake flow.

## Planned owner controls

- Owner-only contact management: add, edit, disable and delete a VIP contact.
- Store phone numbers in canonical E.164 format; validate country code and avoid matching on display names.
- Allow a per-contact greeting override, with a safe default greeting.
- Show the recognised contact name and a VIP indicator in the inbox.
- Provide an explicit "AI paused / owner replying" state and an explicit way for the owner to return a conversation to automation.
- Prevent duplicate greetings when a provider retries the same webhook event.
- Keep an audit trail of contact-list changes and message-routing decisions without logging message secrets or provider tokens.

## Security and privacy requirements

- Authenticate and verify inbound provider webhooks using the provider's official signature mechanism.
- Never trust a phone number supplied in message text or an unverified client field; use the provider-authenticated sender identity.
- Protect the VIP directory with owner/admin authorization, CSRF/origin protections, rate limits and private storage.
- Encrypt provider credentials as secrets; never place access tokens in browser code, logs, source control or D1 plaintext.
- Collect and retain only the contact information needed for this feature; provide deletion and retention controls.
- Fail safely: if identity verification or contact lookup fails, do not grant VIP bypass privileges.
- Do not send unsolicited outbound messages. Respect channel/provider consent, template and messaging-window rules.

## Integration prerequisites

- Owner selects and approves the messaging channel (WhatsApp Business Platform is the initial proposed option, not yet confirmed).
- Owner supplies/authorizes the official business account, phone number, app credentials and webhook configuration through secure provider setup.
- Implement a provider adapter, verified webhook endpoint, message delivery, inbox handoff and delivery/retry handling.
- Add D1 schema and migrations only after the existing messaging architecture and deployment environment are confirmed.
- Test verified VIP matching, unknown senders, duplicate webhook delivery, owner takeover, AI pause/resume, provider outages and contact deletion.

## Acceptance criteria

- A saved VIP phone number receives the correct personalised greeting exactly once per new inbound conversation (according to an explicitly defined conversation window).
- The original incoming message is visible to the owner without the user completing chatbot intake.
- Owner replies are delivered through the connected channel.
- The AI sends no reply while owner takeover is active.
- An unknown or unverified sender cannot obtain VIP treatment.
- Only authorized administrators can manage the VIP list.
- Provider secrets and contact data are not exposed to public clients.
- Automated tests and real provider staging tests pass before release.

## Scope note

This is a future roadmap item only. No WhatsApp integration, VIP contact database, webhook, automatic greeting or inbox takeover has been implemented by this document. Do not describe the feature as available until code, provider setup and end-to-end tests are complete.
