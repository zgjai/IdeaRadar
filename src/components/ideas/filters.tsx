import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface FiltersProps {
  search: string;
  category: string;
  source: string;
  rank: string;
  sort: string;
  order: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onRankChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onOrderChange: (value: string) => void;
}

export function Filters({
  search,
  category,
  source,
  rank,
  sort,
  order,
  onSearchChange,
  onCategoryChange,
  onSourceChange,
  onRankChange,
  onSortChange,
  onOrderChange,
}: FiltersProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="lg:col-span-2">
          <Input
            type="text"
            placeholder="搜索创意..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <Select value={category} onChange={(e) => onCategoryChange(e.target.value)}>
          <option value="">全部分类</option>
          <option value="SaaS">SaaS</option>
          <option value="Mobile App">移动应用</option>
          <option value="Web Service">Web 服务</option>
          <option value="Developer Tool">开发者工具</option>
          <option value="Productivity">效率工具</option>
          <option value="Other">其他</option>
        </Select>

        <Select value={source} onChange={(e) => onSourceChange(e.target.value)}>
          <option value="">全部来源</option>
          <option value="HN">Hacker News</option>
          <option value="PH">Product Hunt</option>
          <option value="GT">Google Trends</option>
        </Select>

        <Select value={rank} onChange={(e) => onRankChange(e.target.value)}>
          <option value="">全部等级</option>
          <option value="S">S 级</option>
          <option value="A">A 级</option>
          <option value="B">B 级</option>
          <option value="C">C 级</option>
          <option value="D">D 级</option>
        </Select>

        <Select
          value={`${sort}-${order}`}
          onChange={(e) => {
            const [newSort, newOrder] = e.target.value.split('-');
            onSortChange(newSort);
            onOrderChange(newOrder);
          }}
        >
          <option value="finalScore-desc">评分: 从高到低</option>
          <option value="finalScore-asc">评分: 从低到高</option>
          <option value="discoveredAt-desc">最新发现</option>
          <option value="discoveredAt-asc">最早发现</option>
        </Select>
      </div>
    </div>
  );
}
