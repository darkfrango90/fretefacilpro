import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { usePermissoes } from "@/hooks/use-permissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  maskCpfCnpj, onlyDigits, isValidCpfCnpj,
} from "@/lib/permissoes";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: Page,
});

type TipoPessoa = "fisica" | "juridica";

interface Form {
  id?: string;
  tipo_pessoa: TipoPessoa;
  nome: string;
  cpf_cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  razao_social: string;
  nome_fantasia: string;
}

const EMPTY: Form = {
  tipo_pessoa: "fisica",
  nome: "", cpf_cnpj: "", telefone: "", email: "",
  endereco: "", cidade: "", estado: "",
  razao_social: "", nome_fantasia: "",
};

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function Page() {
  const { data: prof } = useProfile();
  const { perms } = usePermissoes();
  const qc = useQueryClient();
  const empresaId = prof?.profile.empresa_id;
  const isAdmin = !!prof?.roles.includes("admin") || !!prof?.roles.includes("master");
  const podeCriar = isAdmin || perms.pode_cadastrar_cliente;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["clientes", empresaId],
    enabled: !!empresaId,
    initialData: () => {
      if (typeof window === "undefined" || !empresaId) return undefined;
      try {
        const raw = localStorage.getItem(`clientes:cache:${empresaId}`);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("clientes").select("*").order("nome");
        if (error) throw error;
        const result = data ?? [];
        try {
          localStorage.setItem(`clientes:cache:${empresaId}`, JSON.stringify(result));
        } catch {}
        return result;
      } catch (err) {
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(`clientes:cache:${empresaId}`);
            if (raw) return JSON.parse(raw);
          } catch {}
        }
        throw err;
      }
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: Form) => {
      const row: any = {
        empresa_id: empresaId,
        tipo_pessoa: f.tipo_pessoa,
        nome: f.nome.trim(),
        cpf_cnpj: f.cpf_cnpj ? onlyDigits(f.cpf_cnpj) : null,
        telefone: f.telefone || null,
        email: f.email || null,
        endereco: f.endereco || null,
        cidade: f.cidade || null,
        estado: f.estado ? f.estado.toUpperCase() : null,
        razao_social: f.tipo_pessoa === "juridica" ? (f.razao_social || null) : null,
        nome_fantasia: f.tipo_pessoa === "juridica" ? (f.nome_fantasia || null) : null,
      };
      if (f.id) {
        const { error } = await (supabase as any).from("clientes").update(row).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("clientes").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes", empresaId] });
      toast.success("Salvo");
      setOpen(false); setForm(EMPTY);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes", empresaId] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function validate(f: Form): string | null {
    if (!f.nome.trim()) return "Informe o nome";
    if (perms.telefone_obrigatorio && !f.telefone.trim()) return "Telefone é obrigatório";
    if (perms.cpf_cnpj_obrigatorio && !f.cpf_cnpj.trim()) {
      return f.tipo_pessoa === "fisica" ? "CPF é obrigatório" : "CNPJ é obrigatório";
    }
    if (f.cpf_cnpj && !isValidCpfCnpj(f.cpf_cnpj, f.tipo_pessoa)) {
      return f.tipo_pessoa === "fisica" ? "CPF inválido" : "CNPJ inválido";
    }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "E-mail inválido";
    return null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(form);
    if (err) return toast.error(err);
    upsert.mutate(form);
  }

  function openEdit(r: any) {
    setForm({
      id: r.id,
      tipo_pessoa: (r.tipo_pessoa as TipoPessoa) ?? "fisica",
      nome: r.nome ?? "",
      cpf_cnpj: r.cpf_cnpj ? maskCpfCnpj(r.cpf_cnpj, r.tipo_pessoa ?? "fisica") : "",
      telefone: r.telefone ?? "",
      email: r.email ?? "",
      endereco: r.endereco ?? "",
      cidade: r.cidade ?? "",
      estado: r.estado ?? "",
      razao_social: r.razao_social ?? "",
      nome_fantasia: r.nome_fantasia ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Clientes</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(EMPTY); }}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!podeCriar} title={!podeCriar ? "Sem permissão" : ""}>
              <Plus className="h-4 w-4 mr-1" />Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.tipo_pessoa}
                  onValueChange={(v) => setForm({ ...form, tipo_pessoa: v as TipoPessoa, cpf_cnpj: "" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">Pessoa física</SelectItem>
                    <SelectItem value="juridica">Pessoa jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nome {form.tipo_pessoa === "juridica" ? "(contato)" : ""} *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>

              {form.tipo_pessoa === "juridica" && (
                <>
                  <div>
                    <Label>Razão social</Label>
                    <Input
                      value={form.razao_social}
                      onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Nome fantasia</Label>
                    <Input
                      value={form.nome_fantasia}
                      onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div>
                <Label>
                  {form.tipo_pessoa === "fisica" ? "CPF" : "CNPJ"}
                  {perms.cpf_cnpj_obrigatorio ? " *" : ""}
                </Label>
                <Input
                  inputMode="numeric"
                  value={form.cpf_cnpj}
                  onChange={(e) => setForm({ ...form, cpf_cnpj: maskCpfCnpj(e.target.value, form.tipo_pessoa) })}
                  placeholder={form.tipo_pessoa === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Telefone{perms.telefone_obrigatorio ? " *" : ""}</Label>
                  <Input
                    type="tel"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Endereço</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </div>
                <div>
                  <Label>UF</Label>
                  <Select
                    value={form.estado}
                    onValueChange={(v) => setForm({ ...form, estado: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>


              <Button type="submit" className="w-full" disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      <div className="space-y-2">
        {(rows ?? []).map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {r.tipo_pessoa === "juridica" && r.razao_social ? r.razao_social : r.nome}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.cpf_cnpj ? maskCpfCnpj(r.cpf_cnpj, r.tipo_pessoa ?? "fisica") : ""}
                  {r.telefone ? ` · ${r.telefone}` : ""}
                  {r.endereco ? ` · ${r.endereco}` : ""}
                  {r.cidade || r.estado ? ` · ${[r.cidade, r.estado].filter(Boolean).join("/")}` : ""}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => { if (confirm("Remover?")) remove.mutate(r.id); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && (rows ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nada cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
