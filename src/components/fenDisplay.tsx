import { useEffect, useState } from "react";
import { toast } from "sonner";

type FenData = {
  fen: string;
  gameId: string | null;
  timestamp: number;
};

const FenDisplay = () => {
  const [fenData, setFenData] = useState<FenData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadFen = () => {
    chrome.storage.local.get(["chessiroFen"], (result) => {
      setIsLoading(false);
      if (result.chessiroFen) {
        setFenData(result.chessiroFen as FenData);
      } else {
        setFenData(null);
      }
    });
  };

  useEffect(() => {
    loadFen();

    // Listen for storage changes (content script updates the FEN in real-time)
    const handleChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.chessiroFen) {
        const newValue = changes.chessiroFen.newValue as FenData | undefined;
        setFenData(newValue ?? null);
        setIsLoading(false);
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  const handleCopy = async () => {
    if (!fenData?.fen) return;
    try {
      await navigator.clipboard.writeText(fenData.fen);
      setCopied(true);
      toast.success("FEN copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy FEN");
    }
  };

  if (isLoading) {
    return (
      <div className="fen-card fen-loading">
        <div className="fen-spinner" />
        <span className="fen-loading-text">Loading position…</span>
      </div>
    );
  }

  if (!fenData) {
    return (
      <div className="fen-card fen-empty">
        <div className="fen-empty-icon">♟</div>
        <p className="fen-empty-title">No active game found</p>
        <p className="fen-empty-sub">
          Open a Chess.com game to see the FEN here.
        </p>
      </div>
    );
  }

  const relTime = fenData.timestamp
    ? new Date(fenData.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="fen-card fen-active">
      <div className="fen-header">
        <span className="fen-badge">
          <span className="fen-dot" />
          Live FEN
        </span>
        {relTime && <span className="fen-time">Updated {relTime}</span>}
      </div>

      <div className="fen-string-wrap" onClick={handleCopy} title="Click to copy">
        <code className="fen-string">{fenData.fen}</code>
        <button className={`fen-copy-btn ${copied ? "fen-copy-btn--done" : ""}`}>
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>

      {fenData.gameId && (
        <p className="fen-gameid">Game ID: {fenData.gameId}</p>
      )}
    </div>
  );
};

export default FenDisplay;
