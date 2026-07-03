// ─── Category data model ──────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  color: string;    // key into COLOR_OPTIONS e.g. "blue"
  icon: string;     // emoji e.g. "💼"
  enabled: boolean; // hidden from selectors when false
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export const CATEGORY_STORAGE_KEY = "lifepilot_categories_v1";

// ─── System defaults ──────────────────────────────────────────────────────────

const SYSTEM_DEFAULTS: Omit<Category, "id" | "createdAt">[] = [
  { name: "工作",   color: "blue",    icon: "💼", enabled: true, isSystem: true, sortOrder: 10 },
  { name: "家庭",   color: "pink",    icon: "🏠", enabled: true, isSystem: true, sortOrder: 20 },
  { name: "小孩",   color: "amber",   icon: "👶", enabled: true, isSystem: true, sortOrder: 30 },
  { name: "個人",   color: "purple",  icon: "🙋", enabled: true, isSystem: true, sortOrder: 40 },
  { name: "生活",   color: "emerald", icon: "🌿", enabled: true, isSystem: true, sortOrder: 50 },
  { name: "重要",   color: "rose",    icon: "⭐", enabled: true, isSystem: true, sortOrder: 60 },
  { name: "其他",   color: "gray",    icon: "📎", enabled: true, isSystem: true, sortOrder: 70 },
];

function seedSystem(): Category[] {
  return SYSTEM_DEFAULTS.map((d) => ({
    ...d,
    id: `sys_${d.name}`,
    createdAt: new Date(0).toISOString(),
  }));
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return seedSystem();
    const stored = JSON.parse(raw) as Category[];
    // Forward-compat: add any new system categories not yet in storage
    const existingIds = new Set(stored.map((c) => c.id));
    const newSys = seedSystem().filter((s) => !existingIds.has(s.id));
    return newSys.length ? [...stored, ...newSys] : stored;
  } catch {
    return seedSystem();
  }
}

export function saveCategories(cats: Category[]): void {
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cats));
}

// ─── Color & icon palettes ────────────────────────────────────────────────────

export const COLOR_OPTIONS: { value: string; label: string; dot: string }[] = [
  { value: "blue",    label: "藍", dot: "bg-blue-500" },
  { value: "emerald", label: "綠", dot: "bg-emerald-500" },
  { value: "amber",   label: "黃", dot: "bg-amber-500" },
  { value: "rose",    label: "紅", dot: "bg-rose-500" },
  { value: "purple",  label: "紫", dot: "bg-purple-500" },
  { value: "orange",  label: "橙", dot: "bg-orange-500" },
  { value: "pink",    label: "粉", dot: "bg-pink-500" },
  { value: "teal",    label: "青", dot: "bg-teal-500" },
  { value: "sky",     label: "天", dot: "bg-sky-500" },
  { value: "gray",    label: "灰", dot: "bg-gray-500" },
];

export const ICON_OPTIONS = [
  "💼", "🏠", "👶", "🙋", "🌿", "⭐", "📎", "🐾",
  "🏋️", "🚗", "✈️", "🛒", "🎯", "💡", "🎵", "❤️",
  "📅", "🔔", "💰", "🎓", "🌍", "🏥", "🐕", "🌺",
];

export function colorDot(color: string): string {
  return COLOR_OPTIONS.find((c) => c.value === color)?.dot ?? "bg-gray-500";
}
