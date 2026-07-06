const UI_PREFS_KEY = "lifepilot_ui_prefs_v1";

export type TextSize = "small" | "medium" | "large";

interface UIPrefs {
  textSize: TextSize;
}

function defaultPrefs(): UIPrefs {
  return { textSize: "medium" };
}

export function loadUIPrefs(): UIPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<UIPrefs>;
    return { ...defaultPrefs(), ...parsed };
  } catch {
    return defaultPrefs();
  }
}

export function saveUIPrefs(prefs: Partial<UIPrefs>): void {
  const current = loadUIPrefs();
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

export function applyTextSize(textSize: TextSize): void {
  document.documentElement.dataset.textSize = textSize;
}
