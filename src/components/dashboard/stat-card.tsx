import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  change?: string;
}

export function StatCard({ icon: Icon, title, value, change }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-2">{title}</p>
            <p className="text-4xl font-bold text-slate-900 leading-none">{value}</p>
            {change && (
              <p className="text-xs text-green-600 font-medium mt-2">{change}</p>
            )}
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
