import fs from 'node:fs';
import path from 'node:path';
import {
  buildChangeItEngineData,
  bfsShortestPath,
  ChangeItVocabJson,
} from '../shared/changeit/wordGraph.js';

function main() {
  const vocabPath = path.resolve(process.cwd(), 'public', 'dictionaries', 'changeit_vocab_v1.json');
  const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8')) as ChangeItVocabJson;
  const data = buildChangeItEngineData(vocab);

  console.log('=== ChangeIt Vocabulary Counts ===');
  for (const len of [3, 4, 5, 6] as const) {
    console.log(
      `Length ${len}: puzzle=${data.puzzleByLength[len].length}, validation=${data.validationByLength[len].length}, ` +
        `puzComponents=${data.puzzleGraphs[len].componentSizes.length} (largest=${Math.max(...data.puzzleGraphs[len].componentSizes)}), ` +
        `valComponents=${data.validationGraphs[len].componentSizes.length} (largest=${Math.max(...data.validationGraphs[len].componentSizes)})`
    );
  }

  console.log('\n=== Exact Unique Solvable Puzzle Pairs (Puzzle Vocabulary, u < v) ===');
  const diffCounts = {
    beginner: 0, // len 3, 2-3
    easy: 0,     // len 4, 2-4
    normal: 0,   // len 4, 5-6
    hard: 0,     // len 4, 7-9
    expert: 0,   // len 5, 5-8
    master_5: 0, // len 5, 9+
    master_6: 0, // len 6, 9+
  };

  for (const len of [3, 4, 5, 6] as const) {
    const g = data.puzzleGraphs[len];
    const n = g.words.length;
    const distHist: Record<string, number> = {};
    let totalConnectedPairs = 0;

    for (let s = 0; s < n; s++) {
      const dist = new Int16Array(n).fill(-1);
      dist[s] = 0;
      const q = [s];
      for (let qi = 0; qi < q.length; qi++) {
        const u = q[qi];
        const d = dist[u];
        const neighbors = g.adjacency[u];
        for (let k = 0; k < neighbors.length; k++) {
          const v = neighbors[k];
          if (dist[v] === -1) {
            dist[v] = d + 1;
            q.push(v);
            if (v > s) {
              totalConnectedPairs++;
              const stepD = d + 1;
              const bucket = stepD >= 9 ? '9+' : String(stepD);
              distHist[bucket] = (distHist[bucket] ?? 0) + 1;

              if (len === 3 && stepD >= 2 && stepD <= 3) diffCounts.beginner++;
              else if (len === 4 && stepD >= 2 && stepD <= 4) diffCounts.easy++;
              else if (len === 4 && stepD >= 5 && stepD <= 6) diffCounts.normal++;
              else if (len === 4 && stepD >= 7 && stepD <= 9) diffCounts.hard++;
              else if (len === 5 && stepD >= 5 && stepD <= 8) diffCounts.expert++;
              else if (len === 5 && stepD >= 9) diffCounts.master_5++;
              else if (len === 6 && stepD >= 9) diffCounts.master_6++;
            }
          }
        }
      }
    }
    console.log(`Length ${len}: totalConnectedPairs=${totalConnectedPairs.toLocaleString()}, distHist=`, distHist);
  }

  console.log('\n=== Exact Difficulty Pool Counts (Familiar Puzzle Graph) ===');
  console.log({
    beginner: diffCounts.beginner,
    easy: diffCounts.easy,
    normal: diffCounts.normal,
    hard: diffCounts.hard,
    expert: diffCounts.expert,
    master_total: diffCounts.master_5 + diffCounts.master_6,
    master_5: diffCounts.master_5,
    master_6: diffCounts.master_6,
  });

  // Check candidate thematic Adventure pairs
  const candidates: Array<[string, string]> = [
    ['CAT','DOG'], ['SUN','DAY'], ['BOY','MAN'], ['SAD','JOY'], ['RED','TAN'], ['CUP','MUG'],
    ['COLD','WARM'], ['HEAD','TAIL'], ['WOOD','COAL'], ['ROCK','SAND'], ['SEED','TREE'], ['LEAF','BARK'],
    ['POND','LAKE'], ['WIND','GALE'], ['ROSE','LILY'], ['RAIN','SNOW'], ['BIRD','NEST'], ['FROG','TOAD'], ['BEAR','WOLF'],
    ['COLD','HEAT'], ['BURN','COOL'], ['COAL','FIRE'], ['MELT','BOIL'], ['SNOW','FIRE'],
    ['FROST','FLAME'], ['SPARK','FLAME'], ['BLAZE','CHILL'], ['STEAM','FROST'], ['EMBER','FROST'], ['TORCH','FLAME'],
    ['DARK','DAWN'], ['DARK','GLOW'], ['DUSK','DAWN'], ['MOON','STAR'], ['LAMP','GLOW'], ['FADE','GLOW'], ['DARK','GOLD'],
    ['SHADE','LIGHT'], ['GLOOM','SHINE'], ['BLACK','WHITE'], ['NIGHT','SHINE'], ['STARS','LIGHT'],
    ['WORD','BOOK'], ['HATE','LOVE'], ['LOST','FIND'], ['MIND','SOUL'], ['FEAR','HOPE'], ['WISH','HOPE'],
    ['THINK','SMART'], ['DREAM','SLEEP'], ['BRAIN','HEART'], ['SENSE','LOGIC'], ['TRUTH','FAITH'], ['PEACE','HEART'],
    ['STONE','CROWN'], ['SWORD','PEACE'], ['WATER','BLOOD'], ['EARTH','SPACE'], ['SMALL','LARGE'], ['CROWN','JEWEL'],
    ['WORLD','SPACE'], ['MAGIC','SPELL'], ['QUEST','GLORY'], ['RIVER','OCEAN'], ['WINTER','SUMMER'], ['FOREST','JUNGLE'],
    ['SILVER','GOLDEN'], ['MASTER','LEGEND'], ['GARDEN','CASTLE'], ['DRAGON','KNIGHT'], ['PLANET','GALAXY'],
    ['ICE','HOT'], ['WARM','FIRE'], ['BURN','MELT'], ['HEAT','FIRE'], ['ASH','HOT'], ['GLOW','FIRE'],
    ['CHAR','COOL'], ['LAMP','DAWN'], ['MOON','DUSK'], ['BEAM','GLOW'], ['PALE','DARK'], ['DUSK','GOLD'],
    ['STAR','GLOW'], ['SHONE','LIGHT'], ['SHINE','NIGHT'], ['BLACK','SHINE'], ['WHITE','LIGHT'],
    ['CLEAR','GHOST'], ['MIND','IDEA'], ['TRUE','FACT'], ['CALM','RAGE'], ['PAIN','HEAL'], ['WISE','FOOL'],
    ['CRAFT','BRAIN'], ['WORLD','STARS'], ['OCEAN','SHORE'], ['RIVER','CREEK'], ['SPACE','STARS'],
    ['MOUNT','CLOUD'], ['TRAIL','PEAKS'], ['STEEL','GLASS'], ['STONE','BRICK'], ['LIGHT','SPACE'],
    ['FLASH','SPARK'], ['FLAME','SMOKE'], ['EMBER','SPARK'], ['FROST','CHILL'], ['CHILL','STEAM'],
    ['BRIGHT','SHADOW'], ['WINTER','SPRING'], ['SILVER','BRIGHT'], ['CASTLE','FOREST'], ['GARDEN','MEADOW'],
    ['PLANET','COSMOS'], ['GOLDEN','SILVER'], ['MASTER','WIZARD'], ['SPIRIT','ENERGY'], ['CHANGE','FUTURE'],
  ];

  console.log('\n=== Adventure Candidate Pair Verification ===');
  for (const [a, b] of candidates) {
    if (a.length !== b.length) continue;
    const len = a.length as 3 | 4 | 5 | 6;
    if (!data.puzzleSet.has(a) || !data.puzzleSet.has(b)) continue;
    const puz = bfsShortestPath(data.puzzleGraphs[len], a, b);
    const val = bfsShortestPath(data.validationGraphs[len], a, b);
    if (!puz.solvable) continue;
    console.log(
      `${a.padEnd(6)} -> ${b.padEnd(6)} | len=${len} | puz=${puz.minMoves} | val=${val.minMoves} | exact=${puz.minMoves === val.minMoves} | ${puz.path.join('->')}`
    );
  }
}

main();
