import { useEffect, useRef, useState, useCallback } from "react";

export type EngineLineResult = {
  move: string | null; // UCI e.g. "e2e4"
  ponder: string | null;
  score: number | null; // centipawns (null if mate)
  mate: number | null; // moves to mate (null if not mate)
  depth: number | null;
};

export type BestMoveResult = {
  lines: EngineLineResult[]; // up to 3, ordered best → worst
  loading: boolean;
  error: string | null;
};

// const EMPTY_LINE: EngineLineResult = {
//   move: null,
//   ponder: null,
//   score: null,
//   mate: null,
//   depth: null,
// };

const MULTI_PV = 3;

const INITIAL: BestMoveResult = {
  lines: [],
  loading: false,
  error: null,
};

/**
 * Runs Stockfish in a Web Worker (UCI protocol) with MultiPV 3.
 * Exposes `analyse(fen)` to trigger analysis.
 */
export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<BestMoveResult>(INITIAL);
  const pendingFenRef = useRef<string | null>(null);
  const readyRef = useRef(false);

  // Scratch accumulator — keyed by multipv index (1-based)
  const linesRef = useRef<Record<number, EngineLineResult>>({});

  // Initialise the worker once
  useEffect(() => {
    const worker = new Worker("/stockfish.js");
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;

      // Engine ready
      if (line === "uciok") {
        worker.postMessage(`setoption name MultiPV value ${MULTI_PV}`);
        worker.postMessage("isready");
        return;
      }
      if (line === "readyok") {
        readyRef.current = true;
        if (pendingFenRef.current) {
          sendPosition(worker, pendingFenRef.current);
          pendingFenRef.current = null;
        }
        return;
      }

      // info depth 20 multipv 1 score cp 30 … pv e2e4 e7e5 …
      if (
        line.startsWith("info") &&
        line.includes("score") &&
        line.includes("multipv")
      ) {
        const depthMatch = line.match(/depth (\d+)/);
        const mpvMatch = line.match(/multipv (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(
          / pv ([a-h][1-8][a-h][1-8][qrbn]?)(?: ([a-h][1-8][a-h][1-8][qrbn]?))?/,
        );

        const pvIndex = mpvMatch ? parseInt(mpvMatch[1]) : 1;

        linesRef.current[pvIndex] = {
          move: pvMatch?.[1] ?? linesRef.current[pvIndex]?.move ?? null,
          ponder: pvMatch?.[2] ?? linesRef.current[pvIndex]?.ponder ?? null,
          score: cpMatch
            ? parseInt(cpMatch[1])
            : (linesRef.current[pvIndex]?.score ?? null),
          mate: mateMatch ? parseInt(mateMatch[1]) : null,
          depth: depthMatch
            ? parseInt(depthMatch[1])
            : (linesRef.current[pvIndex]?.depth ?? null),
        };

        // Publish current snapshot sorted by pvIndex
        const sorted = Object.entries(linesRef.current)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([, v]) => v);

        setResult((prev) => ({ ...prev, lines: sorted }));
        return;
      }

      // bestmove — analysis finished
      if (line.startsWith("bestmove")) {
        setResult((prev) => ({ ...prev, loading: false }));
        return;
      }
    };

    worker.onerror = (err) => {
      setResult({ ...INITIAL, error: err.message, loading: false });
    };

    worker.postMessage("uci");

    return () => {
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  const sendPosition = (worker: Worker, fen: string) => {
    worker.postMessage("stop");
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage("go depth 18");
  };

  const analyse = useCallback((fen: string) => {
    if (!fen) return;
    linesRef.current = {};
    setResult({ ...INITIAL, loading: true });

    if (!workerRef.current) return;

    if (!readyRef.current) {
      pendingFenRef.current = fen;
    } else {
      sendPosition(workerRef.current, fen);
    }
  }, []);

  return { result, analyse };
}
