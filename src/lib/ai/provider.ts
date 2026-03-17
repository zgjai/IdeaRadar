import axios from 'axios';
import { db } from '../db';
import { aiCostLogs } from '../db/schema';
import type { AIProviderConfig, TokenUsage } from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Simple token estimation (rough approximation)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Cost estimation per 1M tokens (approximate)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4.6': { input: 3.0, output: 15.0 },
  'anthropic/claude-haiku-4.5': { input: 0.8, output: 4.0 },
  'anthropic/claude-opus-4.6': { input: 15.0, output: 75.0 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'google/gemini-2.0-flash': { input: 0.075, output: 0.3 },
  default: { input: 1.0, output: 5.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS.default;
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

export class AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async callLLM(
    messages: ChatMessage[],
    ideaId?: string,
    analysisType?: string
  ): Promise<{ content: string; usage: TokenUsage }> {
    const baseUrl = this.config.baseUrl || 'https://ai-gateway.happycapy.ai/api/v1';
    // If baseUrl already ends with /chat/completions, use it directly;
    // otherwise append the path. This handles users who set the full endpoint URL.
    const endpoint = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const requestBody = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature ?? 0.3,
      max_tokens: this.config.maxTokens ?? 4096,
    };

    try {
      const response = await axios.post<OpenAICompatibleResponse>(endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        timeout: 60000,
      });

      const content = response.data.choices[0]?.message?.content || '';

      // Get actual usage or estimate
      let usage: TokenUsage;
      if (response.data.usage) {
        usage = {
          inputTokens: response.data.usage.prompt_tokens,
          outputTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        };
      } else {
        // Estimate if not provided
        const inputText = messages.map((m) => m.content).join(' ');
        usage = {
          inputTokens: estimateTokens(inputText),
          outputTokens: estimateTokens(content),
          totalTokens: estimateTokens(inputText + content),
        };
      }

      // Log cost to database
      const cost = calculateCost(this.config.model, usage.inputTokens, usage.outputTokens);
      await db.insert(aiCostLogs).values({
        model: this.config.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: cost,
        ideaId,
        analysisType,
        createdAt: new Date().toISOString(),
      });

      return { content, usage };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`AI API Error: ${message}`);
      }
      throw error;
    }
  }

  async callWithRetry(
    messages: ChatMessage[],
    ideaId?: string,
    analysisType?: string,
    maxRetries = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.callLLM(messages, ideaId, analysisType);
        return result.content;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('AI call failed after retries');
  }
}

// Factory function to create provider from config
export async function createAIProvider(type: 'screening' | 'analysis'): Promise<AIProvider> {
  const config = await getAIConfig(type);
  return new AIProvider(config);
}

// Get AI config from database settings or environment
async function getAIConfig(type: 'screening' | 'analysis'): Promise<AIProviderConfig> {
  const prefix = `ai.${type}`;
  const envApiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const envBaseUrl = process.env.AI_GATEWAY_URL || 'https://ai-gateway.happycapy.ai/api/v1';

  const defaults: AIProviderConfig = type === 'screening'
    ? {
        provider: 'openrouter',
        model: process.env.AI_SCREENING_MODEL || 'anthropic/claude-haiku-4.5',
        apiKey: envApiKey,
        baseUrl: envBaseUrl,
        temperature: 0.3,
        maxTokens: 2048,
      }
    : {
        provider: 'openrouter',
        model: process.env.AI_ANALYSIS_MODEL || 'anthropic/claude-sonnet-4.6',
        apiKey: envApiKey,
        baseUrl: envBaseUrl,
        temperature: 0.3,
        maxTokens: 4096,
      };

  try {
    // Try to get from database
    const settingsRows = await db.query.settings.findMany({
      where: (settings, { like }) => like(settings.key, `${prefix}.%`),
    });

    if (settingsRows.length > 0) {
      const dbConfig: Record<string, string> = {};
      settingsRows.forEach((row) => {
        const key = row.key.replace(`${prefix}.`, '');
        dbConfig[key] = row.value;
      });

      // Merge DB settings with defaults -- DB values take priority, but
      // fall back to env vars for missing/empty fields (especially apiKey)
      return {
        provider: (dbConfig.provider || defaults.provider) as AIProviderConfig['provider'],
        model: dbConfig.model || defaults.model,
        apiKey: dbConfig.apiKey || defaults.apiKey,
        baseUrl: dbConfig.baseUrl || defaults.baseUrl,
        temperature: dbConfig.temperature ? parseFloat(dbConfig.temperature) : defaults.temperature,
        maxTokens: dbConfig.maxTokens ? parseInt(dbConfig.maxTokens) : defaults.maxTokens,
      };
    }
  } catch (error) {
    console.warn('Failed to load AI config from database:', error);
  }

  return defaults;
}
