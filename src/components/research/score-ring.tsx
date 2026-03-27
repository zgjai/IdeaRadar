'use client';

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  label: string;
  color: string;
  size?: number;
  delay?: number;
}

export function ScoreRing({ score, maxScore = 10, label, color, size = 80, delay = 0 }: ScoreRingProps) {
  const pct = Math.min((score / maxScore) * 100, 100);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            className="text-slate-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{
              animationDelay: `${delay}ms`,
              filter: `drop-shadow(0 0 6px ${color}40)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono-data text-lg font-bold" style={{ color }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-600 text-center leading-tight">{label}</span>
    </div>
  );
}
