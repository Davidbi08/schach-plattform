import type { Chess } from "chess.js";

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;

export function getMaterialAdvantage(game: Chess) {
  let white = 0;
  let black = 0;

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      if (piece.color === "w") white += PIECE_VALUES[piece.type];
      else black += PIECE_VALUES[piece.type];
    }
  }

  return white - black;
}

export function describeMaterialAdvantage(advantage: number, perspective: "w" | "b") {
  const relativeAdvantage = perspective === "w" ? advantage : -advantage;
  if (relativeAdvantage === 0) return { score: "0", description: "Material ausgeglichen", ahead: false };
  const points = Math.abs(relativeAdvantage);
  return relativeAdvantage > 0
    ? { score: `+${points}`, description: `Du hast ${points} Punkt${points === 1 ? "" : "e"} mehr`, ahead: true }
    : { score: `−${points}`, description: `Dein Gegner hat ${points} Punkt${points === 1 ? "" : "e"} mehr`, ahead: false };
}
