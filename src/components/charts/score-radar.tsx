'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface ScoreRadarProps {
  scores: {
    trendScore: number;
    demandScore: number;
    competitionScore: number;
    feasibilityScore: number;
    growthScore: number;
  };
}

export function ScoreRadar({ scores }: ScoreRadarProps) {
  const data = [
    { metric: '趋势', value: scores.trendScore },
    { metric: '需求', value: scores.demandScore },
    { metric: '竞争', value: scores.competitionScore },
    { metric: '可行性', value: scores.feasibilityScore },
    { metric: '增长', value: scores.growthScore },
  ];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: '#475569', fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
        />
        <Radar
          name="评分"
          dataKey="value"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
