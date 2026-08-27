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

## Auth (required)

The whole app is gated behind Google sign-in — every page and API route
redirects to `/signin` unless you're signed in with an allowlisted Google
account (enforced in [middleware.js](middleware.js) +
[app/api/auth/[...nextauth]/route.js](app/api/auth/%5B...nextauth%5D/route.js)).

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** (type: Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` for local dev, and `https://<your-vercel-domain>/api/auth/callback/google` for production (add both — you can list multiple).
3. Set these env vars (Vercel → Settings → Environment Variables, or `.env.local`):

```bash
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"   # your production URL on Vercel
ALLOWED_EMAILS="you@gmail.com,teammate@gmail.com"   # defaults to sedtawut.aob@gmail.com if unset
```

Anyone not on `ALLOWED_EMAILS` gets rejected at sign-in with an "ไม่ได้รับอนุญาต" message, even though they can complete the Google login itself — the allowlist check happens in NextAuth's `signIn` callback, not on the Google side.

## Optional environment variables (Vercel or `.env.local`)

| Variable | Effect if unset |
|---|---|
| `SHOPEE_APP_ID` + `SHOPEE_APP_SECRET` (+ optional `SHOPEE_API_BASE`) | required — no fallback — Stage 1 product search will not work without these; user can still skip it and type a product name manually in Stage 2 |
| `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) | "✨ ปรับด้วย AI" script-polish button shows a Thai error message instead of rewriting |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | TTS falls back to Google Translate's free unofficial endpoint |
| `FB_PAGE_ID` + `FB_PAGE_ACCESS_TOKEN` | required — no fallback — the Stage 7 Facebook Page post button will not work without these |
| `DATABASE_URL` | run history/resume (the "History" drawer + autosave) is disabled — the pipeline itself still works fully client-side without it |
| `TIKTOK_APP_KEY` + `TIKTOK_APP_SECRET` | Stage 1's TikTok Shop search tab shows a "not configured" error — Shopee search and manual entry still work |

## Database (optional, except for TikTok Shop)

Run history and TikTok Shop's OAuth tokens are both persisted to Postgres
via Prisma.

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

## TikTok Shop product search (Stage 1)

Unlike Shopee's static app secret, TikTok Shop's Creator Affiliate API is
OAuth-based — you personally need to be an **approved TikTok Shop Creator
Affiliate** and authorize the app once, and it requires `DATABASE_URL` to
be set (the resulting access/refresh tokens rotate and can't live in a
static env var).

1. Create an app in [TikTok Shop Partner Center](https://partner.tiktokshop.com) → App & Service → get `app_key` + `app_secret`.
2. Set env vars:
   ```bash
   TIKTOK_APP_KEY="..."
   TIKTOK_APP_SECRET="..."
   ```
3. In Stage 1, switch to the "ค้นหาอัตโนมัติ (TikTok Shop)" tab and click **เชื่อมต่อ TikTok Shop** — this redirects to TikTok's own login/consent screen. Approve it once; the app stores your tokens in Postgres and auto-refreshes them from then on.
4. Redirect URI registered with your TikTok app must match this deployment's `/api/tiktok-auth/callback` (e.g. `https://<your-vercel-domain>/api/tiktok-auth/callback`).

**Caveat:** the link-generation call (`app/api/tiktok-link/route.js`, used when you pick a TikTok product — turns the plain product page into a real commission-tracked link) has its exact response field name unverified against a live call; check it against your own response if it errors with "TikTok ไม่ส่งลิงก์กลับมา".

**Lazada:** no official Lazada affiliate/offer-search API exists (checked directly against Lazada Open Platform's docs — every category there is seller-inventory-management, nothing affiliate-facing). Use the "กรอกเอง" manual-entry tab for Lazada products instead.

## Known gaps (see PROJECT NOTES below)

- Facebook video upload is not implemented (text + cover image only); download the rendered `.webm` and post the video manually.
- No automatic `.webm` → `.mp4` transcode.
- The client-side 3D video renderer (`app/components/VideoStage.js`) has not been runtime-verified in an actual browser as of this commit — test all 7 stages after deploying and report any console errors.
- Stage 1 (`app/api/product-search/route.js`) ports the Shopee Affiliate Open API auth scheme and GraphQL field names from memory, not a live schema pull — verify against your Shopee Affiliate Open API dashboard if it errors.
- TikTok Shop's link-generation response shape is unverified — see the caveat above.
