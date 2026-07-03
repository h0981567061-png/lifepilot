export function PendingPage({ count }: { count: number }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">待確認</h1>
        <p className="text-gray-500 text-sm">尚未分類或需要確認的事項</p>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-2xl text-gray-600">?</span>
          </div>
          <p className="text-gray-500 text-sm text-center">
            沒有待確認事項
            <br />
            AI 解析後無法分類的事項會出現在這裡
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl font-bold text-white tabular-nums">{count}</span>
          <span className="text-gray-400 text-sm">筆待確認事項</span>
        </div>
      )}
    </div>
  );
}
