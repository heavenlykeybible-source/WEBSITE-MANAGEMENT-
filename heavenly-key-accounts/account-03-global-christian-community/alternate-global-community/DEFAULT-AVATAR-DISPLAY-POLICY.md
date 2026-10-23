# Default-avatar display policy

- Visitors who are not signed in see one of twelve rotating, AI-generated sample portraits, changing on refresh after each 30-minute interval when the assets are installed.
- Once signed in, a member no longer sees a rotating sample person's portrait. If a genuine profile photo URL is present, display that photo.
- If the signed-in member has no profile photo, show a neutral illustrated placeholder rather than another fictional person's face or a blank avatar.
- This is a UI rule; uploaded-photo storage and the twelve photo assets must be validated separately before production deployment.
