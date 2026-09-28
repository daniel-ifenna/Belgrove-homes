// Standard admin panel header — 28px icon badge + title + optional
// one-line muted description. Usable in server and client components.
export default function PanelHeader({
  title,
  description,
  icon,
  tone = "bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] border-transparent",
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`h-7 w-7 rounded-[8px] grid place-items-center shrink-0 border ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)] leading-[1.7]">
          {title}
        </h2>
        {description && (
          <p className="public text-[12px] leading-[1.5] text-[var(--ops-muted)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}
