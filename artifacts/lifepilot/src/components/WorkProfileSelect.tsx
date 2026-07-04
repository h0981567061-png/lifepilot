// ─── WorkProfileSelect ─────────────────────────────────────────────────────────
// Shared selector used in both new-add page and edit page.
// Shows all enabled WorkProfiles.
// If currentProfileId refers to a disabled profile, it still appears with "(已停用)" tag.

import { useMemo } from "react";
import {
  getWorkProfiles,
  type WorkProfile,
} from "../workProfileStore";

interface Props {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** Pass the existing reminder's workProfileId so a disabled profile is still shown */
  currentProfileId?: string;
}

export function WorkProfileSelect({ value, onChange, currentProfileId }: Props) {
  const profiles = useMemo(() => getWorkProfiles(), []);

  const enabledProfiles = profiles.filter((p) => p.enabled);

  // If there's a current profile that is disabled, include it so edit page can still display it
  const extraProfile: WorkProfile | undefined = useMemo(() => {
    if (!currentProfileId) return undefined;
    const found = profiles.find((p) => p.id === currentProfileId);
    if (found && !found.enabled) return found;
    return undefined;
  }, [profiles, currentProfileId]);

  const optionsToShow: WorkProfile[] = extraProfile
    ? [...enabledProfiles, extraProfile]
    : enabledProfiles;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/60 transition-colors appearance-none"
      style={{ colorScheme: "dark" }}
    >
      <option value="">不指定工作</option>
      {optionsToShow.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {!p.enabled ? "（已停用）" : ""}
        </option>
      ))}
    </select>
  );
}
