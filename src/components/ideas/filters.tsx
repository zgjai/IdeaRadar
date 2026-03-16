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
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <Select value={category} onChange={(e) => onCategoryChange(e.target.value)}>
          <option value="">All Categories</option>
          <option value="SaaS">SaaS</option>
          <option value="Mobile App">Mobile App</option>
          <option value="Web Service">Web Service</option>
          <option value="Developer Tool">Developer Tool</option>
          <option value="Productivity">Productivity</option>
          <option value="Other">Other</option>
        </Select>

        <Select value={source} onChange={(e) => onSourceChange(e.target.value)}>
          <option value="">All Sources</option>
          <option value="HN">Hacker News</option>
          <option value="PH">Product Hunt</option>
          <option value="GT">Google Trends</option>
        </Select>

        <Select value={rank} onChange={(e) => onRankChange(e.target.value)}>
          <option value="">All Ranks</option>
          <option value="S">S Rank</option>
          <option value="A">A Rank</option>
          <option value="B">B Rank</option>
          <option value="C">C Rank</option>
          <option value="D">D Rank</option>
        </Select>

        <Select
          value={`${sort}-${order}`}
          onChange={(e) => {
            const [newSort, newOrder] = e.target.value.split('-');
            onSortChange(newSort);
            onOrderChange(newOrder);
          }}
        >
          <option value="finalScore-desc">Score: High to Low</option>
          <option value="finalScore-asc">Score: Low to High</option>
          <option value="discoveredAt-desc">Newest First</option>
          <option value="discoveredAt-asc">Oldest First</option>
        </Select>
      </div>
    </div>
  );
}
