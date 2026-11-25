/**
 * Curated excluded vocabulary for ChangeIt:
 * - Offensive, explicit, anatomical/sexual, hateful, and extremist words
 * - Vowelless noise/interjections, Roman numerals, and unsupported abbreviations
 * - Awkward/archaic/obscure tokens excluded from Puzzle Vocabulary
 */

export const EXCLUDED_WORDS: ReadonlySet<string> = new Set([
  // Profanity, slurs, sexual & explicit terms
  'ANAL', 'ANUS', 'ARSE', 'ARSES', 'ASS', 'ASSES', 'BASTAD', 'BITCH', 'BITCHS',
  'BLOODY', 'BOLLOX', 'BONER', 'BONERS', 'BOOB', 'BOOBS', 'BOOBY',
  'BUGGER', 'BUTT', 'BUTTS', 'CHINK', 'CHINKS', 'CLIT', 'CLITS', 'COCK', 'COCKS',
  'COCKY', 'COON', 'COONS', 'CRAP', 'CRAPS', 'CRAPPY', 'CUM', 'CUMS', 'CUNNY',
  'CUNT', 'CUNTS', 'DAMN', 'DAMNED', 'DICK', 'DICKS', 'DICKY', 'DILDO', 'DILDOS',
  'DONG', 'DONGS', 'DYKE', 'DYKES', 'ERECT', 'EROTIC', 'FAG', 'FAGGOT', 'FAGS',
  'FANNY', 'FART', 'FARTS', 'FECK', 'FELCH', 'FETISH', 'FUCK', 'FUCKED', 'FUCKER',
  'FUCKS', 'GODDAM', 'GOOK', 'GOOKS', 'HEIL', 'HOMO', 'HOMOS', 'HORNY',
  'INCEST', 'JERK', 'JERKS', 'JIZZ', 'KIKE', 'KIKES', 'KINKY', 'LABIA', 'LEZZIE',
  'LIBIDO', 'LUST', 'LUSTS', 'LUSTY', 'MILF', 'MORON', 'MORONS', 'MUFF', 'NAZI',
  'NAZIS', 'NEGRO', 'NIGGA', 'NIGGER', 'NIPPLE', 'NUDE', 'NUDES', 'NUDITY',
  'ORGASM', 'ORGY', 'PANTY', 'PENIS', 'PERV', 'PIMP', 'PIMPS', 'PISS', 'PISSED',
  'PISSES', 'POOF', 'POOP', 'POOPS', 'PORN', 'PORNO', 'PRICK', 'PRICKS', 'PUBES',
  'PUBIC', 'PUSSY', 'QUEEF', 'QUEER', 'QUEERS', 'RAPE', 'RAPED', 'RAPER', 'RAPES',
  'RAPIST', 'RECTAL', 'RECTUM', 'RETARD', 'RIMJOB', 'SCROT', 'SEMEN', 'SEX',
  'SEXED', 'SEXES', 'SEXUAL', 'SEXY', 'SHAG', 'SHAGS', 'SHIT', 'SHITS', 'SHITTY',
  'SKANK', 'SKANKS', 'SLUT', 'SLUTS', 'SLUTTY', 'SMUT', 'SMUTTY', 'SODOMY',
  'SPERM', 'SPIC', 'SPICS', 'SPUNK', 'SUCK', 'SUCKS', 'SUICID',
  'TESTES', 'TIT', 'TITS', 'TITTY', 'TOPLESS', 'TURD', 'TURDS', 'TWAT', 'TWATS',
  'URINE', 'VAGINA', 'VIAGRA', 'VULVA', 'WANK', 'WANKER', 'WANKS', 'WHORE',
  'WHORES', 'WUSS', 'WTF', 'XXX',

  // Vowelless noise, Roman numerals, unsupported abbreviations
  'AAH', 'AAHS', 'BRR', 'BRRR', 'CWM', 'CWMS', 'GRR', 'HMM', 'HMMS', 'III',
  'MMH', 'MMM', 'NTH', 'PFF', 'PHT', 'PSH', 'PSS', 'PSST', 'SHH', 'SHHH',
  'TSK', 'TSKS', 'TWP', 'VII', 'VIII', 'XII', 'XIII', 'XIV', 'XIX', 'XVI',
  'XVII', 'XXV', 'ZUZ', 'ZZZ', 'ZZZS',
]);

/**
 * Words allowed in Validation Vocabulary (legitimate ENABLE1 words)
 * that should NOT be selected as starting/target words or required bridges
 * in Puzzle Vocabulary because they are archaic, overly obscure, or awkward.
 */
export const OBSCURE_PUZZLE_EXCLUSIONS: ReadonlySet<string> = new Set([
  'SOOK', 'CATES', 'HIST', 'DORK', 'DORKS', 'GARTH', 'GATH', 'SNOT', 'TOFF',
  'BLAB', 'CLOP', 'GLOP', 'BUM', 'DAMN', 'HELL', 'SLAY', 'KILL', 'DUMB',
  'UGLY', 'AAL', 'ABA', 'ABY', 'ADZ', 'AERO', 'AERY', 'AESC', 'AGAR',
  'AGIN', 'AGIO', 'AGLY', 'AGMA', 'AGON', 'AGUE', 'AITS', 'AJEE', 'AKEE',
  'ALAE', 'ALBS', 'ALEC', 'ALEF', 'ALIF', 'ALKY', 'ALME', 'ALOW', 'AMAH',
  'AMBO', 'AMIA', 'AMIR', 'AMUS', 'AMYL', 'ANAS', 'ANES', 'ANGA', 'ANIL',
  'ANOA', 'ANSA', 'ANTA', 'APOD', 'APOS', 'ARAK', 'ARBS', 'ARFS', 'ARIL',
  'ARUM', 'ARVO', 'ARYL', 'ASCI', 'ATAP', 'ATMA', 'AUKS', 'AVOS', 'AYAH',
  'AYIN', 'AZAN', 'AZON', 'BAAL', 'BAAS', 'BABU', 'BAFF', 'BAHT', 'BALS',
  'BAMS', 'BANI', 'BAPS', 'BAUD', 'BEDU', 'BELS', 'BEMA', 'BENE', 'BENS',
  'BHUT', 'BIBB', 'BIFF', 'BIMA', 'BINT', 'BIOG', 'BIRK', 'BIRL', 'BIRO',
  'BIRR', 'BISE', 'BISK', 'BIZE', 'BLAE', 'BLAT', 'BLAW', 'BLEB', 'BLIN',
  'BLUB', 'BOCK', 'BOFF', 'BOLA', 'BOLO', 'BORA', 'BORK', 'BORT', 'BOSK',
  'BOTA', 'BOTT', 'BOYO', 'BRAE', 'BRAW', 'BREE', 'BREN', 'BRIN', 'BRIS',
  'BROO', 'BRUT', 'BRUX', 'BUBO', 'BUBS', 'BUBU', 'BUHL', 'BUHR', 'BUMF',
  'BUNA', 'BURA', 'BURB', 'BURD', 'BUTE', 'BYRE', 'BYRL',
]);

export function isExcludedWord(word: string): boolean {
  const upper = word.trim().toUpperCase();
  return EXCLUDED_WORDS.has(upper);
}
