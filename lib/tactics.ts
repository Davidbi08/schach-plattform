export type TacticsPuzzle = { id: string; fen: string; solution: string; rating: number; theme: string; prompt: string; kind: "mate" | "capture"; };
export const tacticsPuzzles: TacticsPuzzle[] = [
 { id: "queen-mate-a", fen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1", solution: "g6g7", rating: 700, theme: "Matt in 1", prompt: "Setze den schwarzen König matt.", kind: "mate" },
 { id: "queen-mate-b", fen: "6k1/8/5KQ1/8/8/8/8/8 w - - 0 1", solution: "g6g7", rating: 850, theme: "Matt in 1", prompt: "Finde den direkten Abschluss.", kind: "mate" },
 { id: "queen-mate-c", fen: "7k/8/5K2/6Q1/8/8/8/8 w - - 0 1", solution: "g5g7", rating: 1000, theme: "Matt in 1", prompt: "Der König hat nur ein Feld frei.", kind: "mate" },
 { id: "queen-mate-d", fen: "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1", solution: "f5f8", rating: 1150, theme: "Matt in 1", prompt: "Nutze die offene achte Reihe.", kind: "mate" },
 { id: "queen-mate-e", fen: "7k/6pp/5K2/6Q1/8/8/8/8 w - - 0 1", solution: "g5g7", rating: 1300, theme: "Matt in 1", prompt: "Die eigenen Figuren nehmen dem König die Fluchtfelder.", kind: "mate" },
 { id: "queen-capture", fen: "6k1/8/8/3q4/8/2N5/8/6K1 w - - 0 1", solution: "c3d5", rating: 900, theme: "Dame gewinnen", prompt: "Die gegnerische Dame ist ungedeckt.", kind: "capture" },
 { id: "rook-capture", fen: "6k1/8/8/8/3r4/2B5/8/6K1 w - - 0 1", solution: "c3d4", rating: 1050, theme: "Turm gewinnen", prompt: "Schlage den ungedeckten Turm.", kind: "capture" },
 { id: "bishop-capture", fen: "6k1/8/8/4b3/4R3/8/8/6K1 w - - 0 1", solution: "e4e5", rating: 1100, theme: "Läufer gewinnen", prompt: "Der Läufer steht ungeschützt.", kind: "capture" },
];
export const tacticsPreviewFen = tacticsPuzzles[0].fen;
