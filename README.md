# Buildr

### Construction management software built by a remodeling contractor, for contractors.

Buildr is an early-stage construction management platform being built and tested by **Ironwood Remodeling**. The goal is simple: build software around the way real contractors actually sell, schedule, manage, document, and get paid for construction work.

> **Buildr is being built in the field, not in a boardroom.**

## Why Buildr?

Construction software can become complicated fast. Buildr is being designed around a straightforward workflow:

**Lead → Customer → Estimate → Proposal → Approval → Project → Payments → Completion → Callback**

The focus is on keeping the information contractors need close at hand without making everyday work harder than it needs to be.

## What Buildr is working toward

- 👤 **Customers** — Keep customer and project information organized.
- 🧮 **Estimating** — Build detailed estimates with labor, materials, subcontractors, allowances, fees, markups, taxes, vendor information, and private notes.
- 📄 **Customer proposals** — Send professional proposals without exposing internal costs or private pricing notes.
- 👀 **Proposal tracking** — Track when proposals are sent and viewed, including first and last view information.
- ✍️ **Acceptance** — Record customer acceptance details and move accepted work into projects.
- 🏗️ **Projects** — Track active work and project status from start to completion.
- 💵 **Payments** — Keep project payment records organized and visible.
- 🔧 **Change orders & callbacks** — Support the real-world changes and follow-up work that happen after a job starts or ends.
- ⏱️ **Time tracking** — Build toward practical job-time tracking that fits how crews actually work.
- 📸 **Project media** — Keep job photos and documentation connected to the work.
- 📊 **Business analytics** — Turn completed-job data into useful information for running the business.
- 📚 **Price book** — Maintain reusable pricing information for faster estimating.

## Built for the real construction workflow

Buildr started as an internal tool for Ironwood Remodeling because the best way to know what contractors need is to actually run a contracting business.

That means the product is being shaped by real jobs, real estimates, real customers, real payments, and real problems in the field.

The long-term vision is to turn those lessons into a simple, practical platform other contractors can use too.

## Current status

🚧 **Active development / early-stage product**

Buildr is not being presented as a finished commercial SaaS product yet. It is actively being developed, tested, and refined through real-world use at Ironwood Remodeling.

Features and workflows will continue to change as we learn what actually works.

## Tech stack

- **Next.js / React** — application
- **Supabase** — database and authentication
- **Vercel** — application hosting
- **Resend** — proposal email delivery
- **GitHub** — source control and development

## Getting started

The current application lives in [`buildr-ironwood-v1/`](buildr-ironwood-v1/).

For setup instructions, environment variables, Supabase configuration, email configuration, and deployment information, see the [Buildr application README](buildr-ironwood-v1/README.md).

```bash
cd buildr-ironwood-v1
npm install
cp .env.example .env.local
npm run dev
```

## Roadmap

The roadmap is intentionally driven by real contractor needs rather than a giant list of theoretical features.

### Near term

- Polish the end-to-end lead-to-project workflow
- Improve customer communication and proposal/invoice tracking
- Continue refining time tracking and jobsite workflows
- Strengthen change orders, callbacks, and project documentation
- Improve reporting and completed-job analytics
- Make the interface faster and more intuitive for daily field use

### Longer term

- Multi-company / multi-user support
- Crew and employee workflows
- Deeper accounting and payment integrations
- Contractor-focused mobile experience
- Additional vendor and pricing integrations
- Public SaaS onboarding

## Contributing

Buildr is currently primarily developed around Ironwood Remodeling's real-world needs. As the project matures, contribution guidelines and a more formal public development process will be added.

If you have experience running a construction, remodeling, handyman, specialty trade, or other field-service business and have ideas about what software should do better, feedback is welcome.

## Security

Never commit API keys, passwords, Supabase service-role keys, or other secrets to this repository. Use environment variables for credentials and follow the security guidance in the application documentation.

## License

Licensing is intentionally being evaluated while Buildr is in early development. This repository should not currently be assumed to grant permission to commercially use, redistribute, or create derivative products from the code.

## About Ironwood Remodeling

Buildr is being developed by **Ironwood Remodeling**, a remodeling company focused on solving people's real-life problems through construction.

The software exists because the same principle applies to technology: **make complicated things simpler, solve real problems, and build tools that actually help people do their work better.**
