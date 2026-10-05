'use client';

import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';

const pieceSymbols: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes + ':' + remainingSeconds.toString().padStart(2, '0');
}

export default function Home() {
  const [game, setGame] = useState(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [clockMinutes, setClockMinutes] = useState(10);
  const [incrementSeconds, setIncrementSeconds] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [botElo, setBotElo] = useState<number | null>(null);
  const [botColor, setBotColor] = useState<'w' | 'b'>('b');
  const [botThinking, setBotThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const requestedFenRef = useRef<string | null>(null);
  const pendingGameRef = useRef<Chess | null>(null);
  const gameGenerationRef = useRef(0);
  const pendingGenerationRef = useRef<number | null>(null);
  const isFlipped = botElo !== null && botColor === 'w';
  const boardRows = game.board();
  const board = isFlipped ? boardRows.slice().reverse().map((row) => row.slice().reverse()) : boardRows;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'bot') {
      const elo = Number(params.get('elo'));
      if ([500, 1000, 1500, 2000, 2500].includes(elo)) setBotElo(elo);
      const color = params.get('color');
      if (color === 'black') setBotColor('w');
      else if (color === 'random') setBotColor(Math.random() < 0.5 ? 'w' : 'b');
      else setBotColor('b');
      const minutes = Number(params.get('time'));
      const increment = Number(params.get('increment'));
      if ([0, 1, 3, 5, 10, 15, 30].includes(minutes)) {
        setClockMinutes(minutes);
        setWhiteTime(minutes * 60);
        setBlackTime(minutes * 60);
      }
      if ([0, 1, 2, 5, 10].includes(increment)) setIncrementSeconds(increment);
    }
  }, []);

  useEffect(() => {
    if (botElo === null) return;
    let worker: Worker;
    try {
      worker = new Worker('/stockfish/stockfish-19-lite-single.js');
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<string>) => {
        const message = String(event.data);
        if (message.includes('uciok')) {
          worker.postMessage('setoption name Threads value 1');
          worker.postMessage('setoption name Hash value 16');
          worker.postMessage('isready');
          return;
        }
        if (message.includes('readyok')) {
          readyRef.current = true;
          setEngineReady(true);
          return;
        }
        if (message.startsWith('bestmove')) {
          if (pendingGenerationRef.current !== gameGenerationRef.current) return;
          const uciMove = message.split(/\s+/)[1];
          const current = pendingGameRef.current;
          if (current && uciMove && uciMove !== '(none)' && uciMove !== '0000') {
            try {
              const move = current.move({
                from: uciMove.slice(0, 2),
                to: uciMove.slice(2, 4),
                promotion: uciMove[4] ?? 'q',
              });
              setMoves((oldMoves) => [...oldMoves, move.san]);
              const nextGame = new Chess(current.fen());
              if (clockMinutes > 0 && incrementSeconds > 0) {
                if (move.color === 'w') setWhiteTime((time) => time + incrementSeconds);
                else setBlackTime((time) => time + incrementSeconds);
              }
              setGame(nextGame);
            } catch {
              setEngineError('Der Bot-Zug konnte nicht übernommen werden. Bitte starte ein neues Spiel.');
            }
          }
          pendingGameRef.current = null;
          pendingGenerationRef.current = null;
          setBotThinking(false);
        }
      };
      worker.onerror = () => {
        setEngineError('Der Bot konnte nicht geladen werden. Bitte lade die Seite neu und versuche es noch einmal.');
        setBotThinking(false);
      };
      worker.postMessage('uci');
    } catch {
      setEngineError('Dein Browser konnte den Bot nicht starten. Bitte lade die Seite neu.');
    }
    return () => {
      readyRef.current = false;
      workerRef.current = null;
      worker.terminate();
    };
  }, [botElo, botColor, clockMinutes, incrementSeconds]);

  useEffect(() => {
    if (clockMinutes === 0) return;
    const timer = setInterval(() => {
      if (game.isGameOver()) return;
      if (game.turn() === 'w') setWhiteTime((time) => Math.max(0, time - 1));
      else setBlackTime((time) => Math.max(0, time - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [game, clockMinutes]);

  useEffect(() => {
    if (botElo === null || game.turn() !== botColor || game.isGameOver() || (clockMinutes > 0 && (whiteTime === 0 || blackTime === 0))) return;
    if (!readyRef.current || !workerRef.current) return;
    const fen = game.fen();
    if (requestedFenRef.current === fen) return;
    requestedFenRef.current = fen;
    pendingGameRef.current = new Chess(fen);
    pendingGenerationRef.current = gameGenerationRef.current;
    setBotThinking(true);
    setEngineError('');
    const engine = workerRef.current;
    const targetElo = Math.max(1320, botElo);
    const depth = botElo === 500 ? 1 : botElo === 1000 ? 4 : botElo === 1500 ? 8 : botElo === 2000 ? 9 : 10;
    if (pendingGenerationRef.current !== gameGenerationRef.current) return;
    engine.postMessage('setoption name UCI_LimitStrength value true');
    engine.postMessage('setoption name UCI_Elo value ' + targetElo);
    engine.postMessage('position fen ' + fen);
    engine.postMessage('go depth ' + depth);
  }, [game, botElo, botColor, whiteTime, blackTime, engineReady]);

  function handleSquareClick(square: string) {
    if (game.isGameOver() || (clockMinutes > 0 && (whiteTime === 0 || blackTime === 0)) || botThinking) return;
    if (botElo !== null && game.turn() === botColor) return;
    const piece = game.get(square as never);
    if (selectedSquare) {
      try {
        const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        setMoves((oldMoves) => [...oldMoves, move.san]);
        if (clockMinutes > 0 && incrementSeconds > 0) {
          if (move.color === 'w') setWhiteTime((time) => time + incrementSeconds);
          else setBlackTime((time) => time + incrementSeconds);
        }
        const nextGame = new Chess(game.fen());
        setGame(nextGame);
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      } catch {
        // Ungültiger Zug; eine eigene Figur kann neu ausgewählt werden.
      }
    }
    if (piece && piece.color === game.turn()) {
      const availableMoves = game.moves({ square: square as never, verbose: true });
      setSelectedSquare(square);
      setPossibleMoves(availableMoves.map((move) => move.to));
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }

  function newGame() {
    gameGenerationRef.current += 1;
    requestedFenRef.current = null;
    pendingGenerationRef.current = null;
    pendingGameRef.current = null;
    workerRef.current?.postMessage('stop');
    setGame(new Chess());
    setSelectedSquare(null);
    setPossibleMoves([]);
    setWhiteTime(clockMinutes * 60);
    setBlackTime(clockMinutes * 60);
    setMoves([]);
    setBotThinking(false);
    setEngineError('');
  }

  const userColor = botColor === 'w' ? 'b' : 'w';
  const currentPlayer = botElo !== null
    ? game.turn() === botColor ? 'Bot' : 'Du (' + (userColor === 'w' ? 'Weiß' : 'Schwarz') + ')'
    : game.turn() === 'w' ? 'Weiß' : 'Schwarz';
  let status = 'Am Zug: ' + currentPlayer;
  if (clockMinutes > 0 && whiteTime === 0) status = '⏱️ Zeit abgelaufen – ' + (botElo !== null ? (botColor === 'b' ? 'Bot' : 'Du') : 'Schwarz') + ' gewinnt.';
  else if (clockMinutes > 0 && blackTime === 0) status = '⏱️ Zeit abgelaufen – ' + (botElo !== null ? (botColor === 'w' ? 'Bot' : 'Du') : 'Weiß') + ' gewinnt.';
  else if (game.isCheckmate()) status = '♚ Schachmatt! ' + (game.turn() === 'w' ? 'Schwarz' : 'Weiß') + ' gewinnt.';
  else if (game.isStalemate()) status = '🤝 Patt – Unentschieden.';
  else if (game.isDraw()) status = '🤝 Remis – Unentschieden.';
  else if (botThinking) status = '🤖 Der Bot denkt nach …';
  else if (game.inCheck()) status = '⚠️ Schach! ' + currentPlayer + ' muss reagieren.';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center px-4 py-10">
        <div className="mb-6 w-full max-w-2xl">
          <a href="/" className="text-sm text-slate-300 underline underline-offset-4 hover:text-white">← Zur Startseite</a>
          {botElo !== null && <p className="mt-3 text-sm text-emerald-300">Spiel gegen den {botElo}-Elo-Bot · Du spielst {userColor === 'w' ? 'Weiß' : 'Schwarz'} · {clockMinutes === 0 ? 'ohne Zeit' : clockMinutes + '+' + incrementSeconds}</p>}
        </div>
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">♟️</div>
          <h1 className="text-4xl font-bold">Deine Schachplattform</h1>
          <p className="mt-2 text-slate-300">Schach. Community. Creator. Deine persönliche Schachreise.</p>
        </div>
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-center font-semibold" role="status">{status}</div>
        {engineError && <p role="alert" className="mb-4 max-w-2xl rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">{engineError}</p>}
        {botElo !== null && !engineReady && !engineError && <p className="mb-4 text-sm text-slate-400">Bot wird geladen …</p>}
        <div className="mb-4 flex w-full max-w-2xl justify-between gap-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3"><div className="text-sm text-slate-400">{botElo !== null && botColor === 'w' ? 'Bot (Weiß)' : 'Weiß'}</div><div className="text-2xl font-bold">{clockMinutes === 0 ? '∞' : formatTime(whiteTime)}</div></div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-right"><div className="text-sm text-slate-400">{botElo !== null && botColor === 'b' ? 'Bot (Schwarz)' : 'Schwarz'}</div><div className="text-2xl font-bold">{clockMinutes === 0 ? '∞' : formatTime(blackTime)}</div></div>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="overflow-hidden rounded-xl border-4 border-slate-700 shadow-2xl">
            <div className="relative grid grid-cols-8">
              {board.map((row, rowIndex) => row.map((piece, colIndex) => {
                const square = isFlipped
                  ? String.fromCharCode(104 - colIndex) + (rowIndex + 1)
                  : String.fromCharCode(97 + colIndex) + (8 - rowIndex);
                const isLight = (rowIndex + colIndex) % 2 === 0;
                return (
                  <button key={square} type="button" aria-label={square + (piece ? ', ' + (piece.color === 'w' ? 'weiße' : 'schwarze') + ' Figur' : '')}
                    disabled={botThinking || (botElo !== null && game.turn() === botColor)}
                    onClick={() => handleSquareClick(square)}
                    className={'relative flex aspect-square w-11 items-center justify-center text-3xl disabled:cursor-wait sm:w-16 sm:text-5xl md:w-20 md:text-6xl ' + (isLight ? 'bg-amber-100' : 'bg-amber-700') + (selectedSquare === square ? ' ring-4 ring-blue-500 ring-inset' : '')}>
                    {piece && <span className={piece.color === 'w' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-slate-900 drop-shadow-[0_2px_2px_rgba(255,255,255,0.5)]'}>{pieceSymbols[piece.color + piece.type.toUpperCase()]}</span>}
                    {possibleMoves.includes(square) && <span className="absolute h-3 w-3 rounded-full bg-slate-800/60" />}
                  </button>
                );
              }))}
            </div>

          </div>
          <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4 lg:w-64">
            <h2 className="mb-3 text-lg font-bold">Zugliste</h2>
            {moves.length === 0 ? <p className="text-sm text-slate-500">Noch keine Züge.</p> : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {moves.map((move, index) => <div key={index} className="rounded bg-slate-800 px-2 py-1">{index % 2 === 0 ? (Math.floor(index / 2) + 1) + '. ' + move : move}</div>)}
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={newGame} className="mt-6 rounded-xl bg-white px-6 py-3 font-semibold text-slate-950">🔄 Neues Spiel</button>
        <p className="mt-5 max-w-md text-center text-sm text-slate-400">{clockMinutes === 0 ? 'Ohne Zeitbegrenzung' : 'Bedenkzeit: ' + clockMinutes + '+' + incrementSeconds + ' · nach jedem Zug +' + incrementSeconds + ' s'} · Wähle eine Figur und anschließend ihr Zielfeld.</p>
      </div>
    </main>
  );
}
