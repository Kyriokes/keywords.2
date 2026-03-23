# Plan: Implement Retry Logic for Invalid AI Responses and Track Incorrect Stats

## Objective

When the AI returns a `jobTitle` (or `puesto` in the JSON) that is not in the `candidatePositions` list provided by the user, or if it explicitly returns the string "otros", this response should be considered **incorrect**. The system should automatically discard this response, log it as "incorrect" for that specific AI provider, and retry the request using a different provider.

## Clarification on "Otros"

Based on user feedback:

* The prompt explicitly instructs the AI to use "otros" if no position matches.

* Therefore, receiving "otros" is a **valid** response from the AI's perspective (it followed instructions), but it represents a failure to classify the job into a desired category.

* **HOWEVER**, the user states: "si la ia... no responde con un jobTitle de la lista proveida u 'otros'... esto no se esta validando actualmente".

* **Crucial Distinction**:

  * If AI returns a random string (e.g., "Software Engineer" when the list only had "Frontend" and "Backend"), this is an **INCORRECT** response (Hallucination/Disobedience).

  * If AI returns "otros", it followed instructions but failed to match. The user wants to treat this as a failure case that triggers a retry with another provider, to see if another model can find a match.

  * **Correction**: The user says "si la ia... no responde con un jobTitle de la lista proveida u 'otros'...". This implies that "otros" IS valid. BUT then says "cuando esto pasa \[inserta nuevo JobTitle], hay que anotarlo como respuesta incorrecta".

  * **INTERPRETATION**:

    * **Valid**: Any string in `candidatePositions` OR "otros".

    * **Invalid (Incorrect)**: Any string NOT in `candidatePositions` AND NOT "otros".

    * **Action**: Only **Invalid** responses should be logged as `incorrect` and retried.

    * **Wait**, the user also said: "se le informa al usuario con una alerta 'hubo un error, deseas volver a intentarlo'". This implies a manual step after automatic retries fail?

    * **Re-reading User Input**: "si la ia... no responde con un jobTitle de la lista proveida u 'otros'... esto no se esta validando actualmente, y permite escenarios donde el LLM nos inserta un nuevo JobTitle en la base de datos, comportamiento no deseado, cuando esto pasa, hay que anotarlo como respuesta incorrecta".

    * **Conclusion**:

      * We must validate that `response.puesto` is included in `[...candidatePositions, "otros"]`.

      * If it is NOT in that list, it is an **Incorrect Response**.

      * **Action**: Log as `incorrect`, penalize provider, retry with another provider automatically.

      * If all retries fail (or valid response is never found), THEN show the error to the user.

## Proposed Changes

### 1. Database Schema Update (`prisma/schema.prisma`)

* Add a new column `incorrect` to the `ProviderStats` model to track how many times a provider gave an invalid response (hallucinated a job title).

  ```prisma
  model ProviderStats {
    // ... existing fields
    incorrect Int @default(0)
  }
  ```

### 2. Provider Manager Updates (`src/lib/ia/providerManager.ts`)

* Update `ProviderState` interface to include `totalIncorrect`.

* Update `ensureInitialized` to load `incorrect` stats.

* Update `persistUserStats` to handle `'incorrect'` type.

* Implement `reportIncorrect(id)` to penalize the provider (Score penalty: -15, heavier than reject, lighter than error).

### 3. AI Controller Retry Logic (`src/lib/ia/controller.ts`)

* Modify `processJobApplication` to include a retry loop (e.g., `MAX_RETRIES = 3`).

* **Validation Logic**:

  * After parsing JSON, check `puesto`.

  * **Condition**: `isValid = candidatePositions.includes(puesto) || puesto === "otros"`.

  * **If !isValid**:

    * Log `incorrect` stat for current provider.

    * Add provider to `excludeProviders`.

    * Retry (continue loop).

  * **If isValid**:

    * Proceed to return the response.

### 4. Local Store Updates (`src/store/statsStore.ts`)

* Add `incorrect` to `ProviderStats` interface and `logIncorrect` action.

### 5. Admin UI Updates (`src/app/admin/page.tsx`)

* Display "Incorrectas" column in the stats table.

## Implementation Steps

1. Modify `schema.prisma`.
2. Update `providerManager.ts` (interfaces, loading, actions).
3. Update `controller.ts` (retry loop + strict validation).
4. Update `statsStore.ts`.
5. Update `admin/page.tsx`.
6. Ask user to run migration.

