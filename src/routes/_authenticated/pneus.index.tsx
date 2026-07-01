import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, RotateCcw, BarChart3, AlertCircle } from "lucide-react";
import { labelPosicao, labelMotivo } from "@/lib/pneus-constants";
import { DiagramaVeiculo } from "@/components/pneus/diagrama-veiculo";

export const Route = createFileRoute("/_authenticated/pneus/")({
  component: Page,
});

function Page() {
  const { data: prof } = useProfile();
  const navigate = useNavigate();
  const empresaId = prof?.profile.empresa_id;
  const isAdmin = !!prof?.roles.includes("admin");
  
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [selectedPosicoes, setSelectedPosicoes] = useState<string[]>([]);

  // Limpa seleção ao trocar de veículo
  useEffect(() => {
    setSelectedPosicoes([]);
  }, [veiculoId]);

  const cacheKey = empresaId ? `pneus-veiculos-cache:${empresaId}` : null;
  const { data: veiculos } = useQuery({
    queryKey: ["pneus-veiculos-list", empresaId],
    enabled: !!empresaId,
    networkMode: "offlineFirst",
    retry: false,
    staleTime: 60_000,
    initialData: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      try {
        const raw = localStorage.getItem(cacheKey);
        return raw ? JSON.parse(raw) : undefined;
      } catch { return undefined; }
    },
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("veiculos")
        .select("id, placa, tipo")
        .eq("ativo", true)
        .order("placa");
      
      if (error) {
        console.error("Erro ao carregar veiculos em pneus:", error);
        throw error;
      }
      
      const list = data ?? [];
      if (cacheKey) try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
      return list;
    },
  });

  const selectedVeiculo = useMemo(() => {
    return (veiculos ?? []).find((v: any) => v.id === veiculoId);
  }, [veiculos, veiculoId]);

  const { data: pneus, isLoading } = useQuery({
    queryKey: ["pneus-list", empresaId, veiculoId],
    enabled: !!empresaId && !!veiculoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pneus").select("*")
        .eq("veiculo_id", veiculoId)
        .order("data_instalacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // KM atual do veículo: maior km_atual de abastecimento
  const { data: kmAtual } = useQuery({
    queryKey: ["veiculo-km-atual", veiculoId],
    enabled: !!veiculoId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("abastecimentos").select("km_atual")
        .eq("veiculo_id", veiculoId).order("km_atual", { ascending: false }).limit(1);
      return Number(data?.[0]?.km_atual ?? 0);
    },
  });

  const instaladosPorPosicao = useMemo(() => {
    const m = new Map<string, any>();
    (pneus ?? []).filter((p: any) => p.status === "instalado").forEach((p: any) => m.set(p.posicao, p));
    return m;
  }, [pneus]);

  const removidos = useMemo(
    () => (pneus ?? []).filter((p: any) => p.status === "removido"),
    [pneus],
  );

  const handleSelectPosicao = (pos: string) => {
    setSelectedPosicoes(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const hasSelectedOccupied = useMemo(() => {
    return selectedPosicoes.some(pos => instaladosPorPosicao.has(pos));
  }, [selectedPosicoes, instaladosPorPosicao]);

  const hasSelectedEmpty = useMemo(() => {
    return selectedPosicoes.some(pos => !instaladosPorPosicao.has(pos));
  }, [selectedPosicoes, instaladosPorPosicao]);

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Controle de Pneus</h1>
        {isAdmin && (
          <Link to="/pneus/relatorio">
            <Button size="sm" variant="outline"><BarChart3 className="h-4 w-4 mr-1" />Relatório</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="p-3 space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Veículo Selecionado</label>
          <Select value={veiculoId} onValueChange={setVeiculoId}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione um veículo" /></SelectTrigger>
            <SelectContent>
              {(veiculos ?? []).map((v: any) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.placa} {v.tipo ? `• ${v.tipo.toUpperCase()}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {veiculoId && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div>
                KM atual estimado: <span className="font-semibold text-foreground">{(kmAtual ?? 0).toLocaleString("pt-BR")} km</span>
              </div>
              {selectedVeiculo?.tipo && (
                <Badge variant="secondary" className="capitalize text-[9px] font-semibold bg-primary/10 text-primary border-none">
                  {selectedVeiculo.tipo}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!veiculoId && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Selecione um veículo para visualizar e gerenciar os pneus.
        </CardContent></Card>
      )}

      {veiculoId && (
        <>
          {isLoading && <div className="text-sm text-muted-foreground text-center py-4">Carregando pneus…</div>}
          
          {/* DIAGRAMA INTERATIVO DE PNEUS */}
          {!isLoading && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground text-center bg-muted/40 py-2 rounded-xl border border-dashed">
                Clique nos pneus do diagrama para selecionar. Seleções ficam em <span className="text-[#F57C00] font-semibold">Laranja</span>.
              </div>
              
              <DiagramaVeiculo
                tipo={selectedVeiculo?.tipo || "toco"}
                pneusInstalados={instaladosPorPosicao}
                selectedPosicoes={selectedPosicoes}
                onSelectPosicao={handleSelectPosicao}
                kmAtual={kmAtual ?? 0}
              />
            </div>
          )}

          {/* PAINEL DE AÇÕES CONTEXTUAIS */}
          {selectedPosicoes.length > 0 && (
            <Card className="border-[#F57C00] bg-[#F57C00]/5 shadow-lg border-t-2 rounded-2xl">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seleção Ativa</div>
                  <div className="text-sm font-bold text-[#F57C00] mt-0.5">
                    {selectedPosicoes.length} roda(s) selecionada(s)
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-md mt-1">
                    {selectedPosicoes.map(pos => labelPosicao(pos)).join(", ")}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                  {/* Cenário 1: Apenas posições vazias (Instalar novos) */}
                  {!hasSelectedOccupied && hasSelectedEmpty && (
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: "/pneus/instalar",
                          search: { veiculo_id: veiculoId, posicao: selectedPosicoes.join(",") } as any,
                        })
                      }
                      className="bg-[#F57C00] hover:bg-[#F57C00]/90 text-white font-medium rounded-xl active-scale"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Instalar Pneu(s)
                    </Button>
                  )}

                  {/* Cenário 2: Apenas 1 ocupada (Permite trocar ou remover) */}
                  {hasSelectedOccupied && selectedPosicoes.length === 1 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const p = instaladosPorPosicao.get(selectedPosicoes[0]);
                        if (p) navigate({ to: "/pneus/remover/$id", params: { id: p.id } });
                      }}
                      className="bg-[#F57C00] hover:bg-[#F57C00]/90 text-white font-medium rounded-xl active-scale"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Trocar / Remover
                    </Button>
                  )}

                  {/* Cenário 3: Múltiplas ocupadas selecionadas (Alerta limitador) */}
                  {hasSelectedOccupied && selectedPosicoes.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs text-[#F57C00] bg-orange-100/50 p-2 rounded-xl font-medium border border-orange-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Troque um pneu por vez.</span>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPosicoes([])}
                    className="text-muted-foreground text-xs hover:bg-muted rounded-xl"
                  >
                    Limpar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* LISTA COMPLETA DE DETALHES DE PNEUS INSTALADOS */}
          {!isLoading && pneus && pneus.filter((p: any) => p.status === "instalado").length > 0 && (
            <div className="space-y-2 pt-2">
              <h2 className="text-sm font-semibold">Lista de Pneus Instalados</h2>
              <div className="grid gap-2">
                {pneus
                  .filter((p: any) => p.status === "instalado")
                  .map((p: any) => {
                    const kmUso = Math.max(0, (kmAtual ?? 0) - Number(p.km_instalacao || 0));
                    const isSelected = selectedPosicoes.includes(p.posicao);
                    return (
                      <Card
                        key={p.id}
                        onClick={() => handleSelectPosicao(p.posicao)}
                        className={`cursor-pointer transition-all duration-200 hover:bg-muted/30 rounded-xl border ${
                          isSelected ? "border-[#F57C00] bg-[#F57C00]/5" : ""
                        }`}
                      >
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-foreground uppercase">
                              {labelPosicao(p.posicao)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {p.marca} {p.modelo ? `• ${p.modelo}` : ""} • <Badge variant="secondary" className="text-[8px] py-0 px-1 bg-primary/5 text-primary border-none">{p.tipo}</Badge>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold font-mono">
                              {kmUso.toLocaleString("pt-BR")} km
                            </div>
                            <div className="text-[9px] text-muted-foreground mt-0.5">de uso</div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* HISTÓRICO DE REMOVIDOS */}
          {removidos.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold pt-2">Histórico (Removidos)</h2>
              <div className="grid gap-2">
                {removidos.map((p: any) => {
                  const duracao = Math.max(0, Number(p.km_remocao || 0) - Number(p.km_instalacao || 0));
                  return (
                    <Card key={p.id} className="rounded-xl">
                      <CardContent className="p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-foreground">{labelPosicao(p.posicao)} • {p.marca}</div>
                          <Badge variant="outline" className="text-[9px] py-0 px-1">{p.tipo}</Badge>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          Durou <b className="text-foreground">{duracao.toLocaleString("pt-BR")} km</b> • Motivo: {labelMotivo(p.motivo_remocao)}
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                          {new Date(p.data_instalacao).toLocaleDateString("pt-BR")} → {p.data_remocao ? new Date(p.data_remocao).toLocaleDateString("pt-BR") : "—"}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
