# Default community portraits — approved rotation

Twelve photo assets must be supplied at `public/assets/default-portraits/avatar-01.jpg` through `avatar-12.jpg` (six men followed by six women). They are currently **not committed**; the browser safely falls back to `default-human-avatar.svg` until the approved crops are installed.

The app assigns a deterministic portrait from the member ID or visitor label and the current 30-minute UTC epoch slot. Reloading within the same slot retains the portrait; the next slot changes it. Different member IDs can receive different portraits. A verified uploaded photo URL overrides the rotating default. These images are fictional AI-generated default avatars and must not imply real member identity.

To finish installation, upload the twelve approved JPEG crops from the original approved portrait board, then test mobile and desktop display. Do not bypass release approvals.
