import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

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
