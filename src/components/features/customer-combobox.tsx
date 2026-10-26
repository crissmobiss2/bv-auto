"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type CustomerOption = { id: string; firstName: string; lastName: string; phone?: string | null; company?: string | null };

const label = (c: CustomerOption) => `${c.firstName} ${c.lastName}`.trim();

/** Server-searched customer picker: works beyond the first 200 customers (UX-001). */
export function CustomerCombobox({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<CustomerOption | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["customer-search", debounced],
    queryFn: () =>
      axios
        .get("/api/customers", { params: { search: debounced || undefined, limit: 25 } })
        .then((r) => r.data.customers as CustomerOption[]),
    enabled: open,
  });

  const { data: fetched } = useQuery({
    queryKey: ["customer-label", value],
    queryFn: () => axios.get(`/api/customers/${value}`).then((r) => r.data as CustomerOption),
    enabled: !!value && picked?.id !== value,
    staleTime: 60_000,
  });
  const selected = picked?.id === value ? picked : fetched;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Customer"
          className="flex-1 justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? (selected ? label(selected) : "Loading…") : "Search customers…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Name, phone or email…"
            value={search}
            onValueChange={setSearch}
            autoCapitalize="words"
            autoCorrect="off"
          />
          <CommandList>
            <CommandEmpty>{isFetching ? "Searching…" : "No customers found."}</CommandEmpty>
            {results?.map((c) => (
              <CommandItem
                key={c.id}
                value={c.id}
                onSelect={() => {
                  setPicked(c);
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} aria-hidden />
                <span className="truncate">{label(c)}</span>
                {(c.company || c.phone) && (
                  <span className="ml-auto pl-2 text-xs text-muted-foreground truncate">{c.company || c.phone}</span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
