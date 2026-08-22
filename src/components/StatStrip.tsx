/**
 * A row of measured figures under the page title. A spec sheet, not a
 * dashboard: mono type, one hairline rule, no cards and no fills.
 *
 * Every value is passed in from the generated metric files. Nothing is
 * formatted here beyond what the caller hands over, so a figure on screen can
 * always be traced back to a JSON key.
 */

export type Stat = {
  /** The figure itself, already formatted. */
  value: string;
  /** One or two words under it. */
  label: string;
  /**
   * Set where the honest reading of a figure is that nothing was measured. It
   * takes the amber the rest of the site uses for "a human has to look at
   * this", and is never used to make a number look better than it is.
   */
  flagged?: boolean;
};

export function StatStrip({ stats }: { stats: readonly Stat[] }) {
  return (
    <dl className="border-hairline mt-10 grid grid-cols-2 gap-x-6 gap-y-7 border-t pt-8 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <dt className="sr-only">{stat.label}</dt>
          <dd
            className="font-mono text-[clamp(1.375rem,3.5vw,1.75rem)] leading-none tracking-tight break-words"
            style={stat.flagged ? { color: "var(--color-gate)" } : undefined}
          >
            {stat.value}
          </dd>
          <p
            className="mt-2.5 font-mono text-[0.6875rem] tracking-[0.14em] uppercase"
            style={{
              color: stat.flagged ? "var(--color-gate)" : "var(--color-muted)",
            }}
          >
            {stat.label}
          </p>
        </div>
      ))}
    </dl>
  );
}
