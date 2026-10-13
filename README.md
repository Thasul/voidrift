# VOIDRIFT — Free GitHub Pages Edition

**Current site (once GitHub Pages is enabled): https://thasul.github.io/voidrift/**

VOIDRIFT is a daily rare-answer trivia spaceflight game with **14 destinations**, cinematic jumps, Rarity Explorer, daily leaderboard, username/password pilot accounts, optional email-link login, friend crews, a captain's log, seasonal trivia, unlockable ship cosmetics, and share cards.

## Free website hosting — GitHub Pages

GitHub Pages replaces the old Netlify frontend. Supabase continues powering accounts, scores, private crews, and rarity scoring; there is **no change to player data**. You do not need Netlify.

**One-time GitHub account setting:** Open [this repository's GitHub Pages settings](https://github.com/Thasul/voidrift/settings/pages), under **Build and deployment** select **Source → GitHub Actions**. This is required because GitHub Actions' built-in token cannot create a Pages site for a repository that has never had it enabled. The publishing workflow is already checked in at `.github/workflows/deploy-pages.yml`. After enabling Pages, open [Publish VOIDRIFT on GitHub Pages](https://github.com/Thasul/voidrift/actions/workflows/deploy-pages.yml), select **Run workflow** on `main`. It publishes the `public/` directory at `https://thasul.github.io/voidrift/`.

**One-time Supabase email sign-in redirect:** In [Supabase Auth URL Configuration](https://supabase.com/dashboard/project/ssytwlgpfzfycoyctdum/auth/url-configuration), set Site URL to `https://thasul.github.io/voidrift/` and add `https://thasul.github.io/voidrift/**` to **Redirect URLs**. Username/password accounts work without email redirects; optional email links require this.

**Automatic updates:** Every change to `public/` on GitHub `main` triggers a free GitHub Pages deployment. All links in the game are relative to the site root, so the `/voidrift/` base path works. `public/version.txt` can be used to check the deployed version.

**Browser storage:** Signing in on the new domain requires a one-time fresh sign-in because browser sessions and local guest saves are origin-specific. Cloud daily scores/history/crews are not lost. Guest-only saves on Netlify are not automatically transferred. No service-role or secret keys are included in the static site.

---

## Historical setup notes (Netlify is no longer the recommended host)

The sections below describe the initial Netlify/Supabase setup and are retained for project history. For the current live deployment follow the GitHub Pages instructions above.

# VOIDRIFT — Multiplayer Daily Trivia

VOIDRIFT is your original 10-question space-trivia game with the full-screen cockpit, 10 solar-system destinations, answer spelling help, Movies / Gaming / other Unlimited modes, tiered victory animations and sounds.

**New in this build:** Supabase email-link sign-in, server-verified Daily Flight scoring, cloud progress across devices, global daily leaderboard, editable public callsign, 20-run practice history, answer-review inbox, optional AI-powered freeform answer verification (capped at 3 verification attempts per daily prompt), atomic server-side score saves, server-backed rarity scoring, a UTC reset, and automatic deployment configuration for GitHub → Netlify + GitHub Actions → Supabase.

## What works immediately

- Open `public/index.html` via a static web server (or publish `public/` on Netlify). Existing guest Daily + Unlimited trivia, ship animations, known-answer spelling suggestions, and local save still work without setting anything up.
- The cloud buttons appear, but account syncing / global leaderboards won't work until you finish the setup below.

## Connect the multiplayer backend

1. Sign up / sign in at <https://supabase.com/> and create a project. Note your **Project reference ID** and **Project URL**.
2. In **Supabase → Authentication → URL Configuration**, set the Site URL to your eventual public VOIDRIFT URL (`https://YOUR-NAME.netlify.app`) and add the same URL to Redirect URLs. Enable Email authentication and, for a production launch, configure a custom SMTP provider and email rate limits. Magic-link authentication needs working email delivery.
3. Open **Supabase → SQL Editor**, paste and run `supabase/migrations/20261012000000_init_voidrift.sql`. It creates your game tables, secure RLS, curated answer lists and rarity computation. Alternatively deploy the migration using the CLI: `supabase link --project-ref YOUR_PROJECT_ID` then `supabase db push`.
4. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run in this project folder:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_ID
   supabase functions deploy game --no-verify-jwt
   ```

   This backend has a public read-only leaderboard route. All score-saving routes validate the signed-in user's token via Supabase Auth before writing; **do not** use a public writable scoreboard table.
5. Edit `public/config.js` with the Supabase project URL and **publishable** (or legacy *anon*) key from Project Settings → API. **Do not place service_role, secret, OpenAI, or database keys in config.js.** Those belong only in server-side secrets.
6. To judge unlisted but potentially valid answers beyond the curated dictionary, configure an optional OpenAI key as a **Supabase Edge Function secret**. Example:

   ```bash
   supabase secrets set OPENAI_API_KEY=YOUR_API_KEY
   # Optional model override:
   supabase secrets set OPENAI_MODEL=gpt-4.1-mini
   ```

   Without this key, known answers and spelling corrections work, but unfamiliar valid answers can only be **reported for moderator review** (and don't score on the public leaderboard yet). With it, a server-only model classifies unfamiliar answers; unsure answers are still reported, never simply declared true. Review submissions in Supabase Table Editor → `game_answer_reports` and add approved aliases to `game_answers` via a new migration. **AI costs money and can be wrong**; set usage limits and review mistakes.
7. Test account signup, sign-out, score sync in another browser, and leaderboard population before inviting the public.

## Publish your website and keep it updated automatically

1. Create a GitHub repository, for example `voidrift-game`, and upload **the contents of this ZIP** (not the ZIP itself) to the repository root. Commit `public/index.html`, `public/cloud.js`, `public/config.js`, `supabase/`, `.github/`, `netlify.toml` and this README.
2. In Netlify choose **Add new project → Import an existing project → GitHub**. Choose your repository. Build command: leave empty. Publish directory: `public` (also configured in `netlify.toml`). Deploy.
3. In GitHub repository **Settings → Secrets and variables → Actions → New repository secret**, create:
   - `SUPABASE_ACCESS_TOKEN` — a **Supabase personal access token**, not an API key.
   - `SUPABASE_DB_PASSWORD` — your Supabase Postgres database password.
   - `SUPABASE_PROJECT_ID` — your project's reference ID.
4. GitHub Actions `supabase-deploy.yml` runs on changes to `supabase/**` on `main` (and manually). It applies new database migrations and deploys the Edge Function. Netlify separately publishes the `public/` frontend on each GitHub push.
5. After connecting the final Netlify domain, revisit the **Supabase Auth Redirect URL settings**.

These workflows only operate **after you authorize the accounts / supply secrets**. Uploading a ZIP alone does not create accounts, a database, or a public leaderboard.

## How scoring works

- **Daily Flight:** exactly 10 server-selected prompts for everyone on a UTC date, in the same order. The server allows **one daily run per account** and stores answers individually; it does not trust point values sent from a browser.
- **Initial rarity:** editorial tiers of 10, 25, 45, 65, 85, and 100 points from the answer catalog.
- **Actual player-based rarity:** after at least **30 previously verified daily answers** have been collected for a prompt, next day's score is based on how often that canonical answer was used in earlier daily flights. The snapshot excludes current-day responses, keeping the same correct answer worth the same number of points for all players that day. Existing scored runs are never rewritten.
- **Better matching:** case/punctuation/accent normalization, leading-article variants, fuzzy spelling suggestions from the expanded ~2,700-answer catalog, and optional server AI verification for *not-yet-listed* factual answers. The AI cannot inflate scores by asking it to output a point value.
- **Disputed answers:** unverified replies are not accepted as valid leaderboard points automatically. Players can send them for review. This avoids letting someone type random text and award themselves points.
- **Leaderboard:** global Top 50 finished *Daily* pilots for the UTC date, sorted by points (finish time breaks ties). Unlimited scores are stored as private practice history and aren't ranked.
- **Cloud progress:** signed-in daily attempts are saved atomically per question, isolated from the guest save. Refresh or change devices and relaunch Daily Flight to resume at the next prompt. Guest play stays local.
- **Fair play note:** this is a practical public beta, **not hardened against dedicated cheating**. The client still contains the guest-mode answer catalog, and anti-bot / multi-account abuse prevention is not included. If it becomes popular, move all practice answer data to server endpoints, add CAPTCHA / abuse controls, and audit scoring.
- **Time limit:** 25 seconds in the cockpit, with a server-side allowance for network delay. Some delay / pause edge cases still need live testing.

## Editing questions

- Daily prompts are drawn from the **original 21 categories**; the server produces the same UTC-day order as the guest game.
- Unlimited modes draw from the full set of 124 original and expanded question prompts.
- The SQL migration seeds `game_prompts` + `game_answers`. For new content after initial deployment, create a **new** `.sql` migration rather than editing an applied migration. To add aliases, insert normalized versions into `game_answers`.

## File map

- `public/index.html`: visual game and cockpit
- `public/cloud.js`: sign-in, daily sync, leaderboard, server answer calls
- `public/config.js`: safe public project configuration (fill in)
- `supabase/migrations/*.sql`: database and answer catalog
- `supabase/functions/game/index.ts`: secure cloud API and optional AI validator
- `supabase/functions/game/daily_tags.json`: frozen original daily category IDs
- `supabase/config.toml`: Edge Function auth settings
- `.github/workflows/supabase-deploy.yml`: automatic backend updates
- `netlify.toml`: automatic static website publish config

## Troubleshooting

- **Account email never arrives:** check Supabase Auth email settings / delivery limits and the email provider logs.
- **Sign-in link returns to a blank or wrong URL:** correct Site URL + Redirect URLs in Supabase Auth.
- **Leaderboard says setup required:** fill `public/config.js`, deploy the Edge Function, and ensure the migration ran.
- **Cloud response 401:** check the user's login session, your publishable key, and `supabase/config.toml` / `--no-verify-jwt` setting.
- **Unknown answer rejected:** try spelling suggestions; enable optional AI for open answers; use Report for Review to improve the bank.
- **Everything scores editorial tiers:** that's expected until each prompt has a meaningful number of historical daily submissions.


### Post-game Rarity Explorer

At the end of a completed Daily run, users may select any of today's ten prompts and search for another accepted answer. The server action `rarity` requires an authenticated account whose **current UTC day** run is `finished_at` (authorization checked on the server). It rejects prompts not in that completed mission and returns no raw answers or contestant identities. The API shares the same fixed prior-day rarity scoring window as live submissions. After at least 30 verified answers on prior days, the explorer shows the historical sample size and the number who submitted the search term; otherwise the rank is explicitly marked *editorial estimate*. A known misspelling returns suggestions without implying an answer is invalid. Unknown-but-previously-AI-verified answers can be searched as provisional 65-point estimates until player data exists. No OpenAI inference requests are made by this read-only feature.

Guest players can browse the editorial answer bank after completing their local daily run. Their result cards never show unmeasured popularity as a fact. **Never use the guest estimate to populate the global leaderboard.**

## Repository status
The standalone game (`index.html`) is playable now. The Supabase production backend still requires setup and deployment from the downloadable full project ZIP. This repository initially includes the self-contained game; please do not assume live multiplayer is active.


## Player accounts

**Username + password** is the default. Choose a 3–20 character username (letters, numbers, underscores, starting with a letter) and a password of at least 10 characters. A backend endpoint creates a Supabase Auth user with a reserved non-deliverable internal login identifier. Supabase hashes/verifies passwords; the client never writes passwords to localStorage.

The browser stores the Supabase authentication **session**, so returning players stay signed in; their typed username can be remembered for convenience. The daily score, streak, and leaderboard use their cloud account. Guest progress continues using the original browser-local save.

**Email link** is an optional **separate login method**, not a recovery email for a username account. Username-only accounts cannot recover a forgotten password yet; users should keep their password in a password manager. Avoid claiming email-based account recovery exists until implemented.

Signup is restricted to the backend, validates usernames, and applies a basic hashed-client network rate limit. The frontend needs the Supabase project URL and **publishable** key only—never a service-role key.
