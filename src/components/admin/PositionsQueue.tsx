"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  assignTitlePhrase,
  createRole,
  getRolesQueue,
  reclassifyPendingTitles,
  type PendingTitleGroup,
  type RolesQueue,
} from "@/actions/roles-actions";
import { OTHER_ROLE } from "@/lib/positions/rules";
import type { ActionResult } from "@/lib/validation";

const NEW_ROLE = "__new__";

type Resolution = Promise<ActionResult<{ reclassified: number }>>;

export function PositionsQueue() {
  const [queue, setQueue] = useState<RolesQueue | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRolesQueue()
      .then((data) => {
        if (!cancelled) setQueue(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cada cambio reclasifica postulaciones y puede vaciar varios grupos: se vuelve a pedir la cola
  const resolve = async (action: Resolution) => {
    setBusy(true);
    try {
      const result = await action;
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const { reclassified } = result.data;
      toast.success(
        reclassified === 1 ? "1 postulación quedó clasificada" : `${reclassified} postulaciones quedaron clasificadas`
      );
      setQueue(await getRolesQueue());
    } catch {
      toast.error("No se pudo guardar el cambio.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Puestos</CardTitle>
        <CardDescription>
          {failed
            ? "No se pudo cargar la cola de puestos."
            : !queue
              ? "Cargando títulos sin clasificar…"
              : summaryText(queue)}
        </CardDescription>
      </CardHeader>

      {queue && (queue.reclassifiable > 0 || queue.pending.length > 0) && (
        <CardContent className="space-y-4">
          {queue.reclassifiable > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
              <p>
                {queue.reclassifiable === 1
                  ? "Hay 1 postulación sin rol que el diccionario ya sabe clasificar."
                  : `Hay ${queue.reclassifiable} postulaciones sin rol que el diccionario ya sabe clasificar.`}
              </p>
              <Button size="sm" disabled={busy} onClick={() => resolve(reclassifyPendingTitles())}>
                Clasificarlas
              </Button>
            </div>
          )}

          {queue.pending.length > 0 && (
            <ul className="divide-y border-y">
              {queue.pending.map((group) => (
                <PendingTitleRow
                  key={group.core}
                  group={group}
                  roles={queue.roles}
                  busy={busy}
                  onResolve={resolve}
                />
              ))}
            </ul>
          )}

          {queue.pendingGroups > queue.pending.length && (
            <p className="text-sm text-muted-foreground">
              Se muestran los {queue.pending.length} grupos con más postulaciones, de {queue.pendingGroups}.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function summaryText(queue: RolesQueue): string {
  if (queue.totalApplications === 0) return "Todavía no hay postulaciones cargadas.";

  const classified = queue.totalApplications - queue.pendingApplications;
  const share = Math.round((classified / queue.totalApplications) * 100);
  const summary = `${classified} de ${queue.totalApplications} postulaciones tienen un rol asignado (${share}%).`;

  if (queue.pendingGroups === 0) return summary;
  return `${summary} Abajo están los títulos que el diccionario no reconoce, agrupados por lo que tienen en común.`;
}

interface PendingTitleRowProps {
  group: PendingTitleGroup;
  roles: RolesQueue["roles"];
  busy: boolean;
  onResolve: (action: Resolution) => Promise<void>;
}

export function PendingTitleRow({ group, roles, busy, onResolve }: PendingTitleRowProps) {
  const [phrase, setPhrase] = useState(group.core);
  const [target, setTarget] = useState("");
  const [newRoleName, setNewRoleName] = useState("");

  const otherRole = roles.find((role) => role.name === OTHER_ROLE);
  const canAssign = target === NEW_ROLE ? newRoleName.trim().length > 0 : target.length > 0;

  const assign = () =>
    onResolve(target === NEW_ROLE ? createRole({ name: newRoleName, phrase }) : assignTitlePhrase({ phrase, roleId: target }));

  return (
    <li className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-start">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {group.count === 1 ? "1 postulación" : `${group.count} postulaciones`}
        </p>
        <ul className="text-xs text-muted-foreground">
          {group.examples.map((example) => (
            <li key={example} className="truncate" title={example}>{example}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          aria-label="Frase que identifica al rol dentro del título"
          title="Los títulos que contengan esta frase se asignan al rol elegido"
          className="h-8 w-48"
          disabled={busy}
        />
        <Select value={target} onValueChange={setTarget} disabled={busy}>
          <SelectTrigger className="h-8 w-52" aria-label="Rol al que corresponde">
            <SelectValue placeholder="Es un…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NEW_ROLE}>Rol nuevo…</SelectItem>
            {roles.filter((role) => role.name !== OTHER_ROLE).map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {target === NEW_ROLE && (
          <Input
            value={newRoleName}
            onChange={(event) => setNewRoleName(event.target.value)}
            placeholder="Nombre del rol"
            aria-label="Nombre del rol nuevo"
            className="h-8 w-48"
            disabled={busy}
          />
        )}
        <Button type="button" size="sm" disabled={busy || !canAssign || !phrase.trim()} onClick={assign}>
          Asignar
        </Button>
      </div>

      {otherRole && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="justify-self-start text-muted-foreground"
          disabled={busy || !phrase.trim()}
          title="Para títulos que no son de IT: dejan de aparecer en esta cola"
          onClick={() => onResolve(assignTitlePhrase({ phrase, roleId: otherRole.id }))}
        >
          Mandar a Otros
        </Button>
      )}
    </li>
  );
}
