import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}

export function ThemeToggle({ theme, toggle }: { theme: "dark" | "light"; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="relative flex h-8 w-16 items-center rounded-full border border-line bg-secondary transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {/* Track */}
      <span
        className={`absolute left-0.5 flex h-7 w-7 items-center justify-center rounded-full shadow transition-all duration-300 text-sm ${
          theme === "light"
            ? "translate-x-8 bg-primary text-primary-foreground"
            : "translate-x-0 bg-secondary-foreground/10 text-muted-foreground"
        }`}
      >
        {theme === "light" ? "☀️" : "🌙"}
      </span>
      {/* Labels */}
      <span className="absolute left-1.5 font-mono text-[9px] text-muted-foreground select-none pointer-events-none">
        {theme === "dark" ? "" : ""}
      </span>
    </button>
  );
}
