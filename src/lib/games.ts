import { GameDefinition } from "@/lib/types";

export const games: GameDefinition[] = [
  {
    slug: "thumb-wars",
    title: "Thumb Wars",
    description:
      "Lightning round: guess Siskel & Ebert's thumbs for 10 movies as fast as you can.",
    href: "/games/thumb-wars",
    status: "live"
  },
  {
    slug: "thumb-wars-daily",
    title: "Daily Challenge",
    description:
      "Same 10 movies for everyone today. Compare your score with friends.",
    href: "/games/thumb-wars/daily",
    status: "live"
  },
  {
    slug: "stars",
    title: "Stars Mode",
    description:
      "Coming soon: predict each critic's star rating instead of thumbs.",
    href: "/games/stars",
    status: "preview"
  }
];
