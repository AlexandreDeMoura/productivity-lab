'use client';

import { Theme, useTheme } from './theme-provider';

const THEMES: { label: string; value: Theme; description: string; shortcut: string }[] = [
  { label: 'Light', value: 'light', description: 'Bright background, high contrast', shortcut: 'L' },
  { label: 'Dark', value: 'dark', description: 'Dimmed surfaces, reduced glare', shortcut: 'D' },
  { label: 'System', value: 'system', description: 'Follow device preference', shortcut: 'S' },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <section
      aria-label="Theme selection"
      className="rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-soft)] transition-colors"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Theme</p>
          <p className="text-xs text-foreground-muted">
            Active theme: <span className="font-semibold">{resolvedTheme}</span>
          </p>
        </div>
      </header>
      <div className="grid gap-2 sm:grid-cols-3">
        {THEMES.map((option) => {
          const isActive = theme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={[
                'group flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]',
                isActive
                  ? 'border-transparent bg-accent text-accent-foreground shadow-sm'
                  : 'border-border bg-background text-foreground hover:bg-surface-hover',
              ].join(' ')}
              onClick={() => setTheme(option.value)}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {option.label}
                <span className="rounded border border-current/30 px-1 text-[0.65rem] uppercase tracking-wide opacity-80">
                  {option.shortcut}
                </span>
              </span>
              <span
                className={[
                  'text-xs',
                  isActive ? 'text-accent-foreground/80' : 'text-foreground-muted',
                ].join(' ')}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
