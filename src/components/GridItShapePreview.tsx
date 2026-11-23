import React from 'react';
import { GridItShapeId } from '../../shared/gridit/types';

export const GridItShapeMiniPreview: React.FC<{ shapeId: GridItShapeId }> = ({ shapeId }) => {
  switch (shapeId) {
    case 'square':
      return (
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="28" height="28" rx="7" fill="rgba(129,140,248,0.35)" stroke="#c7d2fe" strokeWidth="2" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect key={`${r}-${c}`} x={9 + c * 6.5} y={9 + r * 6.5} width="4.8" height="4.8" rx="1.2" fill="#eef2ff" />
            ))
          )}
        </svg>
      );
    case 'heart':
      return (
        <svg width="36" height="34" viewBox="0 0 38 36" fill="none" aria-hidden="true">
          <path
            d="M19 32 C19 32 4 23 4 12.5 C4 7.6 8 4 12.5 4 C15.4 4 17.6 5.4 19 7.6 C20.4 5.4 22.6 4 25.5 4 C30 4 34 7.6 34 12.5 C34 23 19 32 19 32 Z"
            fill="rgba(244,114,182,0.48)"
            stroke="#fbcfe8"
            strokeWidth="2"
          />
        </svg>
      );
    case 'star':
      return (
        <svg width="36" height="34" viewBox="0 0 38 36" fill="none" aria-hidden="true">
          <path
            d="M19 3 L23.4 12.2 L33.6 13.7 L26.2 20.8 L28 31 L19 26.2 L10 31 L11.8 20.8 L4.4 13.7 L14.6 12.2 Z"
            fill="rgba(250,204,21,0.48)"
            stroke="#fef08a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'triangle':
      return (
        <svg width="36" height="34" viewBox="0 0 38 36" fill="none" aria-hidden="true">
          <path
            d="M19 4 L34 31 H4 Z"
            fill="rgba(56,189,248,0.4)"
            stroke="#bae6fd"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'rectangle':
      return (
        <svg width="36" height="34" viewBox="0 0 38 36" fill="none" aria-hidden="true">
          <rect x="2" y="8" width="34" height="20" rx="6" fill="rgba(96,165,250,0.4)" stroke="#bfdbfe" strokeWidth="2" />
          {[0, 1].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect key={`${r}-${c}`} x={6.5 + c * 6.8} y={12 + r * 6.8} width="4.8" height="4.8" rx="1.2" fill="#eff6ff" />
            ))
          )}
        </svg>
      );
    case 'circle':
      return (
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <circle cx="18" cy="18" r="14" fill="rgba(192,132,252,0.42)" stroke="#e9d5ff" strokeWidth="2" />
          <circle cx="18" cy="18" r="7" fill="rgba(245,208,254,0.45)" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <path
            d="M18 3 L31 10.5 V25.5 L18 33 L5 25.5 V10.5 Z"
            fill="rgba(34,211,238,0.42)"
            stroke="#a5f3fc"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
