# Permanent default avatar (approved, locked)

The sole approved default member avatar is the exact user-approved studio portrait JPEG of the man in a navy suit. It is **not** one of the twelve ministry editorial portraits. All ordinary users without an uploaded photograph should use `/assets/heavenly-key-permanent-default-avatar.jpg`; genuine user photos take precedence. No rotation or substitution.

The frontend is configured for this exact path, and the previous SVG remains an emergency fallback until the approved binary is uploaded. **Important: the binary image is not included in this GitHub commit.** Upload the exact approved JPEG to `global-community/public/assets/heavenly-key-permanent-default-avatar.jpg` before deploying, then verify the file returns HTTP 200 and displays correctly for visitors and members. Do not claim installation complete until then.
