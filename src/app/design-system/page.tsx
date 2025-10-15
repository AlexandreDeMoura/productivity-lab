import { ThemeToggle } from "@/components/theme-toggle";

export default function DesignSystem() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16">
      <section className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full border border-border bg-background-muted/60 px-4 py-1 text-xs uppercase tracking-[0.3em] text-foreground-muted">
          Pandora Design System
        </span>
        <h1 className="text-balance text-3xl font-semibold sm:text-4xl">
          A maintainable light & dark theme powered by Tailwind v4 design tokens.
        </h1>
        <p className="max-w-2xl text-pretty text-sm text-foreground-muted sm:text-base">
          Switch themes to see background, surface, accent, and border tokens update instantly across
          the layout. The system respects system preferences yet allows manual overrides that persist
          between visits.
        </p>
      </section>

      <ThemeToggle />

      <section className="grid w-full gap-6 rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-soft)] transition-colors sm:grid-cols-[2fr_1fr]">
        <article className="flex h-full flex-col justify-between gap-6 rounded-md border border-dashed border-border bg-background p-6 transition-colors">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">Design Tokens in Action</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              The tokens defined in <code className="rounded bg-surface-hover px-2 py-0.5 text-xs">globals.css</code>{' '}
              feed into Tailwind&apos;s <code className="rounded bg-surface-hover px-2 py-0.5 text-xs">@theme inline</code>{' '}
              block. Classes like <code className="rounded bg-surface-hover px-2 py-0.5 text-xs">bg-surface</code>,{' '}
              <code className="rounded bg-surface-hover px-2 py-0.5 text-xs">text-foreground</code> and{' '}
              <code className="rounded bg-surface-hover px-2 py-0.5 text-xs">border-border</code> now stay in sync.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent/90">
              Accent Action
            </button>
            <button className="rounded-md border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface-hover">
              Secondary
            </button>
            <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-wide text-foreground-muted">
              <span className="size-2 rounded-full bg-accent" />
              token-driven
            </span>
          </div>
        </article>

        <aside className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-background p-4 transition-colors">
            <p className="text-xs uppercase tracking-wide text-foreground-muted">Resolved theme</p>
            <p className="text-lg font-semibold text-foreground">
              Always synced with <code className="rounded bg-surface-hover px-1 text-xs font-semibold">data-theme</code>
            </p>
          </div>
          <div className="rounded-md border border-border bg-background p-4 transition-colors">
            <p className="text-xs uppercase tracking-wide text-foreground-muted">System support</p>
            <p className="text-sm text-foreground">
              When you choose <em>System</em>, we listen for media query changes and mirror them without flashes.
            </p>
          </div>
          <div className="rounded-md border border-dashed border-border bg-background p-4 transition-colors text-sm text-foreground-muted">
            Tokens stay centralized, making it easy to add future brand palettes or high-contrast modes.
          </div>
        </aside>
      </section>
    </main>
  );
}
