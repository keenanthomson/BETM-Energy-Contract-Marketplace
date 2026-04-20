import { useEffect, useState } from "react";
import { FilterIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EnergyBadge } from "@/components/EnergyBadge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEnums } from "@/hooks/useEnums";
import { useFilteredContracts } from "@/hooks/useFilteredContracts";
import { useFilterStore } from "@/store/useFilterStore";
import { statusColor } from "@/lib/colors";
import type { ContractFilters } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + "T00:00:00");
  d.setTime(d.getTime() + days * DAY_MS);
  return d.toISOString().slice(0, 10);
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function CheckboxGroup({
  options,
  selected,
  onToggle,
  renderLabel,
  scrollable = false,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  renderLabel?: (value: string) => React.ReactNode;
  scrollable?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 ${
        scrollable ? "max-h-48 overflow-y-auto pr-1" : ""
      }`}
    >
      {options.map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            checked={selected.includes(opt)}
            onCheckedChange={() => onToggle(opt)}
          />
          {renderLabel ? renderLabel(opt) : opt}
        </label>
      ))}
    </div>
  );
}

// Decouple the <input> DOM value from the store so typing stays responsive
// on 1k-row datasets (the filter pipeline + re-render only fires every
// DEBOUNCE_MS, not on every keystroke).
const DEBOUNCE_MS = 200;

function NumberInput({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  min,
  max,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  const [local, setLocal] = useState<string>(value === null ? "" : String(value));
  const debounced = useDebouncedValue(local, DEBOUNCE_MS);

  // Sync local → store after the user pauses typing.
  useEffect(() => {
    const parsed = debounced === "" ? null : parseFloat(debounced);
    if (parsed !== value) onChange(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Sync store → local when filters reset externally.
  useEffect(() => {
    const asString = value === null ? "" : String(value);
    if (asString !== local) setLocal(asString);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="pointer-events-none absolute left-2 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={local}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) => setLocal(e.target.value)}
        className={`${prefix ? "pl-6" : ""} ${suffix ? "pr-10" : ""}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

function DateInput({
  value,
  onChange,
  min,
  max,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  min?: string;
  max?: string;
}) {
  return (
    <Input
      type="date"
      value={value ?? ""}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
    />
  );
}

export function FilterPanel() {
  const filters = useFilterStore((s) => s.filters);
  const setFilter = useFilterStore((s) => s.setFilter);
  const toggleInArray = useFilterStore((s) => s.toggleInArray);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const activeCount = useFilterStore((s) => s.activeFilterCount());
  const { count, total } = useFilteredContracts();
  const { data: enums } = useEnums();

  const set =
    <K extends keyof ContractFilters>(key: K) =>
    (value: ContractFilters[K]) =>
      setFilter(key, value);

  const sortedZones = [...(enums?.grid_zones ?? [])].sort();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <FilterIcon />
            Filters
            {activeCount > 0 && (
              <Badge variant="default" className="ml-1">
                {activeCount}
              </Badge>
            )}
          </Button>
        }
      />
      <SheetContent side="left" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5">
            <Section title="Energy Type">
              <div className="flex flex-wrap gap-1.5">
                {(enums?.energy_types ?? []).map((type) => (
                  <EnergyBadge
                    key={type}
                    type={type}
                    selected={filters.energy_types.includes(type)}
                    interactive
                    onClick={() => toggleInArray("energy_types", type)}
                  />
                ))}
              </div>
            </Section>

            <Separator />

            <Section title="Status">
              <CheckboxGroup
                options={enums?.statuses ?? []}
                selected={filters.statuses}
                onToggle={(v) => toggleInArray("statuses", v)}
                renderLabel={(v) => (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-1.5 rounded-full"
                      style={{ backgroundColor: statusColor(v) }}
                    />
                    {v}
                  </span>
                )}
              />
            </Section>

            <Separator />

            <Section title="Price ($/MWh)">
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  value={filters.min_price}
                  onChange={set("min_price")}
                  placeholder="Min"
                  prefix="$"
                  min={0}
                  max={filters.max_price ?? undefined}
                />
                <NumberInput
                  value={filters.max_price}
                  onChange={set("max_price")}
                  placeholder="Max"
                  prefix="$"
                  min={filters.min_price ?? 0}
                />
              </div>
            </Section>

            <Separator />

            <Section title="Quantity (MWh)">
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  value={filters.min_quantity}
                  onChange={set("min_quantity")}
                  placeholder="Min"
                  suffix="MWh"
                  min={0}
                  max={filters.max_quantity ?? undefined}
                />
                <NumberInput
                  value={filters.max_quantity}
                  onChange={set("max_quantity")}
                  placeholder="Max"
                  suffix="MWh"
                  min={filters.min_quantity ?? 0}
                />
              </div>
            </Section>

            <Separator />

            <Section title="Delivery Dates">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    Start after
                  </label>
                  <DateInput
                    value={filters.delivery_start_after}
                    onChange={set("delivery_start_after")}
                    max={
                      filters.delivery_end_before
                        ? addDays(filters.delivery_end_before, -1)
                        : undefined
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    End before
                  </label>
                  <DateInput
                    value={filters.delivery_end_before}
                    onChange={set("delivery_end_before")}
                    min={
                      filters.delivery_start_after
                        ? addDays(filters.delivery_start_after, 1)
                        : undefined
                    }
                  />
                </div>
              </div>
            </Section>

            <Separator />

            <Section title="Location">
              <CheckboxGroup
                options={sortedZones}
                selected={filters.locations}
                onToggle={(v) => toggleInArray("locations", v)}
                scrollable
              />
            </Section>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          <span className="text-sm text-muted-foreground">
            {count.toLocaleString()} of {total.toLocaleString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            disabled={activeCount === 0}
          >
            Reset
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
