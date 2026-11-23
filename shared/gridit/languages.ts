export interface GridItLanguagePack {
  code: string;
  name: string;
  nativeName: string;
  installed: boolean;
  wordCountLabel: string;
  note: string;
}

export const GRIDIT_LANGUAGES: GridItLanguagePack[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    installed: true,
    wordCountLabel: '270,530 words',
    note: 'Full offline-cached English dictionary ready.',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    installed: false,
    wordCountLabel: 'Pack not installed',
    note: 'Architecture ready for lazy-loaded /dictionaries/es.txt pack.',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    installed: false,
    wordCountLabel: 'Pack not installed',
    note: 'Architecture ready for lazy-loaded /dictionaries/fr.txt pack.',
  },
];

export function getGridItLanguagePack(code: string): GridItLanguagePack {
  return (
    GRIDIT_LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase()) ??
    GRIDIT_LANGUAGES[0]
  );
}

/**
 * Competitive Ranked requires standardized English dictionary and standard boards,
 * while Casual / Solo / Multiplayer can choose installed packs cleanly.
 */
export function resolveModeLanguage(
  requestedCode: string,
  mode: 'solo' | 'classic' | 'board_battle' | 'ranked'
): { language: string; forcedStandard: boolean; available: boolean } {
  if (mode === 'ranked') {
    return {
      language: 'en',
      forcedStandard: requestedCode.toLowerCase() !== 'en',
      available: true,
    };
  }
  const pack = getGridItLanguagePack(requestedCode);
  return {
    language: pack.installed ? pack.code : 'en',
    forcedStandard: !pack.installed,
    available: pack.installed,
  };
}
