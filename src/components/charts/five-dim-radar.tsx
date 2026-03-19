'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface FiveDimRadarProps {
  scores: {
    demand_score: number;
    pain_score: number;
    pay_score: number;
    build_fit_score: number;
    competition_risk_score: number;
  };
}

export function FiveDimRadar({ scores }: FiveDimRadarProps) {
  const data = [
    { metric: '需求强度', value: scores.demand_score },
    { metric: '痛点强度', value: scores.pain_score },
    { metric: '付费意愿', value: scores.pay_score },
    { metric: '开发可行性', value: scores.build_fit_score },
    { metric: '竞争安全', value: 10 - scores.competition_risk_score },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: '#475569', fontSize: 13 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 10]}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
        />
        <Radar
          name="评分"
          dataKey="value"
          stroke="#9333ea"
          fill="#9333ea"
          fillOpacity={0.35}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
