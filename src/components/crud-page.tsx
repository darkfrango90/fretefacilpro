import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { parseMoeda } from "@/lib/moeda";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface CrudField {
  name: string;
  label: string;
  type?: "text" | "number" | "currency" | "tel" | "select";
  required?: boolean;
  step?: string;
  options?: { value: string; label: string }[];
}

interface CrudColumn {
  header: string;
  cell: (row: any) => React.ReactNode;
  className?: string;
}

interface CrudPageProps {
  title: string;
  table: string;
  fields: CrudField[];
  empresaId: string;
  renderRow: (row: any) => React.ReactNode;
  defaults?: Record<string, any>;
  loadRows?: () => Promise<any[]>;
  saveRow?: (row: Record<string, any>, editing: any | null) => Promise<void>;
  cacheEnabled?: boolean;
  /** Colunas para a tabela exibida em telas md+ (desktop). Sem isso, a lista em cards é usada em todas as larguras. */
  columns?: CrudColumn[];
}

export function CrudPage({
  title,
  table,
  fields,
  empresaId,
  renderRow,
  defaults = {},
  loadRows,
  saveRow,
  cacheEnabled = true,
  columns,
}: CrudPageProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: [table, empresaId],
    enabled: !!empresaId,
    initialData: () => {
      if (!cacheEnabled || typeof window === "undefined" || !empresaId) return undefined;
      try {
        const raw = localStorage.getItem(`crud:${table}:cache:${empresaId}`);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    queryFn: async () => {
      try {
        let result: any[];
        if (loadRows) {
          result = await loadRows();
        } else {
          const { data, error } = await (supabase as any)
            .from(table)
            .select("*")
            .eq("empresa_id", empresaId)
            .order("criado_em", { ascending: false });
          if (error) throw error;
          result = data ?? [];
        }
        if (cacheEnabled) {
          try {
            localStorage.setItem(`crud:${table}:cache:${empresaId}`, JSON.stringify(result));
          } catch {}
        }
        return result;
      } catch (err) {
        // Se falhar (por exemplo, offline), tenta carregar do cache local
        if (cacheEnabled && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(`crud:${table}:cache:${empresaId}`);
            if (raw) return JSON.parse(raw);
          } catch {}
        }
        throw err;
      }
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      const row = { ...defaults, ...payload, empresa_id: empresaId };
      if (saveRow) {
        await saveRow(row, editing);
        return;
      }
      if (editing?.id) {
        const { error } = await (supabase as any).from(table).update(row).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(table).insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, empresaId] });
      toast.success("Salvo");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, empresaId] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = {};
    for (const f of fields) {
      const v = fd.get(f.name);
      if (v === "" || v == null) {
        payload[f.name] = null;
      } else if (f.type === "number") {
        payload[f.name] = Number(v);
      } else if (f.type === "currency") {
        payload[f.name] = parseMoeda(String(v));
      } else {
        payload[f.name] = String(v);
      }
    }
    upsert.mutate(payload);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{title}</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              {fields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label htmlFor={f.name}>{f.label}</Label>
                  {f.type === "select" ? (
                    <select
                      id={f.name}
                      name={f.name}
                      required={f.required}
                      defaultValue={editing?.[f.name] ?? ""}
                      className="flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione...</option>
                      {f.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "currency" ? (
                    <CurrencyFormField
                      id={f.name}
                      name={f.name}
                      required={f.required}
                      initialValue={editing?.[f.name] ?? ""}
                    />
                  ) : (
                    <Input
                      id={f.name}
                      name={f.name}
                      type={f.type ?? "text"}
                      step={f.step}
                      required={f.required}
                      defaultValue={editing?.[f.name] ?? ""}
                    />
                  )}
                </div>
              ))}
              <Button type="submit" className="w-full" disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className={`space-y-2${columns ? " md:hidden" : ""}`}>
        {(rows ?? []).map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">{renderRow(r)}</div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover?")) remove.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && (rows ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nada cadastrado ainda.</p>
        )}
      </div>

      {columns && (
        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c, i) => (
                  <TableHead key={i} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  {columns.map((c, i) => (
                    <TableCell key={i} className={c.className}>
                      {c.cell(r)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remover?")) remove.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (rows ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Nada cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function CurrencyFormField({
  id,
  name,
  required,
  initialValue,
}: {
  id: string;
  name: string;
  required?: boolean;
  initialValue: string | number;
}) {
  const [value, setValue] = useState(String(initialValue));
  return (
    <MoneyInput id={id} name={name} value={value} onValueChange={setValue} required={required} />
  );
}
