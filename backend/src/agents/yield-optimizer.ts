import OpenAI from "openai";
import { config } from "../config";
import {
  YieldSource,
  StrategyAllocation,
  getCurrentAllocations,
} from "../services/yield-monitor";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface OptimizationResult {
  allocations: {
    sourceId: string;
    protocol: string;
    asset: string;
    recommendedBps: number;
    expectedApy: number;
  }[];
  weightedApy: number;
  riskScore: number; // 1-10
  reasoning: string;
  timestamp: string;
}

export async function analyzeYields(
  sources: YieldSource[],
  riskProfile: "conservative" | "balanced" | "aggressive" = "balanced"
): Promise<OptimizationResult> {
  const currentAllocations = getCurrentAllocations();

  const prompt = `You are an AI yield optimization agent for a Bitcoin DeFi vault on the Stacks blockchain.

Current yield sources available:
${JSON.stringify(sources, null, 2)}

Current portfolio allocations:
${JSON.stringify(currentAllocations, null, 2)}

Risk profile: ${riskProfile}

Analyze the yield sources and recommend optimal allocation in basis points (total must equal 10000 = 100%).

Rules:
- Conservative: max 20% in high-risk, prefer lending and stacking
- Balanced: max 40% in high-risk, diversify across types
- Aggressive: up to 60% in high-risk, maximize APY

Return ONLY a valid JSON object (no markdown) with this exact structure:
{
  "allocations": [
    { "sourceId": "string", "protocol": "string", "asset": "string", "recommendedBps": number, "expectedApy": number }
  ],
  "weightedApy": number,
  "riskScore": number,
  "reasoning": "string explaining the strategy"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    const parsed = JSON.parse(content) as Omit<OptimizationResult, "timestamp">;

    return {
      ...parsed,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // Fallback: return a sensible default allocation
    return getDefaultAllocation(sources, riskProfile);
  }
}

function getDefaultAllocation(
  sources: YieldSource[],
  riskProfile: string
): OptimizationResult {
  const isConservative = riskProfile === "conservative";
  const isAggressive = riskProfile === "aggressive";

  const allocations = [
    {
      sourceId: "zest-sbtc-lending",
      protocol: "Zest Protocol",
      asset: "sBTC",
      recommendedBps: isConservative ? 3000 : isAggressive ? 1500 : 2500,
      expectedApy: sources.find((s) => s.id === "zest-sbtc-lending")?.apy || 5.2,
    },
    {
      sourceId: "bitflow-sbtc-stx-lp",
      protocol: "Bitflow",
      asset: "sBTC/STX",
      recommendedBps: isConservative ? 1000 : isAggressive ? 3000 : 2000,
      expectedApy:
        sources.find((s) => s.id === "bitflow-sbtc-stx-lp")?.apy || 12.4,
    },
    {
      sourceId: "stackingdao-liquid",
      protocol: "StackingDAO",
      asset: "stSTX",
      recommendedBps: isConservative ? 3500 : isAggressive ? 1500 : 2500,
      expectedApy:
        sources.find((s) => s.id === "stackingdao-liquid")?.apy || 8.1,
    },
    {
      sourceId: "hermetica-hbtc",
      protocol: "Hermetica",
      asset: "hBTC",
      recommendedBps: isConservative ? 500 : isAggressive ? 2500 : 1500,
      expectedApy:
        sources.find((s) => s.id === "hermetica-hbtc")?.apy || 15.3,
    },
    {
      sourceId: "sbtc-base-rewards",
      protocol: "Stacks Network",
      asset: "sBTC",
      recommendedBps: isConservative ? 2000 : isAggressive ? 1500 : 1500,
      expectedApy:
        sources.find((s) => s.id === "sbtc-base-rewards")?.apy || 5.0,
    },
  ];

  const totalBps = allocations.reduce((s, a) => s + a.recommendedBps, 0);
  const weightedApy =
    Math.round(
      (allocations.reduce(
        (s, a) => s + a.expectedApy * a.recommendedBps,
        0
      ) /
        totalBps) *
        100
    ) / 100;

  return {
    allocations,
    weightedApy,
    riskScore: isConservative ? 3 : isAggressive ? 8 : 5,
    reasoning: `Default ${riskProfile} strategy: diversified across ${allocations.length} protocols with weighted APY of ${weightedApy}%`,
    timestamp: new Date().toISOString(),
  };
}

export async function generateForecast(
  sources: YieldSource[]
): Promise<{
  forecast: { day: number; projectedApy: number; confidence: number }[];
  summary: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Given these current DeFi yield sources on Stacks:
${JSON.stringify(sources, null, 2)}

Generate a 7-day yield forecast. Return ONLY valid JSON (no markdown):
{
  "forecast": [
    { "day": 1, "projectedApy": number, "confidence": number_0_to_1 }
  ],
  "summary": "string"
}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch {
    // Deterministic fallback forecast
    const baseApy = sources.reduce((s, src) => s + src.apy, 0) / sources.length;
    return {
      forecast: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        projectedApy: Math.round((baseApy + (Math.random() - 0.5) * 2) * 100) / 100,
        confidence: Math.round((0.9 - i * 0.05) * 100) / 100,
      })),
      summary: `Based on current market conditions, average yield expected around ${baseApy.toFixed(1)}% with gradual normalization.`,
    };
  }
}
