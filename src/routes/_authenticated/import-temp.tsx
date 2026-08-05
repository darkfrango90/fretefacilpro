import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import importData from "@/data/temp-import-clientes.json";

export const Route = createFileRoute("/_authenticated/import-temp")({
  component: Page,
});

interface ImportRow {
  _codigo_legado: string;
  tipo_pessoa: "fisica" | "juridica";
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
}

const ROWS = importData as ImportRow[];

function Page() {
  const { data: prof } = useProfile();
  const qc = useQueryClient();
  const empresaId = prof?.profile.empresa_id;
  const isAdmin = !!prof?.roles.includes("admin") || !!prof?.roles.includes("master");

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  async function runImport() {
    if (!empresaId) return;
    setRunning(true);
    setLog([]);
    const lines: string[] = [];

    const { data: existing, error: fetchErr } = await (supabase as any)
      .from("clientes")
      .select("nome, cpf_cnpj")
      .eq("empresa_id", empresaId);
    if (fetchErr) {
      toast.error("Erro ao checar clientes existentes: " + fetchErr.message);
      setRunning(false);
      return;
    }
    const existingKeys = new Set(
      (existing ?? []).map((r: any) => `${(r.nome ?? "").trim().toLowerCase()}|${r.cpf_cnpj ?? ""}`)
    );

    const toInsert = ROWS.filter((r) => {
      const key = `${r.nome.trim().toLowerCase()}|${r.cpf_cnpj ?? ""}`;
      return !existingKeys.has(key);
    });
    const skippedCount = ROWS.length - toInsert.length;

    if (toInsert.length === 0) {
      lines.push(`Nada a importar — os ${ROWS.length} clientes já existem no cadastro.`);
      setLog(lines);
      setRunning(false);
      setDone(true);
      return;
    }

    const rows = toInsert.map((r) => ({
      empresa_id: empresaId,
      tipo_pessoa: r.tipo_pessoa,
      nome: r.nome,
      cpf_cnpj: r.cpf_cnpj,
      telefone: r.telefone,
      email: r.email,
      endereco: r.endereco,
      cidade: r.cidade,
      estado: r.estado,
    }));

    const BATCH = 50;
    let inserted = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await (supabase as any).from("clientes").insert(batch);
      if (error) {
        failed += batch.length;
        lines.push(`Erro no lote ${i / BATCH + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
      setLog([...lines]);
    }

    lines.push(`Importados: ${inserted}`);
    if (skippedCount) lines.push(`Já existentes (ignorados): ${skippedCount}`);
    if (failed) lines.push(`Falharam: ${failed}`);
    setLog(lines);
    setRunning(false);
    setDone(true);
    qc.invalidateQueries({ queryKey: ["clientes", empresaId] });
    if (failed === 0) toast.success(`${inserted} clientes importados com sucesso`);
    else toast.error(`${failed} registros falharam — veja o log`);
  }

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground p-4">Apenas administradores podem executar a importação.</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Importação única de clientes (CSV)</h1>
      <p className="text-sm text-muted-foreground">
        Isso vai importar até {ROWS.length} clientes do arquivo clientes_frete_facil.csv para a sua empresa.
        Clientes com o mesmo nome + CPF/CNPJ já cadastrados são pulados automaticamente,
        então é seguro clicar mais de uma vez.
      </p>
      <Button onClick={runImport} disabled={running || !empresaId}>
        {running ? "Importando..." : done ? "Importar novamente" : `Importar ${ROWS.length} clientes`}
      </Button>
      {log.length > 0 && (
        <Card>
          <CardContent className="p-3 text-sm space-y-1">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
