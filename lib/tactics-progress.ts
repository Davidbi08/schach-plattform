export type SavedTacticsProgress = {
  rating: number;
  solved: number;
  attempted: number;
  recent: string[];
  lastDailyDate: string | null;
  dailyStreak: number;
  dailyDates: string[];
};

export const INITIAL_TACTICS_PROGRESS: SavedTacticsProgress = {
  rating: 1000,
  solved: 0,
  attempted: 0,
  recent: [],
  lastDailyDate: null,
  dailyStreak: 0,
  dailyDates: [],
};

const STORAGE_KEY = "schach-taktik-progress-v1";
const CHANGE_EVENT = "schach-taktik-progress-change";
let cachedProgress: SavedTacticsProgress | null = null;

function readProgress(): SavedTacticsProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SavedTacticsProgress> | null;
    if (!saved) return INITIAL_TACTICS_PROGRESS;

    return {
      rating: Math.max(400, Math.min(2400, Number(saved.rating) || INITIAL_TACTICS_PROGRESS.rating)),
      solved: Math.max(0, Number(saved.solved) || 0),
      attempted: Math.max(0, Number(saved.attempted) || 0),
      recent: Array.isArray(saved.recent)
        ? saved.recent.filter((id): id is string => typeof id === "string").slice(-12)
        : [],
      lastDailyDate: typeof saved.lastDailyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.lastDailyDate)
        ? saved.lastDailyDate
        : null,
      dailyStreak: Math.max(0, Number(saved.dailyStreak) || 0),
      dailyDates: Array.isArray(saved.dailyDates)
        ? [...new Set(saved.dailyDates.filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))].slice(-60)
        : [],
    };
  } catch {
    return INITIAL_TACTICS_PROGRESS;
  }
}

export function getTacticsProgress(): SavedTacticsProgress {
  cachedProgress ??= readProgress();
  return cachedProgress;
}

export function recordDailyTacticsCompletion(
  current: SavedTacticsProgress,
  dateKey: string,
): SavedTacticsProgress {
  if (current.dailyDates.includes(dateKey)) return current;

  const previousDate = new Date(`${dateKey}T00:00:00.000Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const yesterday = previousDate.toISOString().slice(0, 10);

  return {
    ...current,
    lastDailyDate: dateKey,
    dailyStreak: current.lastDailyDate === yesterday ? current.dailyStreak + 1 : 1,
    dailyDates: [...current.dailyDates, dateKey].slice(-60),
  };
}

export function subscribeToTacticsProgress(onChange: () => void): () => void {
  const handleChange = (event: Event) => {
    if (event.type === "storage" && (event as StorageEvent).key !== STORAGE_KEY) return;
    cachedProgress = null;
    onChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(CHANGE_EVENT, handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(CHANGE_EVENT, handleChange);
  };
}

export function updateTacticsProgress(
  update: (current: SavedTacticsProgress) => SavedTacticsProgress,
): SavedTacticsProgress {
  const next = update(getTacticsProgress());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedProgress = next;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return next;
}
