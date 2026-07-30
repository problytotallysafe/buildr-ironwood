# Buildr — Ironwood Remodeling

A GitHub-ready web app for Ironwood Remodeling to manage customers, detailed bids, private pricing notes, customer proposal links, proposal views and acceptance, projects, a price book, and payments.

## What is included

- Ironwood green/gold/cream branding and compact house mark
- Passwordless owner sign-in
- Customer database
- Detailed estimate builder with labor, material, subcontractor, allowance, fee, and other lines
- Per-line markup, taxable controls, tax calculation, vendor/SKU/URL, and private notes
- Customer-facing proposal that hides raw costs and private notes
- Proposal email delivery through Resend
- View count, first/last view, sent/accepted timeline
- Typed-name acceptance and automatic project creation
- Project status and payment records
- Editable Ironwood price book
- Prepared Lowe's connector route

## Recommended hosting

- Source code: GitHub
- App hosting: Vercel
- Database/authentication: Supabase
- Proposal email: Resend

## Set up from a GitHub Codespace

1. Create a new empty GitHub repository named `buildr-ironwood`.
2. Upload this project or copy it into the repository.
3. In the terminal:

```bash
npm install
cp .env.example .env.local
npm run dev
```

4. Create a Supabase project.
5. Open Supabase **SQL Editor**, paste `supabase/migrations/001_buildr.sql`, and run it once.
6. Copy the Supabase Project URL and Publishable Key into `.env.local`.
7. In Supabase Authentication settings, add `http://localhost:3000/auth/confirm` as a redirect URL for local development.
8. Restart `npm run dev`, open the forwarded port, and sign in with the owner email.

## Email setup

1. Create a Resend account and verify a sending domain.
2. Add `RESEND_API_KEY` and `PROPOSAL_FROM_EMAIL` to `.env.local` and later to Vercel.
3. Set `NEXT_PUBLIC_APP_URL` to the live Vercel URL after deployment.

## Deploy

Push the repository to GitHub, import it into Vercel, add the environment variables, and deploy. Add the live `/auth/confirm` URL to Supabase Authentication redirect URLs.

## Lowe's pricing

Buildr's own price book works now. The route at `src/app/api/vendors/lowes/lookup/route.ts` is intentionally isolated. After Lowe's approves Developer Hub access, map their approved Product Discovery endpoints and credentials there. This prevents the rest of the estimate system from depending on outside API approval.

## Important acceptance note

The included acceptance flow records the name, email, timestamp, and event history. Before relying on it as a formal contract signature, have Ironwood's proposal terms and acceptance language reviewed for the business's specific legal and licensing needs.
