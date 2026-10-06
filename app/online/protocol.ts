export type TimeControl = {
  id: string;
  initialSeconds: number;
  incrementSeconds: number;
  label: string;
  group: string;
};

export type OnlineRatingMode = "bullet" | "blitz" | "rapid" | "classical";

export function getOnlineRatingMode(initialSeconds: number, incrementSeconds: number): OnlineRatingMode {
  const control = ONLINE_TIME_CONTROLS.find((option) => option.initialSeconds === initialSeconds && option.incrementSeconds === incrementSeconds);
  if (control?.group === "Bullet") return "bullet";
  if (control?.group === "Blitz") return "blitz";
  if (control?.group === "Klassisch") return "classical";
  return "rapid";
}

export function getOnlineRatingModeLabel(mode: OnlineRatingMode) {
  return mode === "classical" ? "Klassisch" : mode === "bullet" ? "Bullet" : mode === "blitz" ? "Blitz" : "Rapid";
}

export const ONLINE_TIME_CONTROLS: TimeControl[] = [
  { id: "1+0", initialSeconds: 60, incrementSeconds: 0, label: "1 + 0", group: "Bullet" },
  { id: "2+1", initialSeconds: 120, incrementSeconds: 1, label: "2 + 1", group: "Bullet" },
  { id: "3+2", initialSeconds: 180, incrementSeconds: 2, label: "3 + 2", group: "Blitz" },
  { id: "5+0", initialSeconds: 300, incrementSeconds: 0, label: "5 + 0", group: "Blitz" },
  { id: "5+3", initialSeconds: 300, incrementSeconds: 3, label: "5 + 3", group: "Blitz" },
  { id: "10+0", initialSeconds: 600, incrementSeconds: 0, label: "10 + 0", group: "Rapid" },
  { id: "15+10", initialSeconds: 900, incrementSeconds: 10, label: "15 + 10", group: "Rapid" },
  { id: "30+0", initialSeconds: 1800, incrementSeconds: 0, label: "30 + 0", group: "Klassisch" },
];

export function createPlayerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "player-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatClock(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const totalSeconds = Math.ceil(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safeMilliseconds % 1000) / 100);
  return minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, "0")}`
    : `${seconds}.${tenths}`;
}

export function getRoomId(firstPlayerId: string, secondPlayerId: string) {
  return [firstPlayerId, secondPlayerId].sort().join("_");
}
