import type { PrismaClient } from "@prisma/client";
import { SEED_SECTOR, loadRoles } from "./roles-data";

/** Carga los roles de roles.json. Idempotente: no pisa alias que un admin haya asignado a otro rol. */
export async function seedRoles(prisma: PrismaClient, dryRun: boolean) {
    const roles = loadRoles();

    let sector = await prisma.sector.findUnique({ where: { name: SEED_SECTOR }, select: { id: true } });
    if (!sector && !dryRun) {
        sector = await prisma.sector.create({ data: { name: SEED_SECTOR }, select: { id: true } });
    }

    const existing = await prisma.canonicalPosition.findMany({
        where: { name: { in: roles.map((role) => role.name) } },
        select: { name: true },
    });
    const existingNames = new Set(existing.map((role) => role.name));
    const toCreate = roles.filter((role) => !existingNames.has(role.name));

    if (!dryRun) {
        await prisma.canonicalPosition.createMany({
            data: toCreate.map((role) => ({ name: role.name, sectorId: sector?.id })),
            skipDuplicates: true,
        });
    }

    const saved = await prisma.canonicalPosition.findMany({
        where: { name: { in: roles.map((role) => role.name) } },
        select: { id: true, name: true },
    });
    const idByName = new Map(saved.map((role) => [role.name, role.id]));

    const owners = await prisma.positionAlias.findMany({
        where: { aliasText: { in: roles.flatMap((role) => role.aliasKeys) } },
        select: { aliasText: true, canonicalPositionId: true, canonicalPosition: { select: { name: true } } },
    });
    const ownerByAlias = new Map(owners.map((owner) => [owner.aliasText, owner]));

    const newAliases: Array<{ aliasText: string; canonicalPositionId: string }> = [];
    const conflicts: string[] = [];
    for (const role of roles) {
        // En simulación los roles nuevos todavía no tienen id
        const roleId = idByName.get(role.name) ?? `(nuevo) ${role.name}`;
        for (const aliasText of role.aliasKeys) {
            const owner = ownerByAlias.get(aliasText);
            if (!owner) {
                newAliases.push({ aliasText, canonicalPositionId: roleId });
            } else if (owner.canonicalPositionId !== roleId) {
                conflicts.push(`"${aliasText}" (de ${role.name}) ya pertenece a ${owner.canonicalPosition.name}`);
            }
        }
    }

    if (!dryRun) {
        await prisma.positionAlias.createMany({ data: newAliases, skipDuplicates: true });
    }

    console.log(`Roles: ${toCreate.length} nuevos (de ${roles.length}), ${newAliases.length} alias nuevos.`);
    if (conflicts.length > 0) {
        console.log(`Conflictos de roles (${conflicts.length}), no se modificaron:\n- ${conflicts.join("\n- ")}`);
    }
}
