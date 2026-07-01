import React from "react";
import { CircleDot, CheckCircle2 } from "lucide-react";
import { labelPosicao } from "@/lib/pneus-constants";

interface DiagramaVeiculoProps {
  tipo: "camionete" | "toco" | "truck" | "carreta";
  pneusInstalados: Map<string, any>; // Map de posicao (string) -> dados do pneu (object)
  selectedPosicoes: string[];
  onSelectPosicao: (posicao: string) => void;
  kmAtual?: number;
}

export function DiagramaVeiculo({
  tipo = "toco",
  pneusInstalados,
  selectedPosicoes,
  onSelectPosicao,
  kmAtual = 0,
}: DiagramaVeiculoProps) {
  // Define o layout físico dos eixos do veículo
  // Cada eixo tem rodas à esquerda e rodas à direita
  const renderRoda = (posicao: string, side: "left" | "right" | "center") => {
    const p = pneusInstalados.get(posicao);
    const isSelected = selectedPosicoes.includes(posicao);
    const kmUso = p ? Math.max(0, kmAtual - Number(p.km_instalacao || 0)) : 0;

    return (
      <button
        type="button"
        onClick={() => onSelectPosicao(posicao)}
        className={`relative flex flex-col items-center justify-center border-2 rounded-xl p-2.5 min-h-[76px] transition-all duration-200 active:scale-95 shrink-0 select-none cursor-pointer
          ${
            isSelected
              ? "border-[#F57C00] bg-[#F57C00]/8 text-[#F57C00] shadow-[0_0_12px_rgba(245,124,0,0.18)]"
              : p
              ? "border-primary bg-primary/5 text-primary hover:bg-primary/8 hover:border-primary/80"
              : "border-dashed border-muted-foreground/35 bg-card text-muted-foreground hover:bg-muted/10 hover:border-muted-foreground/50"
          }
        `}
        style={{ width: "94px" }}
      >
        {/* Indicador de Selecionado */}
        {isSelected && (
          <div className="absolute -top-1.5 -right-1.5 bg-[#F57C00] text-white rounded-full p-0.5 shadow-sm">
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}

        {/* Ícone do Pneu */}
        <CircleDot className={`h-4.5 w-4.5 mb-1 ${isSelected ? "text-[#F57C00]" : p ? "text-primary" : "text-muted-foreground/50"}`} />

        {/* Detalhes do Pneu */}
        <span className="text-[9px] font-bold tracking-wider leading-none uppercase truncate w-full text-center">
          {p ? `${p.marca}` : "Vazio"}
        </span>
        {p && (
          <span className={`text-[8px] font-medium leading-none mt-1 ${isSelected ? "text-[#F57C00]" : "text-muted-foreground"} truncate w-full text-center`}>
            {p.modelo || p.tipo}
          </span>
        )}
        {p && (
          <span className="text-[7.5px] font-semibold font-mono mt-1 opacity-90 truncate w-full text-center">
            {kmUso.toLocaleString("pt-BR")} km
          </span>
        )}
      </button>
    );
  };

  // Renderiza um eixo simples (2 rodas: uma na ponta esquerda, outra na ponta direita)
  const renderEixoSimples = (posEsq: string, posDir: string, label: string) => {
    return (
      <div className="flex flex-col items-center w-full my-3">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1.5">{label}</span>
        <div className="flex items-center justify-between w-full max-w-[280px] relative px-2">
          {/* Roda Esquerda */}
          {renderRoda(posEsq, "left")}
          
          {/* Eixo Físico (Linha Metálica do Chassis) */}
          <div className="h-2 flex-1 bg-muted-foreground/20 mx-1 rounded-sm relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 bg-muted-foreground/40 rounded-full border border-card" />
          </div>
          
          {/* Roda Direita */}
          {renderRoda(posDir, "right")}
        </div>
      </div>
    );
  };

  // Renderiza um eixo duplo (4 rodas: duas na esquerda - interna/externa, duas na direita - interna/externa)
  const renderEixoDuplo = (posEsqExt: string, posEsqInt: string, posDirInt: string, posDirExt: string, label: string) => {
    return (
      <div className="flex flex-col items-center w-full my-4">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1.5">{label}</span>
        <div className="flex items-center justify-center w-full gap-1 px-1">
          {/* Rodas Esquerda (Externa e Interna) */}
          <div className="flex gap-1">
            {renderRoda(posEsqExt, "left")}
            {renderRoda(posEsqInt, "left")}
          </div>

          {/* Eixo Físico no meio */}
          <div className="h-2 w-8 bg-muted-foreground/25 relative shrink-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 bg-muted-foreground/40 rounded-full" />
          </div>

          {/* Rodas Direitas (Interna e Externa) */}
          <div className="flex gap-1">
            {renderRoda(posDirInt, "right")}
            {renderRoda(posDirExt, "right")}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full bg-card rounded-2xl border p-4 shadow-sm relative overflow-hidden">
      {/* Moldura de Chassis Estilizada de Fundo */}
      <div className="absolute inset-y-0 w-16 bg-muted/20 border-x border-muted-foreground/5 pointer-events-none rounded-sm" />

      {/* Cabine Estilizada no topo do veículo */}
      <div className="w-20 h-10 border border-muted-foreground/15 bg-muted/10 rounded-t-xl flex items-center justify-center mb-2 z-10">
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Cabine</span>
      </div>

      {/* Eixo Dianteiro (Comum a todos) */}
      {renderEixoSimples("dianteiro_esquerdo", "dianteiro_direito", "Eixo Dianteiro")}

      {/* Eixos Traseiros com base no Tipo de Veículo */}
      <div className="w-full space-y-2 z-10">
        {tipo === "camionete" && (
          /* Eixo Traseiro Simples de 4 rodas */
          renderEixoSimples("traseiro_esquerdo", "traseiro_direito", "Eixo Traseiro")
        )}

        {tipo === "toco" && (
          /* Eixo Traseiro Duplo */
          renderEixoDuplo(
            "traseiro_esquerdo_externo",
            "traseiro_esquerdo_interno",
            "traseiro_direito_interno",
            "traseiro_direito_externo",
            "Eixo Traseiro (Tração)"
          )
        )}

        {tipo === "truck" && (
          <>
            {/* Eixo Traseiro Duplo 1 */}
            {renderEixoDuplo(
              "traseiro_esquerdo_externo",
              "traseiro_esquerdo_interno",
              "traseiro_direito_interno",
              "traseiro_direito_externo",
              "Eixo 1 (Tração)"
            )}
            {/* Eixo Traseiro Duplo 2 */}
            {renderEixoDuplo(
              "traseiro_2_esquerdo_externo",
              "traseiro_2_esquerdo_interno",
              "traseiro_2_direito_interno",
              "traseiro_2_direito_externo",
              "Eixo 2 (Truck)"
            )}
          </>
        )}

        {tipo === "carreta" && (
          <>
            {/* Cavalo: Eixo Traseiro Duplo 1 */}
            {renderEixoDuplo(
              "traseiro_esquerdo_externo",
              "traseiro_esquerdo_interno",
              "traseiro_direito_interno",
              "traseiro_direito_externo",
              "Eixo 1 (Cavalo)"
            )}
            {/* Cavalo: Eixo Traseiro Duplo 2 */}
            {renderEixoDuplo(
              "traseiro_2_esquerdo_externo",
              "traseiro_2_esquerdo_interno",
              "traseiro_2_direito_interno",
              "traseiro_2_direito_externo",
              "Eixo 2 (Cavalo)"
            )}

            {/* Acoplamento da Carreta */}
            <div className="flex flex-col items-center w-full my-4 relative">
              <div className="h-8 w-2 bg-[#F57C00] rounded-sm shadow-sm" />
              <span className="text-[8px] font-bold text-[#F57C00] uppercase tracking-wider mt-1">Carreta Engatada</span>
            </div>

            {/* Carreta: Eixo 3 */}
            {renderEixoSimples("carreta_1_esquerdo", "carreta_1_direito", "Eixo 3 (Carreta)")}
            {/* Carreta: Eixo 4 */}
            {renderEixoSimples("carreta_2_esquerdo", "carreta_2_direito", "Eixo 4 (Carreta)")}
            {/* Carreta: Eixo 5 */}
            {renderEixoSimples("carreta_3_esquerdo", "carreta_3_direito", "Eixo 5 (Carreta)")}
          </>
        )}
      </div>

      {/* Eixo do Estepe (Opcional - Embaixo) */}
      <div className="flex flex-col items-center w-full mt-6 pt-4 border-t border-dashed border-muted-foreground/15 z-10">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1.5">Estepe (Reserva)</span>
        {renderRoda("estepe", "center")}
      </div>
    </div>
  );
}
