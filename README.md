# CLIPFORGE AI

A full-stack, working **livestream → vertical shorts** platform. Paste an accessible video URL or upload an authorized recording; the app transcribes it locally, scores highlight moments, and renders real 1080×1920 MP4 clips with facecam-aware framing, word-by-word captions, title bars and normalized audio.

> Only process content you are authorized to edit. CLIPFORGE does not bypass YouTube restrictions, logins, geo-blocks or DRM. A stream that is still live must be finished (or provided as an accessible recorded segment) before it can be processed.

---

## What is actually implemented

| Feature | Status | How it works |
| --- | --- | --- |
| Landing page, auth, dashboard, projects | ✅ | Next.js App Router, Tailwind, Framer Motion, Lucide |
| Upload / URL import with metadata | ✅ | Multipart upload to local or S3-compatible storage; `yt-dlp -J` metadata lookup |
| Speech-to-text | ✅ | `faster-whisper` (tiny/base), local, word-level timings, no API key |
| Highlight detection | ✅ | Volume spikes, speech density, scene changes, keyword hooks, modular picker |
| Vertical rendering | ✅ | FFmpeg complex filters: stack / crop / blur layouts, ASS karaoke captions, title bar, `loudnorm` -14 LUFS, H.264/AAC 1080×1920 |
| Facecam detection | ✅ | OpenCV YuNet / Haar cascade, normalized `x,y,w,h` override in editor |
| Editor | ✅ | Trim, title, caption colors, layout, facecam position, zoom, speed, **re-render MP4** |
| Export | ✅ | Single MP4 download with HTTP Range, plus ZIP of all clips |
| Projects | ✅ | Create, rename, delete, retry, cancel, history and activity log |
| Background jobs | ✅ | Node job manager spawns Python worker, persists stage/progress/logs in DB, queue with concurrency limit |
| Storage | ✅ | Local filesystem by default; S3-compatible driver using signed requests |
| Auth | ✅ | bcrypt password hashing, JWT in httpOnly cookie, protected pages and APIs |

AI highlight scoring and title generation are heuristic and local by default. The `HIGHLIGHT_PROVIDER` environment variable is reserved for an optional external provider; no API key is ever exposed to the browser.

---

## Requirements

- **Node.js 20+** and npm
- **FFmpeg + ffprobe** on `PATH` (`winget install Gyan.FFmpeg`, `brew install ffmpeg`)
- **Python 3.10+** with these packages: `faster-whisper`, `opencv-python`, `numpy`, `Pillow`
- **yt-dlp** on `PATH` (only needed for URL imports)
- Optional: JavaScript runtime (`node` works) for YouTube downloads

