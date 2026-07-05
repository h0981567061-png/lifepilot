// ─── WorkProfileSummary ────────────────────────────────────────────────────────
// Read-only summary of a WorkProfile's key fields, shown below WorkProfileSelect.
// Reads live from WorkProfile store so name changes propagate immediately.
// No edit controls — editing goes through WorkProfilesPage.

import { useMemo } from "react";
import {
  getWorkProfileById,
  type WorkProfile,
} from "../workProfileStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface DisplayField {
  label: string;
  value: string;
}

/**
 * Return up to `max` non-empty fields for display.
 * Prefers the new `fields` array; falls back to legacy `profileData`.
 */
function getDisplayFields(profile: WorkProfile, max = 4): DisplayField[] {
  // ── New storage: dynamic fields array ──────────────────────────────────────
  if (profile.fields && profile.fields.length > 0) {
    return profile.fields
      .filter((f) => f.value.trim() !== "")
      .slice(0, max)
      .map((f) => ({ label: f.label, value: f.value.trim() }));
  }

  // ── Legacy storage: flat profileData ───────────────────────────────────────
  const pd = profile.profileData;
  if (!pd) return [];

  const candidates: { label: string; value: string | undefined }[] =
    profile.templateType === "airport_transfer"
      ? [
          { label: "司機",  value: pd.driverName   },
          { label: "電話",  value: pd.driverPhone   },
          { label: "車牌",  value: pd.vehiclePlate  },
          { label: "車型",  value: pd.vehicleModel  },
          { label: "座位",  value: pd.vehicleSeats  },
        ]
      : [
          { label: "公司",  value: pd.companyName   },
          { label: "職稱",  value: pd.jobRole       },
          { label: "地點",  value: pd.workLocation  },
          { label: "聯絡",  value: pd.contactName   },
        ];

  return candidates
    .filter((f): f is { label: string; value: string } =>
      typeof f.value === "string" && f.value.trim() !== ""
    )
    .slice(0, max)
    .map((f) => ({ label: f.label, value: f.value.trim() }));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** The workProfileId currently selected in the parent WorkProfileSelect */
  workProfileId: string;
}

export function WorkProfileSummary({ workProfileId }: Props) {
  const profile = useMemo(
    () => getWorkProfileById(workProfileId),
    [workProfileId]
  );

  if (!profile) return null;

  const fields = getDisplayFields(profile);
  const isDisabled = !profile.enabled;

  // Nothing to display (profile has no filled fields)
  if (fields.length === 0 && !isDisabled) return null;

  return (
    <div className={`rounded-xl px-4 py-3 space-y-1.5 ${
      isDisabled
        ? "bg-amber-500/5 border border-amber-500/15"
        : "bg-white/[0.03] border border-white/8"
    }`}>
      {/* Disabled notice */}
      {isDisabled && (
        <p className="text-[11px] text-amber-400/80 font-medium mb-1">
          此工作已停用
        </p>
      )}

      {/* Field rows */}
      {fields.length > 0 ? (
        <div className="flex flex-col gap-1">
          {fields.map((f) => (
            <div key={f.label} className="flex items-baseline gap-2 min-w-0">
              <span className="text-[11px] text-gray-600 shrink-0 w-8 text-right">
                {f.label}
              </span>
              <span className="text-xs text-gray-400 break-all">{f.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600">（尚未填寫工作資料）</p>
      )}

      {/* Hint to edit */}
      {fields.length > 0 && (
        <p className="text-[10px] text-gray-700 pt-0.5">
          如需修改工作資料，請前往「我的 → 工作管理」
        </p>
      )}
    </div>
  );
}
