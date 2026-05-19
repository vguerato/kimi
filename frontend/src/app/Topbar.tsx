import { Bell, User, Search } from 'lucide-react';

interface TopbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}

export function Topbar({ searchPlaceholder = 'Pesquisar...', searchValue = '', onSearchChange }: TopbarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl px-3 py-2 w-72 bg-surface-secondary border border-border">
        <Search size={15} className="text-muted shrink-0" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange?.(e.target.value)}
          className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-muted hover:text-foreground hover:bg-default">
          <Bell size={18} />
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-muted bg-default border border-border">
          <User size={18} />
        </button>
      </div>
    </div>
  );
}
