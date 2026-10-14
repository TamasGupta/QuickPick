"use client";

import { useEffect, useRef, useState, useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Loader2,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
  AlertCircle,
  SearchX,
  Plus,
  Minus,
  Tag,
  CornerDownLeft,
} from "lucide-react";
import { inr, MAX_CART_ITEMS } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { notify } from "@/store/notify";
import type { SuggestionProduct, SuggestionCategory } from "@/app/api/products/suggest/route";

const RECENT_SEARCHES_KEY = "quickpick_recent_searches";
const MAX_RECENT_SEARCHES = 5;

const TRENDING_SEARCHES = [
  "Milk",
  "Brown Bread",
  "Eggs",
  "Atta",
  "Potato",
  "Curd",
  "Chips",
  "Butter",
];

const POPULAR_CATEGORIES = [
  { name: "Dairy & Bread", slug: "dairy-bread" },
  { name: "Fruits & Vegetables", slug: "fruits-vegetables" },
  { name: "Snacks & Munchies", slug: "snacks" },
  { name: "Cold Drinks", slug: "beverages" },
];

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (terms.length === 0) return <span>{text}</span>;

  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="font-bold text-brand-700 bg-brand-50/80 rounded px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

interface ProductSearchBarProps {
  placeholder?: string;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

export function ProductSearchBar({
  placeholder = 'Search "milk", "bread", "atta"…',
  className = "",
  id,
}: ProductSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "empty" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [products, setProducts] = useState<SuggestionProduct[]>([]);
  const [categories, setCategories] = useState<SuggestionCategory[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Cart actions
  const cartItems = useCart((s) => s.items);
  const addToCart = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);

  // Sync state with URL params when page navigates
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
        }
      }
    } catch {
      // ignore JSON parse or storage access errors
    }
  }, []);

  function saveRecentSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const updated = [trimmed, ...recentSearches.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }

  function removeRecentSearch(termToRemove: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const updated = recentSearches.filter((t) => t !== termToRemove);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  function clearAllRecentSearches(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      setRecentSearches([]);
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  }

  // Handle outside clicks to close dropdown
  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  // Fetch suggestions debounced with AbortController
  useEffect(() => {
    const trimmed = q.trim();

    if (!trimmed) {
      setStatus("idle");
      setProducts([]);
      setCategories([]);
      setErrorMsg(null);
      setHighlightedIndex(-1);
      return;
    }

    setStatus("loading");
    setErrorMsg(null);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        const prods: SuggestionProduct[] = data.products ?? [];
        const cats: SuggestionCategory[] = data.categories ?? [];

        setProducts(prods);
        setCategories(cats);
        setHighlightedIndex(-1);

        if (prods.length === 0 && cats.length === 0) {
          setStatus("empty");
        } else {
          setStatus("success");
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load suggestions");
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function executeSearch(queryToSearch: string) {
    const trimmed = queryToSearch.trim();
    setIsOpen(false);
    if (trimmed) {
      saveRecentSearch(trimmed);
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/");
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (highlightedIndex >= 0) {
      selectHighlightedItem();
    } else {
      executeSearch(q);
    }
  }

  function handleClear() {
    setQ("");
    setStatus("idle");
    setProducts([]);
    setCategories([]);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
    if (urlQ) {
      router.push("/");
    }
  }

  // Keyboard navigation calculation
  // Order of selectable items in results:
  // 1. Categories (count = categories.length)
  // 2. Products (count = products.length)
  // 3. "View all results" button (index = categories.length + products.length)
  const totalNavItems =
    status === "success" || status === "loading"
      ? categories.length + products.length + (q.trim() ? 1 : 0)
      : 0;

  function selectHighlightedItem() {
    if (highlightedIndex < 0 || highlightedIndex >= totalNavItems) {
      executeSearch(q);
      return;
    }

    if (highlightedIndex < products.length) {
      const prod = products[highlightedIndex];
      executeSearch(prod.name);
      return;
    }

    const catIndex = highlightedIndex - products.length;
    if (catIndex < categories.length) {
      const cat = categories[catIndex];
      setIsOpen(false);
      router.push(`/?cat=${cat.slug}`);
      return;
    }

    // Last item is "View all results"
    executeSearch(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (totalNavItems > 0) {
        setHighlightedIndex((prev) => (prev + 1 < totalNavItems ? prev + 1 : 0));
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalNavItems > 0) {
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalNavItems - 1));
      }
      return;
    }

    if (e.key === "Enter") {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        selectHighlightedItem();
      }
    }
  }

  function handleAddToCart(prod: SuggestionProduct, e: React.MouseEvent) {
    e.stopPropagation();
    const ok = addToCart({
      id: prod.id,
      seller_id: prod.seller_id,
      name: prod.name,
      price: prod.price,
      image_url: prod.image_url,
      unit: prod.unit,
      stock: prod.stock,
    });
    if (!ok) {
      notify.error(`Cart limit reached — max ${MAX_CART_ITEMS} products at a time.`);
    } else {
      notify.success(`Added ${prod.name} to cart`);
    }
  }

  function handleQtyChange(prodId: string, newQty: number, e: React.MouseEvent) {
    e.stopPropagation();
    setQty(prodId, newQty);
  }

  const showDropdown = isOpen;

  const popupId = id ? `${id}-suggestions` : `search-suggestions-${inputId}`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input container */}
      <form onSubmit={handleFormSubmit} className="relative w-full">
        <label htmlFor={id ?? inputId} className="sr-only">
          Search products
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition-colors" />

        <input
          ref={inputRef}
          id={id ?? inputId}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={popupId}
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input pl-10 pr-10 text-sm focus:ring-brand-200 transition-all placeholder:text-ink-faint/80"
        />

        {/* Right action inside input: Spinner while loading, Clear button when input has text */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {status === "loading" && (
            <Loader2
              className="h-4 w-4 animate-spin text-brand-600"
              aria-label="Searching suggestions"
            />
          )}

          {q && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-1 text-ink-faint transition hover:bg-gray-100 hover:text-ink focus:outline-none"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown Popover */}
      {showDropdown && (
        <div
          id={popupId}
          role="listbox"
          ref={listboxRef}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[calc(100vh-160px)] sm:max-h-[460px] overflow-y-auto rounded-2xl border border-gray-100 bg-white/95 backdrop-blur-md p-2 shadow-2xl transition-all"
        >
          {/* STATE 1: IDLE / EMPTY QUERY (Recent Searches & Trending) */}
          {status === "idle" && (
            <div className="space-y-4 p-2">
              {/* Recent searches section */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-faint">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-brand-500" />
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={clearAllRecentSearches}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 transition"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => {
                          setQ(term);
                          executeSearch(term);
                        }}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/70 px-3 py-1 text-xs font-medium text-ink transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 cursor-pointer"
                      >
                        <Clock className="h-3 w-3 text-ink-faint group-hover:text-brand-600" />
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(term, e)}
                          className="rounded-full p-0.5 text-ink-faint transition hover:bg-gray-200 hover:text-ink"
                          aria-label={`Remove ${term}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending searches section */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-faint">
                  <TrendingUp className="h-3.5 w-3.5 text-accent-500" />
                  Trending Searches
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING_SEARCHES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setQ(item);
                        executeSearch(item);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-150 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft shadow-xs transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 active:scale-95"
                    >
                      <Sparkles className="h-3 w-3 text-brand-500" />
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Popular categories section */}
              <div className="border-t border-gray-100 pt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">
                  Popular Categories
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {POPULAR_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/?cat=${cat.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-2 text-xs font-medium text-ink transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Tag className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: LOADING / SEARCHING SKELETON */}
          {status === "loading" && (
            <div className="p-2 space-y-3" aria-busy="true" role="status">
              <div className="flex items-center justify-between px-2 text-xs font-medium text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                  Searching for &ldquo;{q}&rdquo;…
                </span>
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="flex items-center gap-3 rounded-xl p-2 animate-pulse"
                  >
                    <div className="h-12 w-12 rounded-lg bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-3/4 rounded bg-gray-200" />
                      <div className="h-2.5 w-1/3 rounded bg-gray-150" />
                    </div>
                    <div className="h-7 w-16 rounded-lg bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATE 3: RESULTS FOUND */}
          {status === "success" && (
            <div className="space-y-2">
              {/* Product suggestions list */}
              {products.length > 0 && (
                <div>
                  <div className="px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    Products
                  </div>
                  <div className="space-y-1">
                    {products.map((prod, idx) => {
                      const isHighlighted = highlightedIndex === idx;
                      const cartItem = cartItems.find((i) => i.id === prod.id);
                      const discount =
                        prod.mrp && prod.mrp > prod.price
                          ? Math.round(((prod.mrp - prod.price) / prod.mrp) * 100)
                          : 0;
                      const isOutOfStock = prod.stock <= 0;

                      return (
                        <div
                          key={prod.id}
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => executeSearch(prod.name)}
                          className={`group flex items-center justify-between gap-3 rounded-xl p-2 transition cursor-pointer ${
                            isHighlighted
                              ? "bg-brand-50/80 ring-1 ring-brand-300"
                              : "hover:bg-gray-50/80"
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-gray-150 bg-gray-50 flex items-center justify-center">
                            {prod.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={prod.image_url}
                                alt={prod.name}
                                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                              />
                            ) : (
                              <span className="text-xl">🛍️</span>
                            )}
                            {discount > 0 && (
                              <span className="absolute bottom-0 left-0 right-0 bg-brand-600 text-center text-[8px] font-extrabold text-white">
                                {discount}% OFF
                              </span>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="text-xs font-semibold text-ink truncate leading-tight">
                              {highlightMatch(prod.name, q)}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                              {prod.unit && <span>{prod.unit}</span>}
                              {prod.brand && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[100px]">{prod.brand}</span>
                                </>
                              )}
                              {prod.category_name && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[120px] text-ink-faint">
                                    {prod.category_name}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="mt-1 flex items-baseline gap-1.5">
                              <span className="text-xs font-bold text-ink">
                                {inr(prod.price)}
                              </span>
                              {prod.mrp && prod.mrp > prod.price && (
                                <span className="text-[10px] text-ink-faint line-through">
                                  {inr(prod.mrp)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Add button or Stepper */}
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isOutOfStock ? (
                              <span className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-semibold text-ink-faint">
                                Out of stock
                              </span>
                            ) : cartItem ? (
                              <div className="qty-stepper text-xs">
                                <button
                                  type="button"
                                  onClick={(e) => handleQtyChange(prod.id, cartItem.qty - 1, e)}
                                  className="h-7 w-7 flex items-center justify-center hover:bg-brand-700"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center text-xs font-bold">
                                  {cartItem.qty}
                                </span>
                                <button
                                  type="button"
                                  disabled={cartItem.qty >= prod.stock}
                                  onClick={(e) => handleQtyChange(prod.id, cartItem.qty + 1, e)}
                                  className="h-7 w-7 flex items-center justify-center hover:bg-brand-700 disabled:opacity-40"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleAddToCart(prod, e)}
                                className="add-pill text-xs py-1 px-3 shadow-xs"
                                aria-label={`Add ${prod.name} to cart`}
                              >
                                <Plus className="h-3 w-3" />
                                ADD
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category suggestions */}
              {categories.length > 0 && (
                <div className="border-t border-gray-100 pt-2 px-1">
                  <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    In Categories
                  </div>
                  <div className="space-y-0.5">
                    {categories.map((cat, idx) => {
                      const catIndex = products.length + idx;
                      const isHighlighted = highlightedIndex === catIndex;
                      return (
                        <div
                          key={cat.id}
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => {
                            setIsOpen(false);
                            router.push(`/?cat=${cat.slug}`);
                          }}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition cursor-pointer ${
                            isHighlighted
                              ? "bg-brand-50 text-brand-700 ring-1 ring-brand-300"
                              : "text-ink hover:bg-gray-50 hover:text-brand-700"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-brand-500" />
                            <span>
                              Search in <span className="font-bold">{cat.name}</span>
                            </span>
                          </span>
                          <ArrowRight className="h-3 w-3 text-ink-faint" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View all results footer */}
              <div className="border-t border-gray-100 pt-1.5">
                <button
                  type="button"
                  onClick={() => executeSearch(q)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    highlightedIndex === products.length + categories.length
                      ? "bg-brand-600 text-white"
                      : "text-brand-700 hover:bg-brand-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    <span>
                      View all results for &ldquo;<span className="font-bold">{q}</span>&rdquo;
                    </span>
                  </span>
                  <span className="flex items-center gap-1 opacity-80 text-[10px]">
                    <kbd className="hidden sm:inline-block rounded border border-current px-1 py-0.5 text-[9px] font-mono">
                      ↵ Enter
                    </kbd>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: NO RESULTS / EMPTY STATE */}
          {status === "empty" && (
            <div className="p-4 text-center">
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <SearchX className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-ink">
                No products found for &ldquo;{q}&rdquo;
              </p>
              <p className="mt-1 text-xs text-ink-soft max-w-xs mx-auto">
                Check for typos or try searching for general groceries like milk, bread, or snacks.
              </p>

              <div className="mt-3.5 border-t border-gray-100 pt-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">
                  Try searching for
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {TRENDING_SEARCHES.slice(0, 5).map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setQ(term);
                        executeSearch(term);
                      }}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STATE 5: ERROR STATE */}
          {status === "error" && (
            <div className="p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-ink">Couldn&apos;t load suggestions</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {errorMsg || "Network connection issue"}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => executeSearch(q)}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  Search anyway
                  <CornerDownLeft className="h-3 w-3 ml-1" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const curr = q;
                    setQ("");
                    setTimeout(() => setQ(curr), 50);
                  }}
                  className="btn-outline text-xs py-1.5 px-3"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
