import { Chess } from "chess.js";
import type { BestMoveResult, EngineLineResult } from "../hooks/useStockfish";

type Props = {
  result: BestMoveResult;
  fen: string | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** UCI → SAN (e.g. "e2e4" → "e4", "e1g1" → "O-O"). Falls back to UCI. */
function toSAN(uci: string, fen: string): string {
  try {
    const chess = new Chess(fen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length === 5 ? { promotion: uci[4] } : {}) } as any);
    if (m) return m.san;
  } catch { /* fall through */ }
  return uci;
}

/** Centipawns → "+1.23" / "–0.45" string */
function fmtScore(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  if (score === null) return "–";
  const v = (score / 100).toFixed(2);
  return score >= 0 ? `+${v}` : `${v}`;
}

/** Clamp score to a bar percentage (0–100) centred at 50 */
function barPct(score: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 100 : 0;
  if (score === null) return 50;
  // ±800 cp maps to 0–100%
  return Math.min(100, Math.max(0, 50 + (score / 800) * 50));
}

function scoreColorClass(score: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? "bm-score--win" : "bm-score--loss";
  if (score === null) return "";
  if (score > 50) return "bm-score--win";
  if (score < -50) return "bm-score--loss";
  return "bm-score--equal";
}

// ─── Sub-component: one engine line ─────────────────────────────────────────

const RANK_LABEL = ["1st", "2nd", "3rd"];

function EngineLine({ line, rank, fen }: { line: EngineLineResult; rank: number; fen: string }) {
  const { move, score, mate } = line;
  if (!move) return null;

  const san        = toSAN(move, fen);
  const scoreStr   = fmtScore(score, mate);
  const colorClass = scoreColorClass(score, mate);
  const pct        = barPct(score, mate);

  return (
    <div className={`bm-line ${rank === 0 ? "bm-line--primary" : "bm-line--secondary"}`}>
      {/* Rank badge */}
      <span className={`bm-rank bm-rank--${rank + 1}`}>{RANK_LABEL[rank]}</span>

      {/* SAN move */}
      <span className="bm-line-move">{san}</span>

      {/* Eval bar */}
      <div className="bm-bar" title={`${score ?? ""}cp`}>
        <div className="bm-bar__fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Score chip */}
      <span className={`bm-score ${colorClass}`}>{scoreStr}</span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const BestMove = ({ result, fen }: Props) => {
  if (!fen) return null;

  const { loading, error, lines } = result;

  if (loading) {
    return (
      <div className="bm-card bm-loading">
        <div className="bm-spinner" />
        <span className="bm-loading-text">Analysing position…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bm-card bm-error">
        <span className="bm-error-icon">⚠</span>
        <span className="bm-error-text">Engine error: {error}</span>
      </div>
    );
  }

  const hasLines = lines.some((l) => l.move);
  if (!hasLines) return null;

  const depth = lines[0]?.depth;

  return (
    <div className="bm-card bm-active">
      {/* Header */}
      <div className="bm-header">
        <span className="bm-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" className="bm-icon">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Top Lines
        </span>
        {depth && <span className="bm-depth">depth {depth}</span>}
      </div>

      {/* 3 engine lines */}
      <div className="bm-lines">
        {lines.map((line, i) => (
          <EngineLine key={i} line={line} rank={i} fen={fen} />
        ))}
      </div>
    </div>
  );
};

export default BestMove;
