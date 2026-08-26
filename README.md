# Pipeline Studio

One-page content pipeline: script → TTS voiceover → 3D video render → export → post, all in the browser (Next.js 14, App Router). Video rendering runs client-side via Canvas2D + Three.js + Web Audio + MediaRecorder, so it isn't limited by serverless function time limits.

## Push to GitHub

Claude's cloud sandbox and the Cowork local VM both sit behind network proxies that block direct GitHub pushes, so do this from your own Mac terminal (not through Claude):

```bash
cd pipeline-studio
git init
git add .
git commit -m "Initial commit: Pipeline Studio"
git branch -M main
git remote add origin git@github.com:aobsedtawut/pipeline-studio-3d.git   # create this repo on github.com first (empty, no README)
git push -u origin main
```

If you use HTTPS instead of SSH, swap the remote URL for `https://github.com/aobsedtawut/pipeline-studio-3d.git` — GitHub will prompt you to sign in the first time.

## Run locally

```bash
npm install
npm run dev
```

Requires Node 18+.

## Optional environment variables (Vercel or `.env.local`)

| Variable | Effect if unset |
|---|---|
| `SHOPEE_APP_ID` + `SHOPEE_APP_SECRET` (+ optional `SHOPEE_API_BASE`) | required — no fallback — Stage 1 product search will not work without these; user can still skip it and type a product name manually in Stage 2 |
| `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) | "✨ ปรับด้วย AI" script-polish button shows a Thai error message instead of rewriting |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | TTS falls back to Google Translate's free unofficial endpoint |
| `FB_PAGE_ID` + `FB_PAGE_ACCESS_TOKEN` | required — no fallback — the Stage 7 Facebook Page post button will not work without these |
| `DATABASE_URL` | run history/resume (the "History" drawer + autosave) is disabled — the pipeline itself still works fully client-side without it |

## Database (optional)

Run history is persisted to Postgres via Prisma, purely so you can resume a
past run from the "History" drawer — nothing else depends on it.

```bash
# .env.local
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

Any Postgres works; a free tier from [Neon](https://neon.tech) or
[Supabase](https://supabase.com) is enough. Then push the schema once:

```bash
npx prisma db push
```

Rendered video/export output is *not* persisted (blobs don't belong in a
JSON column) — resuming a run restores product/script/scenes/audio and you
just re-click "render" in the video stage.

## Known gaps (see PROJECT NOTES below)

- Facebook video upload is not implemented (text + cover image only); download the rendered `.webm` and post the video manually.
- No automatic `.webm` → `.mp4` transcode.
- The client-side 3D video renderer (`app/components/VideoStage.js`) has not been runtime-verified in an actual browser as of this commit — test all 7 stages after deploying and report any console errors.
- Stage 1 (`app/api/product-search/route.js`) ports the Shopee Affiliate Open API auth scheme and GraphQL field names from memory, not a live schema pull — verify against your Shopee Affiliate Open API dashboard if it errors.
