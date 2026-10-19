# Spiritual Media Workflow

## Bible Audio

Use the Media Library to upload an approved MP3/audio file. After the media object is stored and approved, an Administrator attaches it to a Bible chapter with:

`POST /api/admin/bible/audio`

Body: `{ "chapterId": 123, "mediaId": 456, "durationSeconds": 1800, "sourceLabel": "Heavenly Key Ministry Library" }`

Public listing: `GET /api/bible/audio?chapterId=123`.

## Hymn Audio / Video

Upload an approved MP3 or MP4 through the Media Library, approve it, then attach it to a hymn:

`POST /api/admin/hymns/{hymnId}/media`

Body: `{ "mediaId": 456 }`

Public hymn listing returns a playback URL only when the attached object is stored, published and approved.

## Prayer Audio

Prayer audio uses the existing Media Library with `file_type=audio` and `topic=prayer`. The public prayer-audio feed returns the internal playback URL. No random third-party audio source is selected.

## Resource policy

Do not bypass the Media Library with arbitrary `audio_file_url` or external playback URLs. Those legacy fields remain for compatibility but are not used by the public playback services.
