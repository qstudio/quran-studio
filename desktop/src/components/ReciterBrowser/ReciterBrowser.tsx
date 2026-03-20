import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReciters } from "@/hooks/useTauri";
import { cn } from "@/lib/utils";
import type { Reciter } from "@/types/project";

interface ReciterBrowserProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ReciterBrowser({ selectedId, onSelect }: ReciterBrowserProps) {
  const [reciters, setReciters] = React.useState<Reciter[]>([]);
  const [search, setSearch] = React.useState("");
  const { listReciters } = useReciters();

  React.useEffect(() => {
    listReciters()
      .then(setReciters)
      .catch(() => setReciters([]));
  }, [listReciters]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return reciters;
    const q = search.toLowerCase();
    return reciters.filter(
      (r) =>
        r.name_en.toLowerCase().includes(q) ||
        r.name_ar.includes(q) ||
        (r.style && r.style.toLowerCase().includes(q))
    );
  }, [reciters, search]);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search reciters..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-7 text-xs"
      />
      <ScrollArea className="h-40 rounded-md border border-[#1F1F1F]">
        <div className="p-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-[#5C5C5C] text-center py-4">
              {reciters.length === 0
                ? "Loading reciters..."
                : "No reciters match your search"}
            </p>
          ) : (
            filtered.map((reciter) => (
              <button
                key={reciter.id}
                onClick={() => onSelect(reciter.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left transition-colors",
                  selectedId === reciter.id
                    ? "bg-[#1F1F1F] text-[#FAFAFA]"
                    : "text-[#A0A0A0] hover:bg-[#141414] hover:text-[#FAFAFA]"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {reciter.name_en}
                  </p>
                  <p className="text-[10px] text-[#A0A0A0] truncate">
                    {reciter.name_ar}
                  </p>
                </div>
                {reciter.style && (
                  <Badge className="shrink-0 text-[10px]">
                    {reciter.style}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
