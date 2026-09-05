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
account (enforced in [proxy.js](proxy.js) +
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
| `FB_USER_ACCESS_TOKEN` | `/post-reel` and `/ads` show a "not configured" error — Stage 7's text+image post is unaffected |
| `FB_AD_ACCOUNT_ID` | `/ads` (create a draft ad campaign) shows a "not configured" error |
| `BLOB_READ_WRITE_TOKEN` | `/post-reel` and `/ads` video upload fails — this one's usually set automatically once a Blob store is connected in the Vercel dashboard, see below |

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

## Post a Reel (`/post-reel`)

A separate page (not part of the numbered pipeline stages) for posting a
finished video straight to Facebook as a **Reel**, on any Page you
administer — verified live against Facebook's
[Reels publishing docs](https://developers.facebook.com/docs/video-api/guides/reels-publishing).
Unlike Stage 7 (text + cover image, one fixed page), this posts the actual
video and lets you pick which page per-post.

**How it avoids Vercel's ~4.5MB request body limit:** the video uploads
directly from your browser to Vercel Blob storage (never passing through a
serverless function), then the server just hands Facebook that file's
public URL — Facebook fetches the bytes itself.

Setup:

1. **Vercel Blob** — in your Vercel project: Storage tab → Create Database → Blob. This sets `BLOB_READ_WRITE_TOKEN` automatically; run `vercel env pull` to get it locally too.
2. **Facebook user token** — one token covers every page you manage (no per-page setup):
   - Open [Graph API Explorer](https://developers.facebook.com/tools/explorer), select your app.
   - Request permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
   - Generate the token, then use the **"Extend Access Token"** button (in the Explorer's settings) so it doesn't expire in an hour.
   - Set `FB_USER_ACCESS_TOKEN` to that value.
3. Open `/post-reel` (linked from the top bar) — it lists every page the token has access to via `GET /me/accounts`, no hardcoded page IDs.

**Video format:** Facebook recommends `.mp4`, 9:16, 1080×1920, 3–90 seconds — Pipeline Studio's own renderer currently outputs `.webm` (VP9/Opus), which is a supported codec per Facebook's spec but not the recommended container. If an upload gets rejected, convert to `.mp4` first (see the "9:16/.mov" discussion in project notes for why the in-browser renderer can't produce `.mp4`/`.mov` directly).

**Standard Access, no App Review needed** — same as Stage 7's Page posting, as long as your Facebook account has an admin/editor role on both the Page(s) and the Meta app itself. This breaks down (needs Advanced Access + review) only if you ever post to a Page you don't personally manage.

## Run a Facebook Ads campaign (`/ads`)

A 2-step wizard (linked from the top bar) that creates a full Campaign →
Ad Set → Ad Creative → Ad chain via the Marketing API, replicating the
engagement-objective / Messenger-destination pattern already proven in
this account's own past campaigns (see `app/api/ads-create/route.js` for
the exact request shapes — verified against Meta's live API reference
docs, not guessed).

**The one rule this never breaks: everything is created with `status:
"PAUSED"`.** No object this route creates is ever set to `ACTIVE` — that
would start spending real money automatically, which isn't something this
app will do on its own. After a draft is created, you get a direct link
into Ads Manager to review it and turn it on yourself.

Setup — reuses `FB_USER_ACCESS_TOKEN` and `BLOB_READ_WRITE_TOKEN` from the
Reel setup above (Blob store, Graph API Explorer token), plus:

1. Add `ads_management` and `ads_read` to the same token's permissions in Graph API Explorer (alongside the Reel/Page permissions) and re-extend it.
2. Set `FB_AD_ACCOUNT_ID` to your ad account id (Ads Manager → account dropdown; with or without the `act_` prefix, either works).
3. **Standard Access is enough for your own ad account** — confirmed against Meta's Marketing API authorization docs — `ads_management`/`ads_read` are granted automatically, no App Review needed (Advanced Access + review is only required for managing *other people's* ad accounts).

Step 1 sets the campaign name, page, daily budget (THB), and audience
(age range, gender — geography is fixed to Thailand to match past
campaigns), plus a targeting-mode toggle: **Advantage+** (default —
Meta's own ad ranking widens the audience beyond the baseline for you) or
**manual** (locks to exactly the age/gender you set). Step 2 uploads the ad
video (same Blob → `file_url` pattern as `/post-reel`) and the ad's primary
text, shows a summary, then creates everything paused in one call.

## Ads Dashboard (`/ads/dashboard`)

Read-only performance dashboard — **never creates, edits, or activates
anything on Facebook**, purely reads and analyzes. Three tabs:

- **📈 Insights** — live spend/CPM/CTR/results per campaign, ad set, or ad
  (via the Marketing API's `/insights` edge), plus a spend trend line and a
  "ซิงค์ข้อมูลล่าสุด" button that also pulls edit history (`/activities`)
  and creative format per ad. Works with just `FB_USER_ACCESS_TOKEN` +
  `FB_AD_ACCOUNT_ID` — no database required for this tab alone, though
  history/trends beyond what Facebook itself retains need one (see below).
- **🧠 Analysis** — sends synced performance data to Claude
  (`ANTHROPIC_API_KEY`) for a Thai-language blind-spot analysis and
  next-round recommendations, deliberately shaped around Meta's
  **Andromeda** ad-ranking system and **Advantage+** best practices rather
  than generic metric-reading: it specifically flags campaigns edited too
  often (risks resetting the ad set's Learning Phase), recommends a
  proven-vs-testing budget split using this account's real spend/results,
  flags single-format creative (recommends diversifying video/image/
  carousel), and checks objective/optimization-goal fit against your daily
  order goal. Every past analysis is kept with a status
  (generated/reviewed/applied/dismissed) and a note field, so
  recommendations stay reviewable, not just the latest run.
- **💰 Profit** — log a product's cost/shipping/COD-fee/selling price per
  campaign once, and it computes real profit (not just ad ROAS): revenue,
  COGS, gross profit, ROAS, margin, cost/order, break-even orders. The
  "orders" figure is pre-filled from Facebook's `results` (for a
  Messenger-objective campaign, that's *conversations started*, not
  confirmed sales) but is a plain editable number — override it with your
  actual confirmed order count for accurate math.

**Requires `DATABASE_URL`** for the Analysis/Profit tabs and for Insights'
historical trend line — unlike the rest of this app, this feature can't
fully degrade to database-less, since Facebook's own insights lookback
window is limited and product-cost/profit history can't be reconstructed
from Facebook's API at all. The live Insights tab (current spend/CPM/etc.)
still works with no `DATABASE_URL` set.

Setup — reuses `FB_USER_ACCESS_TOKEN`, `FB_AD_ACCOUNT_ID`, and
`ANTHROPIC_API_KEY` from the sections above, plus:

1. Run `npx prisma db push` after pulling this feature (adds `AdSnapshot`,
   `AdEditEvent`, `ProductCost`, `AdAnalysis` tables).
2. Optional: set `CRON_SECRET` to any random string and Vercel Cron
   (configured in `vercel.json`) will call `/api/ads-sync` automatically
   once a day — otherwise just click "ซิงค์ข้อมูลล่าสุด" manually on the
   Insights tab whenever you want fresh data.
3. Click "🔄 ซิงค์ข้อมูลล่าสุด" at least once before running an analysis —
   `/api/ads-analysis` refuses to run (with a clear error) against zero
   synced data rather than let the model invent plausible-sounding numbers.

**Caveats (verify before relying on them):** the `actions[]` → "results"
mapping in `app/lib/facebookAds.js` has been verified against this account's
live v25.0 response for REPLIES/Messenger and MESSAGING_PURCHASE_CONVERSION
campaigns. Re-check it if Meta introduces a new optimization goal or action
alias. The Advantage+ toggle's `targeting_optimization: "expansion_all"`
field/enum is likewise unverified against a live `v25.0` call. The
`/activities` edge field names used for edit-history sync are a best-effort
read of Meta's docs, not a confirmed live response.

## Known gaps (see PROJECT NOTES below)

- Stage 7's Facebook post is text + cover image only (no video) — use `/post-reel` above for full-video posting instead.
- No automatic `.webm` → `.mp4` transcode.
- The client-side 3D video renderer (`app/components/VideoStage.js`) has not been runtime-verified in an actual browser as of this commit — test all 7 stages after deploying and report any console errors.
- Stage 1 (`app/api/product-search/route.js`) ports the Shopee Affiliate Open API auth scheme and GraphQL field names from memory, not a live schema pull — verify against your Shopee Affiliate Open API dashboard if it errors.
- TikTok Shop's link-generation response shape is unverified — see the caveat above.
- `/post-reel` was built against Facebook's live Reels API docs (endpoints/params/permissions all verified by fetching the actual doc pages), but the full 3-phase flow has not been runtime-tested end-to-end against a real Page — report back if any phase errors unexpectedly.
- `/ads` was likewise built against Meta's live Marketing API reference docs (campaign/ad set/ad creative/ad field names and enums all verified by fetching the actual doc pages) but not runtime-tested end-to-end against a real ad account — the `billing_event: "IMPRESSIONS"` choice in particular is a reasonable default rather than something pulled from the docs for the `CONVERSATIONS` optimization goal specifically; double-check the created (paused) ad set in Ads Manager before activating anything.
- `/ads/dashboard` (Insights/Analysis/Profit) was built against Meta's Marketing API reference docs but not runtime-tested end-to-end against a real ad account — see the Ads Dashboard section's caveats above (results-mapping, Advantage+ field, `/activities` field names) before trusting the numbers it shows.
- **Messenger message-mining (finding which chat messages actually closed a sale) is intentionally not built.** It would need Graph API `/{page-id}/conversations` access at a scale that likely requires Advanced Access + Meta App Review with a documented Business Use Case (Standard Access, which today's `pages_messaging`/`ads_management` ride on, probably doesn't cover this), plus a written customer-data retention/redaction policy before any message content is read or sent to an LLM. Needs its own policy review before implementation — not scheduled.
