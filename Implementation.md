Here’s a complete project plan Markdown file that you can drop right into your empty ~/Apps/nextjs/moviegames folder as PLAN.md. It’s structured so Codex (or another dev) can immediately start building the Next.js Thumb-guessing game prototype with Netlify, static JSON, TMDB integration, and Wordle-style gameplay.

⸻


# 🟩 MovieGames — Thumbs Guessing Game (Next.js + Netlify)  
## Project Plan & Requirements

### Overview
Build a Wordle-style movie “rating guess” game using:
- **Next.js (App Router)**  
- **Tailwind CSS** for styling  
- **Static JSON dataset** of Siskel & Ebert ratings  
- **TMDB API** for movie metadata  
- Hosted on **Netlify**

This prototype focuses only on the **Thumbs guessing mode**.

---

## 🧱 Tech Stack
- **Framework:** Next.js 13+ (App Router)  
- **Styling:** Tailwind CSS  
- **Data:** Static JSON (`src/data/ratings.json`)  
- **Hosting:** Netlify (with `TMDB_API_KEY` in env vars)  
- **Client State:** `localStorage` for stats  

---

## 📁 Folder Structure

moviegames/
├── PLAN.md
├── package.json
├── next.config.js
├── .env.local
├── src/
│   ├── app/
│   │   ├── games/
│   │   │   └── thumbs/
│   │   │       ├── page.tsx
│   │   │       └── daily/
│   │   │           └── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── game/
│   │   │   ├── GameShell.tsx
│   │   │   └── MovieCard.tsx
│   │   └── thumbs/
│   │       ├── ThumbsGame.tsx
│   │       ├── ThumbsPicker.tsx
│   │       ├── AttemptsList.tsx
│   │       └── ResultReveal.tsx
│   ├── data/
│   │   └── ratings.json
│   └── lib/
│       ├── ratingUtils.ts
│       ├── dailyUtils.ts
│       └── tmdb.ts
└── …

---

## 📦 Dataset: `src/data/ratings.json`

Create a JSON list of Siskel & Ebert movies with these fields:

```json
[
  {
    "id": "one-flew-1975",
    "title": "One Flew Over the Cuckoo's Nest",
    "year": 1975,
    "director": "Milos Forman",
    "show": "Opening Soon",
    "airdate": "1975-11-23",
    "ebert_thumb": 1,
    "siskel_thumb": 1,
    "video_link": "https://youtu.be/eYtfUvhl4Zg",
    "ebert_link": "https://www.rogerebert.com/reviews/one-flew-over-the-cuckoos-nest-1975",
    "siskel_link": "https://chicagotribune.newspapers.com/…",
    "tmdb_id": 510
  }
]

Rules for inclusion:
	•	Only include entries where ebert_thumb and siskel_thumb are 0 or 1.

⸻

🔑 Environment Variables

Set in:
	•	.env.local (local dev)
	•	Netlify UI (production)

TMDB_API_KEY=your_tmdb_api_key_here


⸻

🗺️ Routing

/games/thumbs
	•	Picks a random eligible movie
	•	Renders the movie + Thumbs game

/games/thumbs/daily
	•	Picks a deterministic “daily” movie puzzle
	•	Based on America/New_York date + stable hash

⸻

🎯 Game Behavior
	1.	MovieCard: displays poster + basic movie info
	2.	Guess UI:
	•	Two critics: Siskel & Ebert
	•	Each has 👍 (1) or 👎 (0)
	•	User picks each, then Submit
	3.	Attempts: up to 6 tries
	4.	Feedback: after each submit
	•	Correct = green
	•	Wrong = red
	5.	ResultReveal: shows answer + linked metadata
	6.	Stats: store streaks / results in localStorage

⸻

🧠 Gameplay Rules
	•	User must pick both thumbs before submitting
	•	After submit:
	•	Compare user choices to actual thumbs
	•	Add to attempt history
	•	Update UI accordingly
	•	Win if both thumbs match
	•	Loss if all 6 attempts used

⸻

🧩 Helpers (in src/lib)

ratingUtils.ts
	•	Load & filter JSON
	•	Return eligible rows

dailyUtils.ts
	•	NY timezone date
	•	Stable hash → index
	•	Return daily movie

tmdb.ts
	•	Server-only helper
	•	Fetch movie by tmdb_id using TMDB_API_KEY
	•	Return poster + genres + other needed info

⸻

🧱 Components

GameShell.tsx
	•	Layout wrapper for game pages

MovieCard.tsx
	•	Shows poster + title/year/director etc.

ThumbsGame.tsx (client)
	•	Game logic & state
	•	Renders ThumbsPicker, AttemptsList, ResultReveal

ThumbsPicker.tsx
	•	Two rows: Siskel and Ebert
	•	Buttons for 👍 / 👎

AttemptsList.tsx
	•	Shows previous guesses with result coloring

ResultReveal.tsx
	•	Shows correct thumbs + bonus links

⸻

💻 Development Workflow

1. Setup Next.js

npx create-next-app@latest .

Select:
	•	TypeScript
	•	Tailwind
	•	App Router

2. Create JSON dataset
Place sample rows into src/data/ratings.json.

3. Implement pages
	•	/games/thumbs/page.tsx
	•	/games/thumbs/daily/page.tsx

4. Build UI components
Implement in src/components/… with consistent Tailwind styling.

⸻

🚀 Deploy on Netlify
	1.	Push repo to GitHub
	2.	Create a Netlify site
	3.	Add TMDB_API_KEY in Netlify env vars
	4.	Build settings auto-detected for Next.js
	5.	Deploy

⸻

🧪 Testing Checklist
	•	Mobile + Desktop responsive
	•	Daily puzzle consistent each day
	•	Poster loading via TMDB
	•	Stats correctly persisted
	•	No TMDB key leaks to client

⸻

🧠 Future Enhancements

✨ Reuse GameShell for other games
✨ Add “Stars” mode based on ebert_star / siskel_star
✨ Add shareable result cards
✨ Add more game modes (year guesses, box office, cast)

⸻

Notes
	•	This is a static JSON-driven prototype. Later, swap to SQLite or DB when stats/user accounts are needed.

⸻


This plan uses a clear task list and structure so **Codex can start generating code ASAP** — it covers routing, components, helpers, data, and deployment, all set up for a Netlify + Next.js prototype.  [oai_citation:0‡gist.github.com](https://gist.github.com/fred-terzi/3b25564bee0ef392cdf9ccc67a805870?utm_source=chatgpt.com)

If you want, I can also generate a **starter `ratings.json` sample** that Codex can use to begin without your spreadsheet.