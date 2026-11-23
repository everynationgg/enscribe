import React, { useEffect, useState } from 'react';
import { BookOpen, Globe, Loader2, Volume2, X } from 'lucide-react';
import { WordDefinitionResult } from '../../shared/gridit/types';
import { fetchWordDefinition } from '../games/gridit/dictionary';

interface GridItDefinitionModalProps {
  word: string | null;
  onClose: () => void;
}

export const GridItDefinitionModal: React.FC<GridItDefinitionModalProps> = ({
  word,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordDefinitionResult | null>(null);

  useEffect(() => {
    if (!word) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchWordDefinition(word, 'en')
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [word]);

  if (!word) return null;

  return (
    <div className="ens-modal-backdrop" onClick={onClose}>
      <div
        className="ens-modal-card ens-fantasy-modal ens-dict-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Dictionary definition for ${word}`}
      >
        <div className="ens-dict-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ens-dict-icon-pill">
              <BookOpen size={17} color="#fde047" />
            </span>
            <div>
              <h3 className="ens-dict-word">{word.toUpperCase()}</h3>
              {result?.phonetic && (
                <div className="ens-dict-phonetic">
                  <Volume2 size={12} />
                  <span>{result.phonetic}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="ens-dict-close-btn"
            onClick={onClose}
            aria-label="Close dictionary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ens-dict-meta-row">
          <span className="ens-dict-lang-pill">
            <Globe size={11} />
            <span>{result?.language || 'English'}</span>
          </span>
          <span className="ens-dict-source-pill">
            Source: {result?.source || 'Free Dictionary API'}
          </span>
        </div>

        {loading ? (
          <div className="ens-dict-loading">
            <Loader2 size={20} className="ens-spin" />
            <span>Looking up verified definition...</span>
          </div>
        ) : result?.found ? (
          <div className="ens-dict-meanings">
            {result.meanings.map((m, idx) => (
              <div key={idx} className="ens-dict-meaning-card">
                <span className="ens-dict-pos">{m.partOfSpeech}</span>
                <ol className="ens-dict-def-list">
                  {m.definitions.map((d, dIdx) => (
                    <li key={dIdx} className="ens-dict-def-item">
                      <div>{d.definition}</div>
                      {d.example && (
                        <div className="ens-dict-example">&ldquo;{d.example}&rdquo;</div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <div className="ens-dict-empty">
            {result?.reason === 'offline'
              ? 'Offline right now — connect to the internet to fetch this word definition from Free Dictionary API.'
              : 'Word is valid in the GridIt dictionary, but no external definition entry was returned by Free Dictionary API.'}
          </div>
        )}
      </div>
    </div>
  );
};
