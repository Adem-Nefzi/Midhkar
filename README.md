# Midhkar

Turn Qur'an verses into short, shareable videos — built as a sadaqa jariya.

## Stack in this scaffold

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS — custom palette (`ink`, `gold`, `verdant`, `parchment`) defined in `app/globals.css`
- Clerk — auth (`@clerk/nextjs`), themed dark + gold via `@clerk/themes`
- Fonts via `next/font`: Fraunces (display), Inter (body), Amiri (Arabic)

## Run it locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a free Clerk application at https://dashboard.clerk.com, then copy
   `.env.local.example` to `.env.local` and paste in your Publishable Key and
   Secret Key:
   ```bash
   cp .env.local.example .env.local
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 — clicking "Get started" / "Start creating"
   opens Clerk's sign-up modal; "Sign in" opens the sign-in modal.

## What's here

- `app/page.tsx` — homepage (Navbar + Hero)
- `app/create/page.tsx` — placeholder landing spot for signed-in users
  (this is where the surah/reciter/video builder will live next)
- `components/navbar.tsx`, `components/hero.tsx` — the two UI pieces
- `middleware.ts` — Clerk's `clerkMiddleware()`, currently allows all routes
  through; tighten this once `/create` and `/library` need to require auth

## Notes for next steps

- Text is currently hardcoded in English/Arabic inline. When you wire up
  next-intl for AR/EN/FR, the copy in `hero.tsx` and `navbar.tsx` is the
  first thing to move into message files.
- The gold/ink/verdant/parchment tokens live in `app/globals.css` as CSS
  variables — change them there and every component updates.
