import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

// ── Ollama (local LLM) ──
let _ollamaClient: OpenAI | null = null;

export function getOllamaClient(): OpenAI {
  if (!_ollamaClient) {
    _ollamaClient = new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      apiKey: 'ollama',
    });
  }
  return _ollamaClient;
}

// ── Anthropic (Claude API) ──
let _anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropicClient;
}

// ── Unified LLM call — uses Ollama in dev, Anthropic in prod ──

export async function llmChat(prompt: string, options?: {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const { system, temperature = 0.1, maxTokens = 500, jsonMode = false } = options || {};

  if (isDevMode()) {
    // Ollama
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const res = await getOllamaClient().chat.completions.create({
      model: 'llama3:latest',
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });

    return res.choices[0].message.content!.trim();
  } else {
    // Anthropic
    const res = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: system ? `${system}\n\n${prompt}` : prompt }],
      ...(temperature !== undefined ? { temperature } : {}),
    });

    return (res.content[0] as any).text.trim();
  }
}

export async function llmChatWithRetry(prompt: string, options?: {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  retries?: number;
}): Promise<string> {
  const { retries = 3, ...rest } = options || {};
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await llmChat(prompt, rest);
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.error?.type === 'rate_limit_error';
      if ((is429 || isDevMode()) && attempt < retries - 1) {
        const waitSec = isDevMode() ? 5 * (attempt + 1) : 30 * (attempt + 1);
        console.log(`    LLM error — waiting ${waitSec}s before retry ${attempt + 2}/${retries}...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
  return '';
}
