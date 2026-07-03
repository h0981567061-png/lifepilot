import { useState } from "react";
import type { Category } from "../categories";
import { COLOR_OPTIONS, ICON_OPTIONS, colorDot } from "../categories";
import { useCategoryStore } from "../CategoryContext";
import type { Reminder } from "../store";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  savedReminders: Reminder[];
  onClose: () => void;
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditCategoryModal({
  category,
  onSave,
  onClose,
}: {
  category: Category;
  onSave: (patch: { name: string; color: string; icon: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [icon, setIcon] = useState(category.icon);
  const [showIconGrid, setShowIconGrid] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border-t border-white/10 rounded-t-2xl p-6 pb-10 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-white">編輯群組</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Name */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">群組名稱</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">群組顏色</p>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                title={c.label}
                className={`w-7 h-7 rounded-full transition-all ${c.dot} ${
                  color === c.value
                    ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110"
                    : "opacity-60 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Icon */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">群組圖示</p>
          <button
            type="button"
            onClick={() => setShowIconGrid((v) => !v)}
            className="flex items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <span className="text-xl">{icon}</span>
            <span>選擇圖示</span>
          </button>
          {showIconGrid && (
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { setIcon(em); setShowIconGrid(false); }}
                  className={`text-xl w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 ${
                    icon === em ? "bg-white/15 ring-1 ring-white/30" : ""
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => onSave({ name: name.trim() || category.name, color, icon })}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
          >
            儲存
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm transition-colors hover:text-white"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Category Modal ───────────────────────────────────────────────────────

function AddCategoryModal({
  onSave,
  onClose,
}: {
  onSave: (name: string, color: string, icon: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [icon, setIcon] = useState("📎");
  const [showIconGrid, setShowIconGrid] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border-t border-white/10 rounded-t-2xl p-6 pb-10 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-white">新增群組</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">群組名稱</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim(), color, icon); }}
            placeholder="如 家庭、工作、小孩"
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">群組顏色</p>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                title={c.label}
                className={`w-7 h-7 rounded-full transition-all ${c.dot} ${
                  color === c.value
                    ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110"
                    : "opacity-60 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">群組圖示</p>
          <button
            type="button"
            onClick={() => setShowIconGrid((v) => !v)}
            className="flex items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <span className="text-xl">{icon}</span>
            <span>選擇圖示</span>
          </button>
          {showIconGrid && (
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { setIcon(em); setShowIconGrid(false); }}
                  className={`text-xl w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 ${
                    icon === em ? "bg-white/15 ring-1 ring-white/30" : ""
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => onSave(name.trim(), color, icon)}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
          >
            建立群組
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-sm transition-colors hover:text-white"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  inUse,
  onEdit,
  onToggle,
  onDelete,
}: {
  category: Category;
  inUse: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dot = colorDot(category.color);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-none transition-opacity ${
        category.enabled ? "" : "opacity-50"
      }`}
    >
      {/* Icon + color */}
      <div className="relative w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
        {category.icon}
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-900 ${dot}`} />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{category.name}</p>
        {!category.enabled && (
          <p className="text-[10px] text-gray-600">已隱藏</p>
        )}
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 shrink-0">
          {inUse ? (
            <span className="text-[10px] text-amber-400 mr-1">仍有事項使用中</span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!inUse) {
                onDelete();
              } else {
                onToggle();
                setConfirmDelete(false);
              }
            }}
            className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
              inUse
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                : "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
            }`}
          >
            {inUse ? "停用" : "確認刪除"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          {!category.isSystem && (
            <button
              type="button"
              onClick={onEdit}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
            >
              編輯
            </button>
          )}
          <button
            type="button"
            onClick={category.isSystem ? onToggle : () => setConfirmDelete(true)}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
          >
            {category.isSystem
              ? category.enabled ? "隱藏" : "恢復"
              : "刪除"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CategoryManagementPage ───────────────────────────────────────────────────

export function CategoryManagementPage({ savedReminders, onClose }: Props) {
  const { categories, addCategory, updateCategory, deleteCategory, toggleEnabled } =
    useCategoryStore();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const customCategories = categories
    .filter((c) => !c.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const systemCategories = categories
    .filter((c) => c.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function isCategoryInUse(cat: Category): boolean {
    return savedReminders.some((r) => r.category === cat.name);
  }

  function handleAdd(name: string, color: string, icon: string) {
    addCategory({ name, color, icon });
    setShowAdd(false);
  }

  function handleEdit(patch: { name: string; color: string; icon: string }) {
    if (!editingId) return;
    updateCategory(editingId, patch);
    setEditingId(null);
  }

  const editingCat = editingId ? categories.find((c) => c.id === editingId) : null;

  return (
    <>
      <div className="max-w-2xl mx-auto px-6 py-6 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            返回
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">群組管理</h1>
          <p className="text-gray-500 text-sm">建立與管理你的個人群組</p>
        </div>

        {/* 我的分類 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              我的群組
            </h2>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-blue-400 hover:text-blue-300 hover:border-blue-500/30 transition-all"
            >
              ＋ 新增群組
            </button>
          </div>

          {customCategories.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center">
              <p className="text-sm text-gray-600">尚無自訂群組</p>
              <p className="text-xs text-gray-700 mt-1">點擊「＋ 新增群組」建立你的第一個群組</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              {customCategories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  inUse={isCategoryInUse(cat)}
                  onEdit={() => setEditingId(cat.id)}
                  onToggle={() => toggleEnabled(cat.id)}
                  onDelete={() => deleteCategory(cat.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 預設分類 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            預設群組
          </h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            {systemCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                inUse={isCategoryInUse(cat)}
                onEdit={() => {}}
                onToggle={() => toggleEnabled(cat.id)}
                onDelete={() => {}}
              />
            ))}
          </div>
          <p className="text-xs text-gray-700 text-center mt-3">
            預設群組不能永久刪除，可隱藏以避免出現在選單
          </p>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <AddCategoryModal
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Edit Modal */}
      {editingCat && (
        <EditCategoryModal
          category={editingCat}
          onSave={handleEdit}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}
