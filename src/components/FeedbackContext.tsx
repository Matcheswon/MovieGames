"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type GameContext = Record<string, unknown>;

type FeedbackContextValue = {
  gameContext: GameContext | null;
  setGameContext: (ctx: GameContext | null) => void;
};

const FeedbackCtx = createContext<FeedbackContextValue>({
  gameContext: null,
  setGameContext: () => {},
});

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [gameContext, setGameContextRaw] = useState<GameContext | null>(null);
  const setGameContext = useCallback((ctx: GameContext | null) => setGameContextRaw(ctx), []);

  return (
    <FeedbackCtx.Provider value={{ gameContext, setGameContext }}>
      {children}
    </FeedbackCtx.Provider>
  );
}

export function useFeedbackContext() {
  return useContext(FeedbackCtx);
}
