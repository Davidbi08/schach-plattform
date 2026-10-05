type PieceColor = "w" | "b";
type PieceType = "k" | "q" | "r" | "b" | "n" | "p";

/** Compact Staunton-style pieces with a shared baseline and centered view box. */
export function ChessPieceIcon({ color, type }: { color: PieceColor; type: PieceType }) {
  const white = color === "w";
  const fill = white ? "#fffdf7" : "#172033";
  const stroke = white ? "#172033" : "#fffdf7";

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="block h-[84%] w-[84%] shrink-0 overflow-visible drop-shadow-[0_2px_1px_rgba(15,23,42,0.4)]">
      <g fill={fill} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        {type === "k" && <>
          <path d="M47 7h6v8h8v6h-8v8h-6v-8h-8v-6h8z" />
          <path d="M39 34c0-8 5-12 11-12s11 4 11 12l-4 8 8 28H35l8-28z" />
          <path d="M31 71h38v7H31zM24 82h52v8H24z" />
        </>}
        {type === "q" && <>
          <path d="M28 31l11 10 11-23 11 23 11-10-5 34H33z" />
          <circle cx="27" cy="25" r="5" /><circle cx="50" cy="14" r="5" /><circle cx="73" cy="25" r="5" />
          <path d="M35 68h30l7 8H28zM23 82h54v8H23z" />
        </>}
        {type === "r" && <>
          <path d="M29 19h11v10h7V19h7v10h7V19h11v19H29z" />
          <path d="M34 41h32l-4 27H38z" />
          <path d="M30 71h40v7H30zM23 82h54v8H23z" />
        </>}
        {type === "b" && <>
          <path d="M50 14c-6 9-17 16-17 28 0 8 5 14 12 17l-9 9h28l-9-9c7-3 12-9 12-17 0-12-11-19-17-28z" />
          <path d="M43 33l14 18" fill="none" stroke={stroke} strokeWidth="4" />
          <path d="M32 71h36v7H32zM24 82h52v8H24z" />
        </>}
        {type === "n" && <>
          <path d="M30 69c4-7 5-12 1-18-5-8-1-15 7-18-2-8 2-16 10-21l9 12c10 1 18 8 20 18l-3 27H30z" />
          <path d="M44 29l11 7-13 2z" />
          <circle cx="59" cy="40" r="2.5" fill={stroke} stroke="none" />
          <path d="M31 71h39v7H31zM23 82h54v8H23z" />
        </>}
        {type === "p" && <>
          <circle cx="50" cy="28" r="12" />
          <path d="M43 41h14l5 12 9 15H29l9-15z" />
          <path d="M32 71h36v7H32zM24 82h52v8H24z" />
        </>}
      </g>
    </svg>
  );
}
