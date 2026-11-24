import assert from 'node:assert/strict';
import { CHAIN_GRAPH, CHAIN_SYNONYMS, THEME_SEEDS } from '../shared/chainit/wordGraph.js';
import {
  GUESSIT_CATEGORIES,
  GUESSIT_WORD_CATALOG,
  pickCrosswordForCategory,
  pickWordFromCatalog,
} from '../shared/guessit/catalog.js';
import { validateCrosswordLayout } from '../shared/guessit/crossword.js';
import { validateCustomPhrase } from '../shared/guessit/normalize.js';
import { createEnscribeApp } from '../server/app.js';
import { generateWordChain, getSyncOneWordClue } from '../server/games/chain-clash/clueProvider.js';
import {
  pickCuratedChainsForPlayers,
  validateChainWords,
  validateSingleChainWord,
} from '../server/games/chain-clash/puzzleAssignment.js';

async function main() {
  console.log('1. Verifying ChainIt graph scale, synonyms, and 50,000+ combinations...');
  const hubs = Object.keys(CHAIN_GRAPH).filter((k) => CHAIN_GRAPH[k].length > 0);
  const edgeCount = Object.values(CHAIN_GRAPH).reduce((sum, arr) => sum + arr.length, 0);
  assert.ok(hubs.length >= 200, `Expected >= 200 hubs, got ${hubs.length}`);
  assert.ok(edgeCount >= 1000, `Expected >= 1000 directed edges, got ${edgeCount}`);

  const allNodes = new Set([...hubs, ...Object.values(CHAIN_GRAPH).flat()]);
  for (const w of allNodes) {
    const check = validateSingleChainWord(w);
    assert.equal(check.valid, true, `Invalid ChainIt node word: ${w} (${check.error})`);
    const syn = CHAIN_SYNONYMS[w];
    assert.ok(syn, `Missing synonym in CHAIN_SYNONYMS for ${w}`);
    assert.match(syn, /^[A-Z]{2,14}$/, `Invalid synonym format for ${w}: ${syn}`);
    assert.notEqual(syn, w, `Synonym equals word for ${w}`);
    assert.equal(syn.includes(w) || w.includes(syn), false, `Synonym overlaps word: ${w} <-> ${syn}`);
  }

  for (const [theme, seeds] of Object.entries(THEME_SEEDS)) {
    for (const seed of seeds) {
      assert.ok(
        Array.isArray(CHAIN_GRAPH[seed]) && CHAIN_GRAPH[seed].length > 0,
        `THEME_SEEDS[${theme}] contains non-hub word: ${seed}`
      );
    }
  }

  // Exact DP count of 5-word walks across CHAIN_GRAPH
  let dp = new Map<string, number>(hubs.map((h) => [h, 1]));
  for (let step = 1; step < 5; step++) {
    const next = new Map<string, number>();
    for (const [w, cnt] of dp) {
      for (const nb of CHAIN_GRAPH[w] || []) {
        next.set(nb, (next.get(nb) ?? 0) + cnt);
      }
    }
    dp = next;
  }
  let total5Walks = 0;
  for (const cnt of dp.values()) total5Walks += cnt;
  console.log(`   ChainIt graph: ${hubs.length} hubs, ${edgeCount} edges, ${total5Walks.toLocaleString()} 5-word walks.`);
  assert.ok(total5Walks > 50000, `Expected >50,000 5-word walks, got ${total5Walks}`);

  // 60 consecutive Fantasy chains -> 60 unique
  const fantasySeen = new Set<string>();
  const fantasyWords = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const res = await generateWordChain('Fantasy', 5);
    assert.equal(res.words.length, 5);
    assert.equal(validateChainWords(res.words).valid, true);
    const sig = res.words.join('>');
    assert.equal(fantasySeen.has(sig), false, `Duplicate Fantasy chain on iter ${i}: ${sig}`);
    fantasySeen.add(sig);
    res.words.forEach((w) => fantasyWords.add(w));
  }
  assert.ok(fantasyWords.size >= 80, `Expected broad Fantasy vocabulary, got ${fantasyWords.size} distinct words`);

  // 100 consecutive Adventure chains -> 100 unique
  const advSeen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const res = await generateWordChain('Adventure', 5);
    assert.equal(res.words.length, 5);
    assert.equal(validateChainWords(res.words).valid, true);
    const sig = res.words.join('>');
    assert.equal(advSeen.has(sig), false, `Duplicate Adventure chain on iter ${i}: ${sig}`);
    advSeen.add(sig);
  }

  console.log('2. Verifying ChainIt curated/multiplayer assignment variety...');
  const runtime = createEnscribeApp(
    {},
    { forceLocalGuestMemory: true, disableCloudSync: true, inMemoryOnly: true }
  );
  await runtime.prewarm();
  const officialTemplates = runtime.repo.listTemplates().filter((t) => t.status === 'official');
  assert.ok(officialTemplates.length >= 65, `Expected >= 65 official templates, got ${officialTemplates.length}`);

  // Verify every official template word has a sync clue
  for (const tpl of officialTemplates) {
    assert.equal(validateChainWords(tpl.words).valid, true, `Invalid official template ${tpl.id}`);
    for (const w of tpl.words) {
      assert.ok(getSyncOneWordClue(w), `Missing sync clue for official template word ${w} in ${tpl.id}`);
    }
  }

  const assignedSigs = new Set<string>();
  let prevRoundPair = '';
  for (let i = 0; i < 40; i++) {
    const [a1, a2] = pickCuratedChainsForPlayers(['p1', 'p2'], officialTemplates, 5, false);
    const s1 = a1.words.join('>');
    const s2 = a2.words.join('>');
    assert.notEqual(s1, s2, `Players received identical chain in non-shared mode on iter ${i}`);
    const pair = `${s1}|${s2}`;
    assert.notEqual(pair, prevRoundPair, `Consecutive duplicate round pair on iter ${i}`);
    prevRoundPair = pair;
    assignedSigs.add(s1);
    assignedSigs.add(s2);
  }
  console.log(`   40 multiplayer rounds (80 chains): ${assignedSigs.size}/80 unique chains.`);
  assert.ok(assignedSigs.size >= 75, `Expected >= 75 unique chains out of 80, got ${assignedSigs.size}`);

  console.log('3. Verifying GuessIt 620+ catalog & category/crossword validity...');
  assert.ok(GUESSIT_WORD_CATALOG.length >= 600, `Expected >= 600 GuessIt entries, got ${GUESSIT_WORD_CATALOG.length}`);
  const uniqueCatalogAnswers = new Set<string>();
  for (const entry of GUESSIT_WORD_CATALOG) {
    const check = validateCustomPhrase(entry.answer);
    assert.equal(check.valid, true, `Invalid GuessIt entry ${entry.id} (${entry.answer}): ${check.error}`);
    assert.equal(
      uniqueCatalogAnswers.has(entry.answer),
      false,
      `Duplicate GuessIt catalog answer: ${entry.answer}`
    );
    uniqueCatalogAnswers.add(entry.answer);
  }

  for (const cat of GUESSIT_CATEGORIES) {
    const entries = GUESSIT_WORD_CATALOG.filter((w) => w.category === cat);
    const cwEligible = entries.filter((w) => w.answer.length <= 13);
    assert.ok(entries.length >= 70, `Category ${cat} has only ${entries.length} entries (< 70)`);
    assert.ok(cwEligible.length >= 40, `Category ${cat} has only ${cwEligible.length} crossword-eligible entries (< 40)`);

    // 50 consecutive draws with exclusion -> 50 unique words
    const excl = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const picked = pickWordFromCatalog([], {
        category: cat,
        excludeAnswers: excl,
        seed: i * 977 + 13,
      });
      assert.equal(excl.has(picked.answer), false, `Repeated word in ${cat}: ${picked.answer}`);
      excl.add(picked.answer);
    }

    // 20 consecutive crosswords -> all valid, zero consecutive duplicates
    let prevSig = '';
    const layoutSigs = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const cw = pickCrosswordForCategory([], {
        category: cat,
        seed: 1000 + i * 7919,
      });
      assert.ok(validateCrosswordLayout(cw.layout), `Invalid crossword in ${cat} on iter ${i}`);
      const sig = cw.layout.entries.map((e) => e.answer).sort().join('|');
      assert.notEqual(sig, prevSig, `Consecutive duplicate crossword in ${cat} on iter ${i}: ${sig}`);
      prevSig = sig;
      layoutSigs.add(sig);
    }
    assert.ok(layoutSigs.size >= 15, `Expected >= 15 distinct crosswords out of 20 in ${cat}, got ${layoutSigs.size}`);
  }

  console.log('4. Verifying GuessItEngine anti-repetition memory across 10 consecutive Ranked matches...');
  const p1 = runtime.repo.upsertProfile({
    id: 'variety_p1',
    username: 'VarOne',
    avatarId: 'alex',
    rankTier: 'Silver II',
    rankPoints: 1000,
    wins: 0,
    losses: 0,
    matchPointsBalance: 0,
    equippedCosmetics: {
      tileSkin: 'classic_cream',
      boardSkin: 'royal_cosmos',
      backgroundTheme: 'deep_blue',
      chatBubbleStyle: 'frost_pill',
    },
    createdAt: Date.now(),
  });
  const p2 = runtime.repo.upsertProfile({
    id: 'variety_p2',
    username: 'VarTwo',
    avatarId: 'novarex',
    rankTier: 'Silver II',
    rankPoints: 1000,
    wins: 0,
    losses: 0,
    matchPointsBalance: 0,
    equippedCosmetics: {
      tileSkin: 'classic_cream',
      boardSkin: 'royal_cosmos',
      backgroundTheme: 'deep_blue',
      chatBubbleStyle: 'frost_pill',
    },
    createdAt: Date.now(),
  });

  const rankedSeen = new Set<string>();
  for (let m = 0; m < 10; m++) {
    const q1 = await runtime.guessItEngine.joinRankedQueue(p1.id, 'speed_rush', 'classic');
    assert.equal(q1.status, 'queued');
    const q2 = await runtime.guessItEngine.joinRankedQueue(p2.id, 'speed_rush', 'classic');
    assert.equal(q2.status, 'matched');
    const ans = q2.match!.units[p1.id].answer;
    assert.equal(rankedSeen.has(ans), false, `Ranked match ${m} repeated answer: ${ans}`);
    rankedSeen.add(ans);
  }

  console.log('ALL WORD VARIETY & ANTI-REPETITION CHECKS PASSED!');
}

main().catch((err) => {
  console.error('WORD VARIETY CHECK FAILED:', err);
  process.exit(1);
});
