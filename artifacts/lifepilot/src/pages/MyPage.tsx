// ─── MyPage ───────────────────────────────────────────────────────────────────

interface Props {
  onOpenCategoryMgmt: () => void;
  onOpenWorkProfiles: () => void;
}

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  available: boolean;
  onClick?: () => void;
}

export function MyPage({ onOpenCategoryMgmt, onOpenWorkProfiles }: Props) {
  const menuItems: MenuItem[] = [
    {
      icon: "💼",
      label: "工作資料板",
      desc: "管理不同工作與工作模板",
      available: true,
      onClick: onOpenWorkProfiles,
    },
    {
      icon: "◈",
      label: "群組管理",
      desc: "新增、編輯個人群組與顏色",
      available: true,
      onClick: onOpenCategoryMgmt,
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">我的</h1>
        <p className="text-gray-500 text-sm">個人設定與管理</p>
      </div>

      {/* Menu list */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden divide-y divide-white/5">
        {menuItems.map((item) =>
          item.available && item.onClick ? (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
              <svg className="w-4 h-4 text-gray-600 shrink-0" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <div
              key={item.label}
              className="flex items-center gap-4 px-5 py-4 opacity-40 cursor-not-allowed select-none"
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
          )
        )}
      </div>

      {/* Version note */}
      <p className="text-xs text-gray-700 text-center mt-8">
        LifePilot · 功能持續更新中
      </p>
    </div>
  );
}
