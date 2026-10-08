type Tab = { id: string; label: string };
type Props = { tabs: Tab[]; selected: string; onSelect: (id: string) => void };

// Same accent bar as the header nav, so a tab reads as "the same kind of thing" one level down.
export function Tabs({ tabs, selected, onSelect }: Props) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-line font-chrome text-[13px]">
      {tabs.map((tab) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(tab.id)}
            className={`-mb-px border-b-2 px-1 py-2 font-medium ${
              isSelected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
