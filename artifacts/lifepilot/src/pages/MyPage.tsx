// ─── MyPage ───────────────────────────────────────────────────────────────────

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  available: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: "◈",
    label: "分類管理",
    desc: "新增、編輯個人分類與顏色",
    available: false,
  },
  {
    icon: "🔔",
    label: "提醒設定",
    desc: "預設提醒偏好與通知設定",
    available: false,
  },
  {
    icon: "🗄",
    label: "資料管理",
    desc: "匯出資料、清除記錄",
    available: false,
  },
];

export function MyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">我的</h1>
        <p className="text-gray-500 text-sm">個人設定與管理</p>
      </div>

      {/* Menu list */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden divide-y divide-white/5">
        {MENU_ITEMS.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-4 px-5 py-4 opacity-50 cursor-not-allowed select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 shrink-0">
              即將推出
            </span>
          </div>
        ))}
      </div>

      {/* Version note */}
      <p className="text-xs text-gray-700 text-center mt-8">
        LifePilot · 功能持續更新中
      </p>
    </div>
  );
}
