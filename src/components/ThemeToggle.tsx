"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg border transition-all duration-300 border-zinc-400 bg-zinc-100 hover:border-amber-500/70 hover:bg-zinc-200 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:hover:border-amber-500/30 dark:hover:bg-zinc-900/70"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-zinc-800" />
      )}
    </button>
  );
}
