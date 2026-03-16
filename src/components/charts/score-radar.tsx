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
    { metric: 'Trend', value: scores.trendScore },
    { metric: 'Demand', value: scores.demandScore },
    { metric: 'Competition', value: scores.competitionScore },
    { metric: 'Feasibility', value: scores.feasibilityScore },
    { metric: 'Growth', value: scores.growthScore },
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
          name="Score"
          dataKey="value"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
