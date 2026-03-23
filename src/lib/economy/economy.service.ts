import prisma from "@/lib/prisma";
import { ActionType, LedgerReason, TokenType, Direction } from "@prisma/client";

interface ConsumeCreditsResult {
    success: boolean;
    error?: string;
    coinsConsumed: number;
    gemsConsumed: number;
    balanceAfterCoins: number;
    balanceAfterGems: number;
}

/**
 * Consume créditos del usuario usando transacciones de Prisma y bloqueo pesimista.
 * Orden de consumo: Monedas (CoinBuckets próximos a vencer) -> Diamantes (Gems)
 * 
 * @param userId ID del usuario
 * @param amount Cantidad total de tokens a consumir
 * @param action Tipo de acción realizada
 * @param providerUsed (Opcional) Proveedor de IA utilizado
 */
export async function consumeCredits(
    userId: string,
    amount: number,
    action: ActionType,
    providerUsed?: string
): Promise<ConsumeCreditsResult> {
    
    if (amount <= 0) {
        return { success: false, error: "El monto debe ser mayor a cero", coinsConsumed: 0, gemsConsumed: 0, balanceAfterCoins: 0, balanceAfterGems: 0 };
    }

    try {
        // Ejecutamos todo dentro de una transacción interactiva de Prisma
        return await prisma.$transaction(async (tx) => {
            // 1. LECTURA Y BLOQUEO
            // Bloqueamos el Balance para evitar race conditions (Optimistic Locking via version)
            const balance = await tx.balance.findUnique({
                where: { userId }
            });

            if (!balance) {
                throw new Error("Balance no encontrado para el usuario");
            }

            // Calculamos si tiene saldo suficiente (coins + gems)
            const totalAvailable = balance.coins + balance.gems;
            if (totalAvailable < amount) {
                throw new Error("Saldo insuficiente");
            }

            // Obtenemos los buckets de monedas activos, ordenados por fecha de expiración (los más próximos a vencer primero)
            // No usamos FOR UPDATE directo porque Prisma transaccional lo maneja a nivel lógico si actualizamos después.
            const activeBuckets = await tx.coinBucket.findMany({
                where: { 
                    userId, 
                    remainingAmount: { gt: 0 },
                    expiresAt: { gt: new Date() } // Solo buckets que no han expirado
                },
                orderBy: { expiresAt: 'asc' }
            });

            // 2. CÁLCULO DE CONSUMO
            let remainingToConsume = amount;
            let totalCoinsConsumed = 0;
            let totalGemsConsumed = 0;
            
            // Array para guardar las actualizaciones de los buckets
            const bucketUpdates: { id: string, newRemaining: number, consumedHere: number }[] = [];

            // A. Consumir monedas (de los buckets)
            for (const bucket of activeBuckets) {
                if (remainingToConsume <= 0) break;

                const consumeFromBucket = Math.min(bucket.remainingAmount, remainingToConsume);
                
                bucketUpdates.push({
                    id: bucket.id,
                    newRemaining: bucket.remainingAmount - consumeFromBucket,
                    consumedHere: consumeFromBucket
                });

                totalCoinsConsumed += consumeFromBucket;
                remainingToConsume -= consumeFromBucket;
            }

            // B. Consumir diamantes (si las monedas no alcanzaron)
            if (remainingToConsume > 0) {
                totalGemsConsumed = remainingToConsume;
                // Verificación de seguridad adicional
                if (balance.gems < totalGemsConsumed) {
                     throw new Error("Inconsistencia en el saldo de diamantes");
                }
            }

            // Calculamos los nuevos balances
            const newCoinsBalance = balance.coins - totalCoinsConsumed;
            const newGemsBalance = balance.gems - totalGemsConsumed;

            // 3. ESCRITURA (Mutaciones)

            // 3.1 Actualizar el Balance usando Optimistic Locking (version)
            const updatedBalance = await tx.balance.update({
                where: { 
                    userId_version: {
                        userId: balance.userId,
                        version: balance.version
                    }
                },
                data: {
                    coins: newCoinsBalance,
                    gems: newGemsBalance,
                    version: { increment: 1 }
                }
            });

            // 3.2 Actualizar los CoinBuckets afectados
            for (const update of bucketUpdates) {
                await tx.coinBucket.update({
                    where: { id: update.id },
                    data: { remainingAmount: update.newRemaining }
                });
            }

            // 3.3 Registrar en el UsageLog
            const usageLog = await tx.usageLog.create({
                data: {
                    userId,
                    action,
                    providerUsed,
                    coinsConsumed: totalCoinsConsumed,
                    gemsConsumed: totalGemsConsumed,
                    coinsBefore: balance.coins,
                    coinsAfter: newCoinsBalance,
                    gemsBefore: balance.gems,
                    gemsAfter: newGemsBalance
                }
            });

            // 3.4 Insertar en TokenLedger (Libro Contable)
            // Registramos un movimiento por las monedas consumidas (si hubo)
            if (totalCoinsConsumed > 0) {
                // Idealmente, podríamos registrar un ledger entry por CADA bucket afectado para auditoría perfecta.
                for (const update of bucketUpdates) {
                    if (update.consumedHere > 0) {
                         // Calculamos el saldo parcial para el ledger (simplificado, el balance final del usuario será el importante)
                         // Para mantenerlo simple, registramos el balance final general.
                         await tx.tokenLedger.create({
                            data: {
                                userId,
                                tokenType: TokenType.COIN,
                                direction: Direction.DEBIT,
                                coinsDelta: update.consumedHere,
                                gemsDelta: 0,
                                reason: LedgerReason.USAGE,
                                referenceType: "usage_log",
                                referenceId: usageLog.id,
                                bucketId: update.id, // Vínculo directo al bucket consumido
                                balanceAfterCoins: newCoinsBalance, // Nota: el saldo final tras TODA la tx
                                balanceAfterGems: newGemsBalance
                            }
                        });
                    }
                }
            }

            // Registramos un movimiento por los diamantes consumidos (si hubo)
            if (totalGemsConsumed > 0) {
                await tx.tokenLedger.create({
                    data: {
                        userId,
                        tokenType: TokenType.GEM,
                        direction: Direction.DEBIT,
                        coinsDelta: 0,
                        gemsDelta: totalGemsConsumed,
                        reason: LedgerReason.USAGE,
                        referenceType: "usage_log",
                        referenceId: usageLog.id,
                        balanceAfterCoins: newCoinsBalance,
                        balanceAfterGems: newGemsBalance
                    }
                });
            }

            return {
                success: true,
                coinsConsumed: totalCoinsConsumed,
                gemsConsumed: totalGemsConsumed,
                balanceAfterCoins: newCoinsBalance,
                balanceAfterGems: newGemsBalance
            };

        }, {
            // Configuraciones de la transacción
            maxWait: 5000, // 5 segundos máximo esperando lock
            timeout: 10000 // 10 segundos máximo de ejecución
        });

    } catch (error: any) {
        console.error("Error en consumeCredits:", error);
        // Si el error es de concurrencia de Prisma (P2025), significa que el optimistic lock falló.
        if (error.code === 'P2025') {
            return { success: false, error: "Error de concurrencia. Por favor, intente nuevamente.", coinsConsumed: 0, gemsConsumed: 0, balanceAfterCoins: 0, balanceAfterGems: 0 };
        }
        return { success: false, error: error.message || "Error interno", coinsConsumed: 0, gemsConsumed: 0, balanceAfterCoins: 0, balanceAfterGems: 0 };
    }
}
