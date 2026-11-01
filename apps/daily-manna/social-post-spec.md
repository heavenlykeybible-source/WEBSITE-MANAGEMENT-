# Daily Manna social post design and automation contract

## Visual format
Use a reusable ultra-wide, shallow topic banner at the beginning of every social post. Suggested design canvas: 1200 x 240 pixels (5:1), but platform-specific previews can crop it. Keep essential title text in a centered safe area and test Facebook previews before selecting the final dimensions. Place the devotional body in the native post caption/text beneath the image, not inside the image.

## Image precedence
1. A dated, owner-approved override image for that devotional.
2. Otherwise the owner's uploaded default Daily Manna image, unchanged.
3. If image rendering or upload fails, do not falsely mark the social delivery as sent; retry or record the failure.

## Post structure
Banner image; topic/title; scripture reference; devotional text; prayer; link to the public Daily Manna page. The exact caption length and any link placement must be adjusted per platform limits.

## Scheduling and permissions
At Africa/Lagos midnight, publish the website entry according to the configured publication policy, then queue social delivery independently. Facebook Page posting must use a valid Page-authorized integration with the necessary permissions. Other channels require their own authorized connections. Deliveries must be idempotent, retried with backoff and logged by date, channel, status, and provider post ID. Do not claim an outbox row is a successfully posted Facebook item.

## Editorial safeguards
Record whether an entry was manually approved or automatically released. Retain original and corrected versions. Editing a published devotional should update the public website, but social posts already published will require a separate supported provider edit/repost workflow. The five-year source collection contains unresolved verification flags: do not activate unattended distribution of those entries until their publication eligibility has been explicitly resolved.

## Implementation status
Specification only. The image renderer, social media authentication, delivery sender, platform-specific formatting, and live end-to-end tests are not yet implemented.

## Owner image upload controls
Provide an image-upload field in the Account 4 posting flow: upload or replace default picture, upload or replace selected-day picture, preview, remove day override, and show the image selected for the post. Preserve the original uploaded picture without AI editing. Store images in a private/managed R2 bucket and publish only validated media URLs; allow PNG, JPEG or WebP and enforce file-size limits. Upload UI is not equivalent to completed R2 storage and delivery integration.
