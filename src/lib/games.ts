import { GameDefinition } from "@/lib/types";

export const games: GameDefinition[] = [
  {
    slug: "thumb-wars",
    title: "Thumb Wars",
    description:
      "Lightning round: guess Siskel & Ebert's thumbs for 10 movies as fast as you can.",
    href: "/games/thumb-wars/daily",
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
