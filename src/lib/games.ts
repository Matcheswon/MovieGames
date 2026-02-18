import { GameDefinition } from "@/lib/types";

export const games: GameDefinition[] = [
  {
    slug: "thumbs",
    title: "Thumbs",
    description:
      "Lightning round: guess Siskel & Ebert's thumbs for 10 movies as fast as you can.",
    href: "/games/thumbs/daily",
    status: "live"
  },
  {
    slug: "roles",
    title: "Roles",
    description:
      "Uncover the actor and character they played. Spin the Role Call wheel, guess letters, and solve the puzzle.",
    href: "/games/roles/daily",
    status: "live"
  },
  {
    slug: "coming-soon",
    title: "More Games",
    description:
      "New games are in the works. Stay tuned.",
    href: "#",
    status: "planned"
  }
];
