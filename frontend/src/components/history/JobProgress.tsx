export default function JobProgress({
  completed,
  failed,
  total,
  running = false,
}: {
  completed: number;
  failed: number;
  total: number;
  running?: boolean;
}) {
  const donePct = total === 0 ? 0 : (completed / total) * 100;
  const failPct = total === 0 ? 0 : (failed / total) * 100;
  return (
    <div className="h-1.5 w-full bg-[#0f0f0f] rounded-full overflow-hidden border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] flex">
      <div
        className="h-full bg-emerald-500 transition-[width] duration-500 ease-out relative"
        style={{ width: `${donePct}%` }}
      >
        {running && donePct > 0 && donePct < 100 && (
          <div className="anim-progress-gloss" />
        )}
      </div>
      {failPct > 0 && (
        <div
          className="h-full bg-rose-500/80 transition-[width] duration-500 ease-out"
          style={{ width: `${failPct}%` }}
        />
      )}
    </div>
  );
}
