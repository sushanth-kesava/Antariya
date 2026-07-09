"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

type MultiSelectCreatableProps = {
  label: string;
  /** Default suggestion options. */
  options: string[];
  /** Currently selected values. */
  value: string[];
  /** Called with the next selected values. */
  onChange: (next: string[]) => void;
  placeholder?: string;
};

/**
 * A multi-select combobox that also lets the user create new options on the spot
 * by typing a value and pressing Enter (or clicking "Add"). Selected values show
 * as removable chips. Used for product attributes (Size, Color, etc.).
 */
export function MultiSelectCreatable({
  label,
  options,
  value,
  onChange,
  placeholder,
}: MultiSelectCreatableProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedValue = value || [];

  // Suggestions = defaults + any already-selected custom values, minus current query filter.
  const suggestions = useMemo(() => {
    const all = Array.from(new Set([...options, ...normalizedValue]));
    const q = query.trim().toLowerCase();
    return all.filter((opt) => (q ? opt.toLowerCase().includes(q) : true));
  }, [options, normalizedValue, query]);

  const canCreate =
    query.trim().length > 0 &&
    !normalizedValue.some((v) => v.toLowerCase() === query.trim().toLowerCase()) &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  const toggle = (option: string) => {
    if (normalizedValue.some((v) => v.toLowerCase() === option.toLowerCase())) {
      onChange(normalizedValue.filter((v) => v.toLowerCase() !== option.toLowerCase()));
    } else {
      onChange([...normalizedValue, option]);
    }
  };

  const addCustom = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (!normalizedValue.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...normalizedValue, trimmed]);
    }
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (option: string) => {
    onChange(normalizedValue.filter((v) => v !== option));
  };

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>

      {/* Control */}
      <div
        className="min-h-11 w-full rounded-xl border border-border bg-muted/50 focus-within:bg-background px-2 py-1.5 flex flex-wrap items-center gap-1.5 cursor-text transition-all focus-within:ring-2 focus-within:ring-primary"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {normalizedValue.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold px-2 py-1"
          >
            {val}
            <button
              type="button"
              aria-label={`Remove ${val}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(val);
              }}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canCreate) {
                addCustom();
              } else if (suggestions.length === 1) {
                toggle(suggestions[0]);
                setQuery("");
              }
            } else if (e.key === "Backspace" && query === "" && normalizedValue.length > 0) {
              remove(normalizedValue[normalizedValue.length - 1]);
            }
          }}
          placeholder={normalizedValue.length === 0 ? placeholder || `Select or type ${label.toLowerCase()}…` : ""}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm py-1"
        />
        <ChevronDown
          className="h-4 w-4 text-muted-foreground shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-border bg-background shadow-lg p-1">
            {canCreate && (
              <button
                type="button"
                onClick={addCustom}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary font-semibold hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
                Add “{query.trim()}”
              </button>
            )}
            {suggestions.length === 0 && !canCreate ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No options — type to create one.</p>
            ) : (
              suggestions.map((option) => {
                const selected = normalizedValue.some((v) => v.toLowerCase() === option.toLowerCase());
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggle(option)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {option}
                    {selected && <Check className="h-4 w-4" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
