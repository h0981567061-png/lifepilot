// ─── AirportTransferTemplateFields ────────────────────────────────────────────
// Shared component used by both PreviewItemCard (new-add page) and EditPage.
// Renders airport transfer template data fields.
// No financial fields — those belong to the unified 收支 system.

import { useState } from "react";
import type { AirportTransferTemplateData } from "../store";

const TRANSFER_TYPES: Array<{
  value: "pickup" | "dropoff" | "charter" | "one_way";
  label: string;
}> = [
  { value: "pickup",  label: "接機" },
  { value: "dropoff", label: "送機" },
  { value: "one_way", label: "單程" },
  { value: "charter", label: "包車" },
];

function TInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors"
    />
  );
}

interface Props {
  value: AirportTransferTemplateData;
  onChange: (next: AirportTransferTemplateData) => void;
}

export function AirportTransferTemplateFields({ value, onChange }: Props) {
  const [newStop, setNewStop] = useState("");

  const upd = (patch: Partial<AirportTransferTemplateData>) =>
    onChange({ ...value, ...patch });

  const stops = value.stops ?? [];
  const count = value.passengerCount ?? 1;

  function addStop() {
    const v = newStop.trim();
    if (!v) return;
    upd({ stops: [...stops, v] });
    setNewStop("");
  }

  function removeStop(i: number) {
    upd({ stops: stops.filter((_, idx) => idx !== i) });
  }

  function updateStop(i: number, text: string) {
    const next = [...stops];
    next[i] = text;
    upd({ stops: next });
  }

  return (
    <div className="space-y-4">

      {/* Transfer type — 2×2 grid for mobile clarity */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">接送類型</p>
        <div className="grid grid-cols-2 gap-2">
          {TRANSFER_TYPES.map(({ value: v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => upd({ transferType: value.transferType === v ? undefined : v })}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                value.transferType === v
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Route: pickup → stops → destination */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">出發地</p>
        <TInput
          value={value.pickupLocation ?? ""}
          onChange={(v) => upd({ pickupLocation: v })}
          placeholder="出發地點"
        />
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">中途停靠點</p>
        {stops.length === 0 && (
          <p className="text-xs text-gray-600 italic mb-2">目前沒有中途停靠點</p>
        )}
        <div className="space-y-2">
          {stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 w-4 shrink-0 text-center">{i + 1}</span>
              <input
                type="text"
                value={stop}
                onChange={(e) => updateStop(i, e.target.value)}
                className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
              />
              <button
                type="button"
                onClick={() => removeStop(i)}
                className="text-gray-500 hover:text-rose-400 transition-colors text-xs px-2 py-1 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newStop}
              onChange={(e) => setNewStop(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addStop();
                }
              }}
              placeholder="輸入停靠點，Enter 新增"
              className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
            />
            <button
              type="button"
              onClick={addStop}
              className="shrink-0 px-3 py-2 rounded-xl text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
            >
              ＋ 新增
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">目的地</p>
        <TInput
          value={value.destination ?? ""}
          onChange={(v) => upd({ destination: v })}
          placeholder="目的地點"
        />
      </div>

      {/* Flight */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">航班號碼</p>
        <TInput
          value={value.flightNumber ?? ""}
          onChange={(v) => upd({ flightNumber: v })}
          placeholder="如 CI173"
        />
      </div>

      {/* Passenger info */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">乘客姓名</p>
        <TInput
          value={value.passengerName ?? ""}
          onChange={(v) => upd({ passengerName: v })}
          placeholder="乘客姓名"
        />
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">乘客電話</p>
        <input
          type="tel"
          value={value.passengerPhone ?? ""}
          onChange={(e) => upd({ passengerPhone: e.target.value })}
          placeholder="乘客電話"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </div>

      {/* Passenger count — large touch targets */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">乘客人數</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => upd({ passengerCount: Math.max(1, count - 1) })}
            className="w-11 h-11 rounded-xl bg-white/5 border border-white/15 text-white text-xl font-medium hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
          >
            −
          </button>
          <span className="text-base font-semibold text-white w-8 text-center tabular-nums">
            {count}
          </span>
          <button
            type="button"
            onClick={() => upd({ passengerCount: count + 1 })}
            className="w-11 h-11 rounded-xl bg-white/5 border border-white/15 text-white text-xl font-medium hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
          >
            ＋
          </button>
          <span className="text-xs text-gray-500">人</span>
        </div>
      </div>

      {/* Luggage */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">行李資訊</p>
        <TInput
          value={value.luggage ?? ""}
          onChange={(v) => upd({ luggage: v })}
          placeholder="如 2 大 1 小"
        />
      </div>

      {/* ── Driver / Dispatch section ───────────────────────────────────── */}
      <div className="pt-1">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-3">
          司機 / 調度資訊
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1.5 font-medium">司機姓名</p>
              <TInput
                value={value.driverName ?? ""}
                onChange={(v) => upd({ driverName: v })}
                placeholder="司機姓名"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5 font-medium">司機電話</p>
              <TInput
                value={value.driverPhone ?? ""}
                onChange={(v) => upd({ driverPhone: v })}
                placeholder="司機電話"
                type="tel"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">車牌號碼</p>
            <TInput
              value={value.vehiclePlate ?? ""}
              onChange={(v) => upd({ vehiclePlate: v })}
              placeholder="如 RFH-7077"
            />
          </div>
        </div>
      </div>

      {/* ── Order codes ─────────────────────────────────────────────────── */}
      <OrderCodesField
        codes={value.orderCodes ?? []}
        onChange={(codes) => upd({ orderCodes: codes })}
      />

      {/* ── Payment ─────────────────────────────────────────────────────── */}
      <div className="pt-1">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-3">
          付款資訊
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">付款方式</p>
            <TInput
              value={value.paymentMethod ?? ""}
              onChange={(v) => upd({ paymentMethod: v })}
              placeholder="如 信用卡、現金、轉帳"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">付款條件</p>
            <textarea
              value={value.paymentCondition ?? ""}
              onChange={(e) => upd({ paymentCondition: e.target.value })}
              placeholder="如 不簽不收，客下後下週四轉帳"
              rows={2}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors resize-none"
            />
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── OrderCodesField ──────────────────────────────────────────────────────────

function OrderCodesField({
  codes,
  onChange,
}: {
  codes: string[];
  onChange: (codes: string[]) => void;
}) {
  const [newCode, setNewCode] = useState("");

  function addCode() {
    const v = newCode.trim().toUpperCase();
    if (!v || codes.includes(v)) return;
    onChange([...codes, v]);
    setNewCode("");
  }

  function removeCode(i: number) {
    onChange(codes.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 font-medium">訂單識別碼</p>
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {codes.map((code, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 border border-white/15 text-xs font-mono text-gray-300"
            >
              {code}
              <button
                type="button"
                onClick={() => removeCode(i)}
                className="text-gray-600 hover:text-rose-400 transition-colors leading-none ml-0.5"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCode();
            }
          }}
          placeholder="輸入識別碼，Enter 新增"
          className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 font-mono"
        />
        <button
          type="button"
          onClick={addCode}
          className="shrink-0 px-3 py-2 rounded-xl text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
        >
          ＋ 新增
        </button>
      </div>
    </div>
  );
}
