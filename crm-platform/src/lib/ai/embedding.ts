/**
 * OpenAI Embedding API を使用してテキストをベクトル化する関数
 * 
 * 使用モデル: text-embedding-3-small (1536次元)
 */

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

/**
 * テキストをベクトル化する
 * 
 * @param text - ベクトル化するテキスト
 * @param options - オプション（モデル、次元数など）
 * @returns ベクトル配列（1536次元）
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const model = options.model || DEFAULT_MODEL;
  const dimensions = options.dimensions || DEFAULT_DIMENSIONS;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        dimensions,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Invalid response from OpenAI API: missing embedding data');
    }

    const embedding = data.data[0].embedding;
    
    if (!Array.isArray(embedding) || embedding.length !== dimensions) {
      throw new Error(
        `Invalid embedding dimensions: expected ${dimensions}, got ${embedding.length}`
      );
    }

    return embedding;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to generate embedding: ${String(error)}`);
  }
}
