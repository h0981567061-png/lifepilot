import { createContext, useContext, useState, useCallback } from "react";
import type { Category } from "./categories";
import { loadCategories, saveCategories } from "./categories";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStore {
  categories: Category[];
  enabledCategories: Category[];
  addCategory: (data: Pick<Category, "name" | "color" | "icon">) => Category;
  updateCategory: (id: string, patch: Partial<Omit<Category, "id" | "createdAt">>) => void;
  deleteCategory: (id: string) => void;
  toggleEnabled: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CategoryContext = createContext<CategoryStore | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(() => loadCategories());

  const mutate = useCallback(
    (fn: (prev: Category[]) => Category[]) => {
      setCategories((prev) => {
        const next = fn(prev);
        saveCategories(next);
        return next;
      });
    },
    []
  );

  const enabledCategories = [...categories]
    .filter((c) => c.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const addCategory = useCallback(
    (data: Pick<Category, "name" | "color" | "icon">): Category => {
      const newCat: Category = {
        id: crypto.randomUUID(),
        name: data.name.trim(),
        color: data.color,
        icon: data.icon,
        enabled: true,
        isSystem: false,
        sortOrder: Date.now(),
        createdAt: new Date().toISOString(),
      };
      mutate((prev) => [...prev, newCat]);
      return newCat;
    },
    [mutate]
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Omit<Category, "id" | "createdAt">>) => {
      mutate((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    [mutate]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      mutate((prev) => prev.filter((c) => c.id !== id));
    },
    [mutate]
  );

  const toggleEnabled = useCallback(
    (id: string) => {
      mutate((prev) =>
        prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
      );
    },
    [mutate]
  );

  return (
    <CategoryContext.Provider
      value={{
        categories,
        enabledCategories,
        addCategory,
        updateCategory,
        deleteCategory,
        toggleEnabled,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCategoryStore(): CategoryStore {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error("useCategoryStore must be used inside CategoryProvider");
  return ctx;
}
