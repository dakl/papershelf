export interface TextChunk {
  chunkType: 'title_abstract' | 'body';
  chunkIndex: number;
  text: string;
  estimatedTokens: number;
}

const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 1500;
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_FRACTION = 0.1;
const OVERLAP_CHARS = Math.round(TARGET_CHUNK_CHARS * OVERLAP_FRACTION);

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function findBreakPoint(text: string, maxLength: number): number {
  const slice = text.slice(0, maxLength);

  // Paragraph break
  const paragraphBreak = slice.lastIndexOf('\n\n');
  if (paragraphBreak > maxLength * 0.5) return paragraphBreak + 2;

  // Line break
  const lineBreak = slice.lastIndexOf('\n');
  if (lineBreak > maxLength * 0.5) return lineBreak + 1;

  // Sentence break
  const sentenceBreak = slice.lastIndexOf('. ');
  if (sentenceBreak > maxLength * 0.5) return sentenceBreak + 2;

  // Hard cut
  return maxLength;
}

function splitBodyText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let offset = 0;
  let chunkIndex = 1; // body chunks start at 1 (0 is title_abstract)

  while (offset < text.length) {
    const remaining = text.length - offset;

    if (remaining <= TARGET_CHUNK_CHARS * 1.2) {
      // Last chunk — take everything remaining
      const chunkText = text.slice(offset).trim();
      if (chunkText.length > 0) {
        chunks.push({
          chunkType: 'body',
          chunkIndex,
          text: chunkText,
          estimatedTokens: estimateTokens(chunkText),
        });
      }
      break;
    }

    const breakPoint = findBreakPoint(text.slice(offset), TARGET_CHUNK_CHARS);
    const chunkText = text.slice(offset, offset + breakPoint).trim();

    if (chunkText.length > 0) {
      chunks.push({
        chunkType: 'body',
        chunkIndex,
        text: chunkText,
        estimatedTokens: estimateTokens(chunkText),
      });
      chunkIndex++;
    }

    // Advance with overlap
    offset += breakPoint - OVERLAP_CHARS;
  }

  return chunks;
}

export function chunkPaper(title: string, abstract: string, fullText: string | null): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Chunk 0: title + abstract (always present)
  const titleAbstractText = abstract ? `${title}\n\n${abstract}` : title;
  chunks.push({
    chunkType: 'title_abstract',
    chunkIndex: 0,
    text: titleAbstractText,
    estimatedTokens: estimateTokens(titleAbstractText),
  });

  // Body chunks from full text
  if (fullText && fullText.trim().length > 0) {
    const bodyChunks = splitBodyText(fullText.trim());
    chunks.push(...bodyChunks);
  }

  return chunks;
}
