/**
 * Reading text formatting helpers
 *
 * Goal: render long AI text in a consistent, readable way without assuming a strict schema.
 */

export type ReadingBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string };

// Heuristic: ALL CAPS-ish line used as a section heading
const isHeadingLine = (line: string) => {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 64) return false;
  // Allow A-Z, numbers, spaces, and common punctuation.
  const ok = /^[A-Z0-9][A-Z0-9\s\-\&\(\)\/\:\.]+$/.test(t);
  return ok;
};

export const splitIntoBlocks = (raw: string): ReadingBlock[] => {
  const text = (raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const blocks: ReadingBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    const joined = para.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) blocks.push({ kind: 'paragraph', text: joined });
    para = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flushPara();
      continue;
    }
    if (isHeadingLine(t)) {
      flushPara();
      blocks.push({ kind: 'heading', text: t });
      continue;
    }
    para.push(t);
  }
  flushPara();

  return blocks;
};






