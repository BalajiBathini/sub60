# Run Log — Supabase-connected personal running dashboard

A static GitHub Pages frontend with a Supabase backend:
- Supabase Auth email/password sign-in and account creation
- Persistent Postgres run sessions, session remarks, effort, and source
- Private Supabase Storage for activity screenshots (8 MB PNG/JPG/WebP limit)
- AI activity review through a Supabase Edge Function; provider key stays server-side
- Session listing, aggregate distance/run count/average pace, delete, refresh
- Manual Strava workflow: enter the activity or attach a Strava screenshot (no Strava OAuth/API sync)

## 1. Create Supabase project

Create a project at https://supabase.com/dashboard. In **Project Settings → API** copy:
- Project URL
- Publishable key (or legacy `anon` key)

Do not copy a `service_role` / secret key into the browser or GitHub.

## 2. Create schema and private screenshot bucket

Open **SQL Editor** in Supabase, paste all of `supabase/schema.sql`, and run it. This creates the `run_sessions` table, row-level security policies, and private `activity-screenshots` bucket with owner-only storage policies.

## 3. Enable personal account

In **Authentication → Providers**, enable Email. Under **Authentication → URL Configuration**, add your GitHub Pages URL to Site URL / Redirect URLs, for example:
`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

Create your account from the dashboard's “Create account” button. If email confirmation is enabled, confirm the email first, then sign in.

## 4. Deploy AI function (optional but included)

AI review uses Gemini via a Supabase Edge Function. Install Supabase CLI and sign in:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
# Set the model explicitly. The `models/` prefix is also accepted.
supabase secrets set GEMINI_MODEL=gemini-3.8-flash
supabase functions deploy analyze-activity
```
The function validates the Supabase user session and keeps the Gemini key server-side. Do not commit secrets or add them to `index.html`. AI API usage may incur charges. You can still log sessions and upload screenshots if AI is not deployed; the Analyze action will show a configuration error.

## 5. Publish to GitHub Pages

1. Create a GitHub repository.
2. In `index.html`, replace `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` near the top of the script with the values from Supabase. These public values are shared by every visitor; never use the service-role key.
3. Upload `index.html` to the repository root (or copy it there).
4. Open **Settings → Pages**.
5. Select **Deploy from a branch**, choose `main` and `/ (root)`, then Save.
6. Wait for Pages to publish. Visitors will connect to the configured project without entering its URL or key.
7. In Supabase Auth URL Configuration, allow that Pages URL.

For a project site, URL format is generally:
`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## 6. Test persistence

- Create account and sign in.
- Save a short test activity with remarks.
- Refresh the page: the session should reload from Supabase.
- Attach an image and save another session; it should appear in the session list.
- Sign out and sign back in. Data should still be there.
- Try AI review after deploying the Edge Function and setting the secret.

## Security and design notes

- Browser configuration uses only the project URL and publishable/anon key. RLS policies constrain database and storage operations to the authenticated user.
- The screenshot bucket is private. Images are displayed using short-lived signed URLs.
- The Edge Function checks the Supabase Auth JWT and uses the `GEMINI_API_KEY` environment secret.
- This package is configured for a single personal account, but its RLS structure remains user-scoped.
- The published URL and publishable/anon key are shared frontend configuration; local browser storage is only a fallback when those constants are not configured. Supabase Auth sessions are stored per browser. Run records and screenshots are persisted remotely.
- No direct Strava API connection is present. Use manual entry or screenshot upload.
- Take care with screenshot privacy; redact unrelated information before uploading.

## Troubleshooting

**“relation run_sessions does not exist”** — run `supabase/schema.sql` in the SQL Editor.

**“new row violates row-level security”** — sign in; verify the logged-in user is the owner and SQL policies were installed.

**Screenshot upload fails** — verify the bucket exists, is private, and storage policies are present; check file type and 8 MB limit.

**AI review fails** — set `GEMINI_API_KEY`, deploy the Edge Function, and ensure your Supabase Auth user is signed in. AI use may be billable.

**Auth email not received** — check spam and Supabase Auth email confirmation settings.
