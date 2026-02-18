export type ThumbValue = 0 | 1;

export type RatingEntry = {
  id: string;
  title: string;
  year: number;
  director: string;
  show: string;
  airdate: string;
  ebert_thumb: ThumbValue;
  siskel_thumb: ThumbValue;
  video_link?: string;
  ebert_link?: string;
  siskel_link?: string;
  tmdb_id?: number;
};

export type TmdbMovieMeta = {
  posterUrl: string | null;
  genres: string[];
  overview: string | null;
  runtime: number | null;
};

export type GameDefinition = {
  slug: string;
  title: string;
  icon?: string;
  description: string;
  href: string;
  status: "live" | "preview" | "planned";
};

export type ThumbAttempt = {
  siskel: ThumbValue;
  ebert: ThumbValue;
  siskelCorrect: boolean;
  ebertCorrect: boolean;
};

export type ThumbWarsMovie = {
  title: string;
  year: number;
  director: string;
  poster: string;
  siskel: 0 | 1;
  ebert: 0 | 1;
};
