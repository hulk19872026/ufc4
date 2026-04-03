interface Props {
  label: string;
  val1: string | number;
  val2: string | number;
  higherIsBetter?: boolean; // true = higher val1 is blue advantage
  isText?: boolean;
  unit?: string;
}

export default function StatRow({ label, val1, val2, higherIsBetter = true, isText = false, unit = '' }: Props) {
  const n1 = typeof val1 === 'number' ? val1 : parseFloat(String(val1)) || 0;
  const n2 = typeof val2 === 'number' ? val2 : parseFloat(String(val2)) || 0;

  const adv1 = !isText && higherIsBetter ? n1 > n2 : !isText && !higherIsBetter ? n1 < n2 : false;
  const adv2 = !isText && higherIsBetter ? n2 > n1 : !isText && !higherIsBetter ? n2 < n1 : false;

  // Bar widths (40–95%)
  let bar1 = 60, bar2 = 60;
  if (!isText && (n1 || n2)) {
    const min = Math.min(n1, n2);
    const max = Math.max(n1, n2);
    const range = max - min || 1;
    bar1 = Math.round(40 + ((n1 - min) / range) * 55);
    bar2 = Math.round(40 + ((n2 - min) / range) * 55);
  }

  const v1str = `${typeof val1 === 'number' ? val1 : val1}${unit}`;
  const v2str = `${typeof val2 === 'number' ? val2 : val2}${unit}`;

  return (
    <div className="mb-2">
      <div className="grid grid-cols-[1fr_90px_1fr] items-center gap-1">
        <div className={`text-right text-xs font-medium ${adv1 ? 'text-blue-400' : 'text-white/70'}`}>{v1str}</div>
        <div className="text-center text-[10px] text-white/30 leading-tight">{label}</div>
        <div className={`text-left text-xs font-medium ${adv2 ? 'text-red-400' : 'text-white/70'}`}>{v2str}</div>
      </div>
      {!isText && (
        <div className="grid grid-cols-[1fr_90px_1fr] gap-1 mt-0.5">
          <div className="h-[3px] rounded-full bg-white/[0.04] overflow-hidden flex justify-end">
            <div className="h-full rounded-full bg-blue-500/50 bar-fill" style={{ width: `${bar1}%` }} />
          </div>
          <div />
          <div className="h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-red-500/50 bar-fill" style={{ width: `${bar2}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
