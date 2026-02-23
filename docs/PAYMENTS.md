# Payments Setup

## Architecture

```
User clicks Upgrade → POST /api/checkout → LemonSqueezy checkout page
User subscribes → LemonSqueezy webhook → POST /api/webhooks/lemonsqueezy → Supabase subscriptions table
App checks access → getProStatus() reads subscriptions table
```

## Stack

- **Auth**: Supabase (Google OAuth + email/password)
- **Database**: Supabase Postgres (`subscriptions` table)
- **Payments**: LemonSqueezy

## Env Vars Needed

| Variable | Where to get it | Status |
|----------|----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API | Done |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API | Done |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API (service_role) | TODO |
| `LEMONSQUEEZY_API_KEY` | LemonSqueezy > Settings > API | TODO |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | LemonSqueezy > Settings > Webhooks | TODO |
| `LEMONSQUEEZY_STORE_ID` | LemonSqueezy > Store settings | TODO |
| `LEMONSQUEEZY_VARIANT_ID` | LemonSqueezy > Product variant for "Pro" plan | TODO |

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/lib/supabase/middleware.ts` | Session refresh helper |
| `src/lib/supabase/pro.ts` | `getProStatus()` — check if user is pro |
| `src/middleware.ts` | Next.js middleware (refreshes auth on every request) |
| `src/app/auth/page.tsx` | Sign in / sign up page (Google + email) |
| `src/app/auth/actions.ts` | Server actions: signIn, signUp, signInWithGoogle, signOut |
| `src/app/auth/callback/route.ts` | OAuth callback handler |
| `src/app/api/checkout/route.ts` | Creates LemonSqueezy checkout session |
| `src/app/api/webhooks/lemonsqueezy/route.ts` | Receives payment events, updates subscriptions |
| `src/components/AuthButton.tsx` | Sign in / user menu (server component) |

## Supabase SQL

Run this in Supabase SQL Editor if not already done:

```sql
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  status text not null default 'inactive' check (status in ('active', 'cancelled', 'expired', 'inactive')),
  lemon_squeezy_customer_id text,
  lemon_squeezy_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_ls_customer_idx on public.subscriptions(lemon_squeezy_customer_id);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');
```

## Go-Live Checklist

1. [ ] Create LemonSqueezy account and store
2. [ ] Create a "Pro" subscription product + variant
3. [ ] Fill in all env vars above
4. [ ] Add webhook in LemonSqueezy pointing to `https://yourdomain.com/api/webhooks/lemonsqueezy`
5. [ ] Subscribe to events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_resumed`
6. [ ] Add "Upgrade to Pro" button to the UI
7. [ ] Use `getProStatus()` to gate pro features
8. [ ] Test with LemonSqueezy test mode

## Pro Feature Ideas

- **Classic Era Puzzles**: Pre-1970 actor/character pairings (classic Hollywood + most 1960s films) are reserved for pro subscribers. Playtest data showed these have significantly higher failure rates due to lower recognition, making them a good fit for a "hard mode" or bonus content tier. Only the most universally iconic 1960s pairings (e.g. Sean Connery/James Bond) are allowed in the free pool. Examples for pro: Humphrey Bogart, Vivien Leigh, Katharine Hepburn, Cary Grant, Peter O'Toole, etc.

## Gating Pro Features

```tsx
// In any server component or page:
import { getProStatus } from "@/lib/supabase/pro";

const { isPro, userId } = await getProStatus();

if (!isPro) {
  // show upgrade prompt or limit features
}
```

## Triggering Checkout

```tsx
// From a client component:
const handleUpgrade = async () => {
  const res = await fetch("/api/checkout", { method: "POST" });
  const { url } = await res.json();
  window.location.href = url;
};
```
