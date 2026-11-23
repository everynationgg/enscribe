import { buildShapeTopology } from '../../../shared/gridit/shapes.js';
import { GridItCustomTemplate } from '../../../shared/gridit/editor.js';

/**
 * Optional server-side Gemini letter suggestion assist for unfilled board slots.
 * Never mandatory and never exposes API keys to clients — returns null cleanly
 * when GEMINI_API_KEY is absent or unavailable so deterministic completion takes over.
 */
export async function suggestTemplateFillerLettersWithGemini(
  template: GridItCustomTemplate
): Promise<Record<string, string> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  const topo = buildShapeTopology(template.shapeId, template.sizeId);
  const emptyIds = topo.tiles
    .map((t) => t.id)
    .filter((id) => !template.authoredTiles[id]);

  if (emptyIds.length === 0) return {};

  try {
    const prompt = [
      `You are assisting a Boggle-style English word board (${template.shapeId}, ${template.sizeId}).`,
      `Already authored tiles: ${JSON.stringify(template.authoredTiles)}.`,
      `Suggest one uppercase A-Z letter for each empty tile ID to encourage rich common English words without rare dead letters:`,
      `Empty IDs: ${emptyIds.join(', ')}.`,
      `Respond ONLY with valid JSON object mapping tile ID to single uppercase letter.`,
    ].join('\n');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(4500),
      }
    );

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as Record<string, string>;
    const clean: Record<string, string> = {};
    for (const id of emptyIds) {
      const ch = String(parsed[id] || '').trim().toUpperCase();
      if (/^[A-Z]$/.test(ch)) clean[id] = ch;
    }
    return Object.keys(clean).length > 0 ? clean : null;
  } catch {
    return null;
  }
}
