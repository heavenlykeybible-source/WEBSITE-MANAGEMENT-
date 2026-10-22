# Community unapproved-word filter

The Community uses a deterministic, server-side text filter; this is not an AI feature.

## Configuration

Set the runtime variable `COMMUNITY_BLOCKED_WORDS` on the hosting platform. Enter the words and phrases that the ministry has approved for blocking, separated by commas, semicolons, or new lines. Example for a local test only:

```text
sampleblockedword;sample blocked phrase
```

Do not use the sample terms as the ministry's actual policy list. No ministry-specific list was supplied, so this repository does not invent one.

## Behaviour

- Checks text before it is saved for profiles, posts, post edits, comments/replies, messages, Groups, Spaces, Prayer Circles, prayer requests and prayer updates wherever the existing moderation service is called.
- Matches case-insensitively and tolerates punctuation or whitespace inserted between letters.
- Uses word boundaries to avoid blocking a term merely because it appears inside a longer unrelated word.
- A match is blocked server-side and recorded in the existing moderation queue. It does not depend on browser-side validation.
- Existing non-AI safety rules remain in place. A normal Bible verse or ordinary Christian discussion is not blocked unless it matches a term the owner configured.

## Deployment note

The variable is optional in the code and must be set in the chosen hosting environment for the ministry's custom word list to take effect. This code change does not change Cloudflare production settings, deploy the site, or add a word list on the ministry's behalf. Test the approved list against sample content before enabling it for members.
