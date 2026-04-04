# Plan: Fix AI Provider Selection & Statistics Loading

## Problem
The user reports that the application always uses the same AI provider, ignoring the connected providers and the statistics already present in the database. The expectation is a weighted randomization where better-performing providers (higher acceptance rate) are chosen more often, but never 100% of the time.

## Analysis
1.  **Missing DB Integration**: `ProviderManager.ts` has an empty `ensureInitialized` method. It initializes all providers with a default score of 100 every time the application starts/restarts. It never reads the `ProviderStats` from the database.
2.  **Override Variable**: `factory.ts` checks for `process.env.AI_PROVIDER`. If set, it bypasses the `ProviderManager` and forces that specific provider. This could explain the "always the same" behavior if the user has this configured.
3.  **Weighted Random Logic**: The logic in `selectProvider` appears correct mathematically (weights 1x-2x), but without persistent stats, it operates on flat default scores.

## Proposed Changes

### 1. Implement Statistics Loading in `ProviderManager`
File: `src/lib/ia/providerManager.ts`

-   Update `ensureInitialized` (or create `loadGlobalStats`) to query `prisma.providerStats`.
-   Use `prisma.providerStats.groupBy` to aggregate stats by `provider` (summing `accepted`, `rejected`, `errors`).
-   Calculate the initial score for each provider using the formula:
    `score = DEFAULT_SCORE + (accepted * REWARD_ACCEPT) - (rejected * PENALTY_REJECT) - (errors * PENALTY_ERROR)`
-   Clamp the score between `MIN_SCORE` and `MAX_SCORE`.
-   Update the internal `stats` map with these calculated values.
-   Ensure this loading happens asynchronously when `ProviderManager` is instantiated (fire-and-forget pattern for the singleton).

### 2. Verify Randomization
-   The weighted random algorithm is correct. Once the scores are loaded, the weights will diverge (e.g., 1.5 vs 1.0), and the selection will reflect the stats.

### 3. Check `AI_PROVIDER` (User Action)
-   I will advise the user to check if `AI_PROVIDER` is set in their `.env`, as this overrides the randomization.

## Implementation Steps
1.  Modify `src/lib/ia/providerManager.ts` to import `prisma` (already imported) and implement the stats loading logic.
2.  Call the loading logic in `getInstance` or constructor.
