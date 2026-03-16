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
    const endpoint = `${baseUrl}/chat/completions`;

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

  try {
    // Try to get from database
    const settingsRows = await db.query.settings.findMany({
      where: (settings, { like }) => like(settings.key, `${prefix}.%`),
    });

    if (settingsRows.length > 0) {
      const config: Partial<AIProviderConfig> = {};
      settingsRows.forEach((row) => {
        const key = row.key.replace(`${prefix}.`, '');
        config[key as keyof AIProviderConfig] = row.value as any;
      });

      if (config.provider && config.model && config.apiKey) {
        return config as AIProviderConfig;
      }
    }
  } catch (error) {
    console.warn('Failed to load AI config from database:', error);
  }

  // Fall back to environment variables
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';

  if (type === 'screening') {
    return {
      provider: 'openrouter',
      model: process.env.AI_SCREENING_MODEL || 'anthropic/claude-haiku-4.5',
      apiKey,
      baseUrl: process.env.AI_GATEWAY_URL || 'https://ai-gateway.happycapy.ai/api/v1',
      temperature: 0.3,
      maxTokens: 2048,
    };
  } else {
    return {
      provider: 'openrouter',
      model: process.env.AI_ANALYSIS_MODEL || 'anthropic/claude-sonnet-4.6',
      apiKey,
      baseUrl: process.env.AI_GATEWAY_URL || 'https://ai-gateway.happycapy.ai/api/v1',
      temperature: 0.3,
      maxTokens: 4096,
    };
  }
}
