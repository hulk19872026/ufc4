'use client';

interface Props {
  f1Name: string;
  f2Name: string;
  f1Prob: number;
  f2Prob: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function WinProbabilityBar({ f1Name, f2Name, f1Prob, f2Prob, size = 'md' }: Props) {
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
  const textSm = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const numSz = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-lg';

  return (
    <div className="space-y-2">
      {size !== 'sm' && (
        <div className="grid grid-cols-3 text-center">
          <div>
            <div className={`font-bold ${numSz} text-blue-400 font-['Barlow_Condensed',sans-serif]`}>{f1Prob}%</div>
            <div className={`${textSm} text-white/40`}>{f1Name.split(' ')[0]}</div>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xs text-white/20 uppercase tracking-widest font-semibold">Win%</span>
          </div>
          <div>
            <div className={`font-bold ${numSz} text-red-400 font-['Barlow_Condensed',sans-serif]`}>{f2Prob}%</div>
            <div className={`${textSm} text-white/40`}>{f2Name.split(' ')[0]}</div>
          </div>
        </div>
      )}
      <div className={`flex rounded-full overflow-hidden ${height}`}>
        <div
          className="bg-blue-500 bar-fill"
          style={{ width: `${f1Prob}%` }}
        />
        <div
          className="bg-red-500 bar-fill"
          style={{ width: `${f2Prob}%` }}
        />
      </div>
      {size === 'sm' && (
        <div className="flex justify-between">
          <span className={`${textSm} font-bold text-blue-400`}>{f1Prob}%</span>
          <span className={`${textSm} font-bold text-red-400`}>{f2Prob}%</span>
        </div>
      )}
    </div>
  );
}
