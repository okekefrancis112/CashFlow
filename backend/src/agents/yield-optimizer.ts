import OpenAI from "openai";
import { config } from "../config";
import { logger } from "../lib/logger";
import {
  YieldSource,
  StrategyAllocation,
  getCurrentAllocations,
} from "../services/yield-monitor";
import { getApyHistory } from "../services/database";

const openai = new OpenAI({
  apiKey: config.aiApiKey,
  baseURL: config.aiBaseUrl,
});

/** Strip markdown code fences that some models wrap around JSON */
function extractJson(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}

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
  const currentAllocations = await getCurrentAllocations();

  const prompt = `You are an AI yield optimization agent for CashFlow, a Bitcoin DeFi vault on the Stacks blockchain that allocates sBTC and USDCx across multiple DeFi protocols.

## Current Yield Sources
Each source has an id, protocol name, asset, APY, TVL (total value locked), risk level (low/medium/high), and type (lending/lp/stacking/perpetuals/base-reward).
${JSON.stringify(sources, null, 2)}

## Current Portfolio Allocations
${JSON.stringify(currentAllocations, null, 2)}

## Risk Profile: ${riskProfile}

## Allocation Rules
- Total allocation MUST equal exactly 10000 basis points (100%)
- Every source MUST receive a minimum of 500 bps (5%) to ensure diversification
- Use the exact "id" field from each source as the "sourceId" value — do NOT invent new IDs

### Risk Constraints by Profile
- Conservative: max 2000 bps (20%) in high-risk sources, prefer lending and stacking types, minimize LP exposure due to impermanent loss
- Balanced: max 4000 bps (40%) in high-risk sources, diversify evenly across protocol types
- Aggressive: up to 6000 bps (60%) in high-risk sources, maximize APY while keeping minimum diversification

## Decision Factors (in priority order)
1. **Risk level**: Match allocations to the risk profile constraints above
2. **APY**: Higher APY sources should generally receive more allocation within risk limits
3. **TVL**: Higher TVL indicates deeper liquidity and lower slippage risk — prefer higher TVL sources when APYs are similar
4. **Protocol type**: LP positions carry impermanent loss risk that pure lending/stacking do not — account for this in expected returns
5. **Diversification**: Spread across different protocol types (lending, lp, stacking) to reduce correlated risk

## Response Format
Return ONLY a valid JSON object with NO markdown formatting, code fences, or extra text.

{
  "allocations": [
    {
      "sourceId": "exact id from the source data",
      "protocol": "protocol name",
      "asset": "asset name",
      "recommendedBps": 2500,
      "expectedApy": 8.1
    }
  ],
  "weightedApy": 9.2,
  "riskScore": 5,
  "reasoning": "2-3 sentence explanation of the strategy and key tradeoffs"
}

- weightedApy = sum(recommendedBps × expectedApy for each source) / 10000, rounded to 2 decimal places
- riskScore: integer 1-10 where 1 = extremely conservative (mostly stacking/lending), 5 = balanced diversification, 10 = maximum risk concentration
- expectedApy: use the current APY from the source data, adjusted slightly if you expect mean reversion for outlier rates
- reasoning: explain WHY you chose this allocation — mention specific protocols and the tradeoffs considered`;

  try {
    const response = await openai.chat.completions.create({
      model: config.aiModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    const parsed = JSON.parse(extractJson(content)) as Omit<OptimizationResult, "timestamp">;

    return {
      ...parsed,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error({ err: error?.message ?? error }, "AI analyzeYields failed, using fallback");
    return getDefaultAllocation(sources, riskProfile);
  }
}

function getSourceApy(sources: YieldSource[], id: string): number {
  const src = sources.find((s) => s.id === id);
  if (!src) return 0;
  // Use real APY; if source has no available data, return 0 rather than a stale guess
  return src.apyAvailable === false ? 0 : src.apy;
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
      expectedApy: getSourceApy(sources, "zest-sbtc-lending"),
    },
    {
      sourceId: "bitflow-sbtc-stx-lp",
      protocol: "Bitflow",
      asset: "sBTC/STX",
      recommendedBps: isConservative ? 1000 : isAggressive ? 3000 : 2000,
      expectedApy: getSourceApy(sources, "bitflow-sbtc-stx-lp"),
    },
    {
      sourceId: "stackingdao-liquid",
      protocol: "StackingDAO",
      asset: "stSTX",
      recommendedBps: isConservative ? 3500 : isAggressive ? 1500 : 2500,
      expectedApy: getSourceApy(sources, "stackingdao-liquid"),
    },
    {
      sourceId: "hermetica-hbtc",
      protocol: "Hermetica",
      asset: "USDh",
      recommendedBps: isConservative ? 500 : isAggressive ? 2500 : 1500,
      expectedApy: getSourceApy(sources, "hermetica-hbtc"),
    },
    {
      sourceId: "sbtc-base-rewards",
      protocol: "Stacks Network",
      asset: "STX",
      recommendedBps: isConservative ? 2000 : isAggressive ? 1500 : 1500,
      expectedApy: getSourceApy(sources, "sbtc-base-rewards"),
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
      model: config.aiModel,
      messages: [
        {
          role: "user",
          content: `You are a DeFi yield analyst for CashFlow, a Bitcoin yield aggregator on the Stacks blockchain.

## Current Yield Sources
Each source includes protocol, asset, current APY, TVL, risk level, and type:
${JSON.stringify(sources, null, 2)}

## Task
Generate a 7-day weighted portfolio yield forecast based on the sources above.

## Forecasting Guidelines
- Day 1 should be close to the current weighted average APY across all sources
- Apply realistic daily drift: yields typically move ±0.1-0.3% per day, not ±2-5%
- Factor in mean reversion: abnormally high APYs (>12%) tend to compress over time as capital flows in
- Factor in TVL trends: higher TVL protocols have more stable yields
- LP yields (Bitflow) are more volatile than lending yields (Zest) or stacking yields (StackingDAO)
- Confidence should decrease over time: day 1 ≈ 0.90-0.95, day 7 ≈ 0.60-0.70

## Response Format
Return ONLY a valid JSON object with NO markdown formatting, code fences, or extra text.

{
  "forecast": [
    { "day": 1, "projectedApy": 9.2, "confidence": 0.93 },
    { "day": 2, "projectedApy": 9.1, "confidence": 0.89 }
  ],
  "summary": "2-3 sentence market outlook explaining the forecast trend and key risk factors"
}

- projectedApy: weighted average portfolio APY projected for that day, rounded to 2 decimal places
- confidence: probability that actual APY falls within ±1% of projection, value between 0.0 and 1.0
- summary: mention which protocols drive the forecast and what could cause deviation`,
        },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });

    return JSON.parse(extractJson(response.choices[0]?.message?.content || "{}"));
  } catch {
    // Deterministic fallback: derive forecast from real APY history + mean reversion
    const apySnaps = getApyHistory(7);
    const weightedSnaps = apySnaps.filter((s) => s.protocol === "CashFlow Weighted");

    // Compute current weighted APY from live sources (only those with available data)
    const available = sources.filter((s) => s.apyAvailable !== false && s.apy > 0);
    const currentApy = available.length > 0
      ? available.reduce((s, src) => s + src.apy, 0) / available.length
      : 0;

    // Calculate recent trend from historical snapshots
    let dailyDrift = 0;
    if (weightedSnaps.length >= 2) {
      const recent = weightedSnaps.slice(-10);
      const oldest = recent[0].apy;
      const newest = recent[recent.length - 1].apy;
      dailyDrift = (newest - oldest) / recent.length;
      // Clamp drift to realistic range (±0.3% per day)
      dailyDrift = Math.max(-0.3, Math.min(0.3, dailyDrift));
    }

    // Apply mean reversion: drift toward historical average over 7 days
    const histAvg = weightedSnaps.length > 0
      ? weightedSnaps.reduce((s, snap) => s + snap.apy, 0) / weightedSnaps.length
      : currentApy;
    const meanReversionRate = 0.1; // 10% pull toward mean per day

    const forecast = Array.from({ length: 7 }, (_, i) => {
      const driftComponent = currentApy + dailyDrift * (i + 1);
      const projected = driftComponent + (histAvg - driftComponent) * meanReversionRate * (i + 1);
      return {
        day: i + 1,
        projectedApy: Math.round(Math.max(0, projected) * 100) / 100,
        confidence: Math.round((0.92 - i * 0.04) * 100) / 100,
      };
    });

    // Build a descriptive summary from actual data
    const topSource = available.reduce((best, s) => (s.apy > best.apy ? s : best), available[0] || sources[0]);
    const trendWord = dailyDrift > 0.05 ? "upward" : dailyDrift < -0.05 ? "downward" : "stable";

    return {
      forecast,
      summary: `Current weighted APY is ${currentApy.toFixed(1)}% with a ${trendWord} trend. ${topSource.protocol} (${topSource.asset}) leads at ${topSource.apy.toFixed(1)}% APY. Forecast projects gradual mean reversion toward ${histAvg.toFixed(1)}% over the next 7 days.`,
    };
  }
}