If the [stream-clips skill](https://github.com/) environment is installed at `~/.streamclips`, its Python interpreter, Whisper models, YuNet face model and `yt-dlp` binary are detected automatically. Otherwise set `VIDEO_PYTHON` to your Python path, and models will be downloaded on first use.

---

## Run locally

```bash
cd CLIPFORGE-AI
cp .env.example .env          # Windows: copy .env.example .env
# edit AUTH_SECRET
npm install
npm run db:push
npm run db:seed               # optional demo: demo@clipforge.ai / demo1234
npm run dev
```

Open <http://localhost:3000>.

Build for production:

```bash
npm run build
npm start
```

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run db:generate`.

---

## Deploy for everyone (Render)

Vercel can host the website and admin, but it cannot run the video worker (no Python/FFmpeg, read-only filesystem and short function timeouts). `render.yaml` deploys the complete app: Next.js web service, Postgres database and a background worker that renders queued jobs.

1. Push this folder to a GitHub repository.
2. Create an S3-compatible bucket (Cloudflare R2 has a generous free tier) and note its endpoint, bucket, access key and secret key.
3. In Render, choose **New → Blueprint Instance**, connect the repository and select `render.yaml`.
4. Fill the prompted values: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `ADMIN_EMAILS` (your admin email). `AUTH_SECRET` and `DATABASE_URL` are generated/wired automatically.
5. Open the web service URL (`https://clipforge-ai.onrender.com` by default). If your service name differs, update `NEXT_PUBLIC_APP_URL` in the shared environment group.

The web service runs `prisma db push` on start, so the database schema is created automatically. Anyone can sign up; free accounts get 2 projects and 3 clips per video. Rendering runs in the worker, so closing the browser does not stop a job.

Costs: Postgres has a free tier and R2 is free up to its monthly allowance; the background worker is a paid `0.5c-512mb` service. If Render needs more memory to build the Docker image, raise the web/worker plan.

---

## Environment variables

See `.env.example`. Important ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string. Defaults to SQLite `file:./dev.db` |
| `AUTH_SECRET` | JWT signing secret. Must be long and random |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `STORAGE_ROOT` | Where uploads and clips live when using local storage |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3-compatible configuration |
| `VIDEO_PYTHON` | Python interpreter containing the video/AI dependencies |
| `FFMPEG_BIN`, `FFPROBE_BIN` | Binary names or absolute paths |
| `MAX_CONCURRENT_JOBS` | Worker queue concurrency (default 1) |
| `MAX_UPLOAD_MB` | Upload limit (default 2048) |
| `HIGHLIGHT_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Reserved optional provider; never read in the browser |

### Switching to PostgreSQL

The committed schema uses SQLite so the app runs with zero infrastructure. To use PostgreSQL:

1. Set `DATABASE_URL="postgresql://user:password@host:5432/clipforge?schema=public"` in `.env`.
2. In `prisma/schema.prisma`, change the datasource provider to `postgresql`.
3. Run `npx prisma generate && npx prisma db push`.

The models use only portable Prisma types, so no field changes are required.

### S3-compatible storage

Set `STORAGE_DRIVER=s3` plus the `S3_*` variables. Uploads are written to the bucket; sources are downloaded to a temporary local file for processing and rendered clips are uploaded back. For public URLs, set `S3_PUBLIC_BASE_URL` if you serve clips directly; by default downloads stream through `/api/clips/[id]/file`.

---

## Architecture

```
src/
  app/
    (auth)/login, signup             authentication screens
    (app)/dashboard, projects…       authenticated app pages
    api/auth, projects, clips, …     real REST APIs
  components/                        UI and client interactivity
  lib/                               db, auth, storage, zip, validation, utils
  server/jobs.ts                     background job manager + FFmpeg render orchestration
python/cf_worker.py                  transcription, highlight picking, FFmpeg rendering
prisma/schema.prisma                 User, UserSettings, Project, Clip
storage/                             generated at runtime (gitignored)
```

The worker emits newline-delimited JSON (`progress`, `log`, `moments`, `done`, `error`). The job manager parses it, updates Prisma, and the processing screen polls `/api/projects/[id]/status` for live progress. Jobs survive page navigation; a server restart marks orphaned jobs as failed so they can be retried safely.

### Processing pipeline

1. Ingest: local file or `yt-dlp` audio download. For URLs, the worker analyzes the first 30 minutes by default (`--max-source-seconds`) so streams finish quickly; ongoing live broadcasts are rejected until recorded.
2. `faster-whisper` transcribes the analyzed audio with word timings.
3. Energy curve (dB above local baseline), speech density, scene changes and hook keywords are combined into a score; the best non-overlapping windows are selected.
4. For each window, FFmpeg extracts the segment, detects the face, builds a 9:16 layout, burns karaoke ASS captions and a title bar, normalizes audio and encodes H.264/AAC at 1080×1920.
5. Thumbnails and metadata are saved; clips appear in the project and can be previewed, edited and downloaded.

---

## User journey

1. Sign up (or use the demo account).
2. **New project** → paste a URL or upload a video, set the topic.
3. **Generate Clips** → watch live progress in the processing screen.
4. **Generated clips** → preview and download individual MP4s or the whole ZIP.
5. **Editor** → trim, restyle captions, move the facecam, change zoom/speed, then **Re-render MP4**.
6. **Settings** → clip count, default layout, language and caption branding for future projects.
7. **Admin** → `/admin` edits the public hero/pricing/payment buttons and shows purchase enquiries. Add allowed emails in `ADMIN_EMAILS` (default admin: `admin@clipforge.ai` / `admin123`; demo account also allowed).

---

## Notes and limitations

- Every successful job produces at least 3 clips; raise **Settings → Clips per video** for 4–6. URL sources analyze the first 30 minutes to keep processing fast.
- Local Whisper inference speed depends on your CPU (roughly 1–3 minutes per analyzed hour with the tiny model).
- Processing a long stream requires enough disk space; source audio and temporary clips are cleaned up where possible.
- YouTube login/age-restricted/subscriber-only content is intentionally not supported without your own authorized access. Provide a recording you can legally edit instead.
- The optional background-music mix uses `storage/music/ambient.mp3` when present; otherwise no music is added.
- Pricing shown on the landing page is illustrative — this build does not process payments.

## Troubleshooting

- **`Applying the VAD filter requires the onnxruntime package`** — the worker automatically falls back to transcription without VAD. If you want VAD, install a working `onnxruntime` build in `VIDEO_PYTHON`.
- **`yt-dlp` errors** — the video may be private, live, region-locked or bot-protected. Use an authorized local file.
- **`AUTH_SECRET is missing or too short`** — set a long random value in `.env`.
- **Worker exits immediately** — open the project's activity log; it contains the exact FFmpeg/Python error.
- **Face crop wrong** — open the editor, choose a layout and adjust the facecam `x/y/w/h` sliders, then re-render.
