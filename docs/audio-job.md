# Background Audio Transcription Job

Fetching chat history can be slow when every audio message is transcribed on the fly. A new
background job processes audio attachments after history download.

## Behaviour
- `fetchHistory` now stores media without transcribing.
- `audioJob.startProcessing()` scans the database for audio attachments lacking a transcript
  and processes them one by one using Whisper.
- The job can be paused or resumed via the dashboard:
  - `POST /asr/start` – resume processing
  - `POST /asr/pause` – pause processing
  - `GET /asr/status` – check if the job is running

The language used for transcription is controlled by the new `asrLanguage` option in
`config.json`. Set it to `auto` to let Whisper detect the language.
