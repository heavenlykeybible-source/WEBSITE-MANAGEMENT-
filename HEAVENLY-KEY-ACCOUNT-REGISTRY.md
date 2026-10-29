# Heavenly Key — Official Account Registry

This is the approved account mapping. Account numbers refer to Heavenly Key projects, not necessarily the numeric IDs shown by a connector.

| Account | Project | Owner email |
|---|---|---|
| 1 | Main Heavenly Key / Home Page | alldaywow247@gmail.com |
| 2 | Studio / Media | faithofourfatherstv@gmail.com |
| 3 | Global Christian Community | aoemeta247@gmail.com |
| 4 | Main Control Room | emmanuel2026miracle@gmail.com |
| 5 | Heavenly Key App | heavenlykeyapp@gmail.com |
| 6 | Heavenly Key Bible | heavenlykeybible@gmail.com |
| 7 | Heavenly Key Radio | heavenlykeyradio@gmail.com |
| 8 | [Heavenly Key MeetingSpace](heavenly-key-accounts/account-08-heavenly-key-meetingspace/README.md) | omegawealthcreator@gmail.com |
| 9 | Heavenly Key VideoEditor | emmanuelmeta247@gmail.com |

## Deployment safeguards

- Account 2 is the Studio / Media broadcasting engine; it is not the Radio website deployment target.
- Account 7 is the dedicated Radio website, intended for radio.heavenlykey.org.
- Account 8 is MeetingSpace, **not** Radio.
- Account 9 is VideoEditor.
- Account 4 is the Control Room, not required for direct Radio deployment.
- A connector label such as `Account 7 Meeting App` is ambiguous and does not prove which Cloudflare account it accesses. Verify the actual Cloudflare account ID before deploying.
- This registry records approved ownership and does not assert that any application is deployed or operational.

## Account 8 source and navigation

MeetingSpace is already in this repository at [`Account 8 / source`](heavenly-key-accounts/account-08-heavenly-key-meetingspace/source/README.md). The [Account 8 folder](heavenly-key-accounts/account-08-heavenly-key-meetingspace/README.md) is its permanent entry alongside the other accounts. The old `account-08-unverified` label is obsolete. The website is https://meetingspace.heavenlykey.org and the dedicated Worker is `heavenly-key-meetingspace`. Source identified does not mean production verified.
