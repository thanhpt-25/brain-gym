export interface TextChunk {
    content: string;
    chunkIndex: number;
    pageNumber?: number;
    sectionTitle?: string;
    tokenCount: number;
}

const CHUNK_SIZE = 800;   // target tokens per chunk
const CHUNK_OVERLAP = 100; // overlap tokens between chunks
const AVG_CHARS_PER_TOKEN = 4;

export function chunkText(text: string, pageHints?: Map<number, number>): TextChunk[] {
    // Split by double newlines (paragraphs) first to preserve semantic boundaries
    const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 20);
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
        const paragraphTokens = Math.ceil(paragraph.length / AVG_CHARS_PER_TOKEN);
        const currentTokens = Math.ceil(currentChunk.length / AVG_CHARS_PER_TOKEN);

        if (currentTokens + paragraphTokens > CHUNK_SIZE && currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.trim(),
                chunkIndex,
                tokenCount: currentTokens,
            });
            chunkIndex++;
            // Overlap: keep last CHUNK_OVERLAP tokens of previous chunk
            const overlapChars = CHUNK_OVERLAP * AVG_CHARS_PER_TOKEN;
            currentChunk = currentChunk.slice(-overlapChars) + '\n\n' + paragraph;
        } else {
            currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push({
            content: currentChunk.trim(),
            chunkIndex,
            tokenCount: Math.ceil(currentChunk.length / AVG_CHARS_PER_TOKEN),
        });
    }

    return chunks;
}
