import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  renderOption?: (option: string) => React.ReactNode;
}

export default function MultiSelectDropdown({ label, options, selected, onChange, renderOption }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const selectAll = () => onChange(new Set(filtered));
  const clearAll = () => {
    const next = new Set(selected);
    filtered.forEach(f => next.delete(f));
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 min-w-[160px] w-full"
      >
        <span className="truncate">
          {selected.size === 0 ? label : `${label} (${selected.size})`}
        </span>
        <ChevronDown size={14} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-72 max-h-80 flex flex-col">
          {options.length > 5 && (
            <div className="p-2 border-b">
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs">
            <button onClick={selectAll} className="text-blue-600 hover:underline">Selecionar todos</button>
            <span className="text-gray-300">|</span>
            <button onClick={clearAll} className="text-red-600 hover:underline">Limpar</button>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(option => (
              <label
                key={option}
                onClick={() => { const next = new Set(selected); if (next.has(option)) next.delete(option); else next.add(option); onChange(next); }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  selected.has(option) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                }`}>
                  {selected.has(option) && <Check size={12} className="text-white" />}
                </div>
                <span className="truncate">{renderOption ? renderOption(option) : option}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
