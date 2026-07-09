import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Users,
  Truck,
  Wrench,
  ShieldCheck,
  MapPin,
  PenTool,
  TrendingUp,
  CircleDollarSign,
  Zap,
  CheckCircle2,
  Lock,
  ArrowRight,
  Menu,
  X,
  Plus
} from "lucide-react";

export const Route = createFileRoute("/")({
  // Se o usuário já estiver logado, redireciona direto para o painel interno
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  head: () => ({
    meta: [
      { title: "Frete Fácil PRO — Gestão de Fretes, Entregas e Vendas Offline" },
      { name: "description", content: "A solução completa e robusta para gerenciamento de fretes, frotas, pneus e vendas com total suporte offline. Apenas R$ 149,90/mês." }
    ]
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const contactWhatsapp = "https://wa.me/5563984446555?text=Olá!%20Gostaria%20de%20assinar%20o%20plano%20PRO%20do%20Frete%20Fácil%20PRO.";

  return (
    <div className="min-h-screen bg-[#0b1530] text-slate-100 font-sans selection:bg-[#F57C00]/30 selection:text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0b1530]/90 backdrop-blur-md border-b border-white/5 px-4 lg:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo variant="horizontal" size="md" />

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#funcionalidades" className="hover:text-[#F57C00] transition-colors">Funcionalidades</a>
            <a href="#offline" className="hover:text-[#F57C00] transition-colors">Tecnologia Offline</a>
            <a href="#precos" className="hover:text-[#F57C00] transition-colors">Preço</a>
            <a href="#contato" className="hover:text-[#F57C00] transition-colors">Suporte</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/auth" })}
              className="text-slate-300 hover:text-white hover:bg-white/5 rounded-xl px-4 text-xs font-semibold"
            >
              Acessar Sistema
            </Button>
            <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer">
              <Button
                variant="action"
                size="sm"
                className="bg-[#F57C00] hover:bg-[#E65100] text-white shadow-lg shadow-orange-500/10 text-xs font-semibold rounded-xl"
              >
                Assinar Plano PRO
              </Button>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#0b1530] pt-20 px-6 flex flex-col gap-6 text-lg font-medium text-slate-300">
          <a href="#funcionalidades" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#F57C00]">Funcionalidades</a>
          <a href="#offline" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#F57C00]">Tecnologia Offline</a>
          <a href="#precos" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#F57C00]">Preço</a>
          <a href="#contato" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#F57C00]">Suporte</a>
          <hr className="border-white/5 my-2" />
          <Button
            variant="outline"
            onClick={() => { setMobileMenuOpen(false); navigate({ to: "/auth" }); }}
            className="w-full text-white border-white/10 hover:bg-white/5 rounded-xl py-3"
          >
            Acessar Sistema
          </Button>
          <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button
              variant="action"
              className="w-full bg-[#F57C00] hover:bg-[#E65100] text-white rounded-xl py-3"
            >
              Assinar Plano PRO
            </Button>
          </a>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 px-4 md:px-8 max-w-6xl mx-auto">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#F57C00]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-orange-400">
            <Zap className="h-3.5 w-3.5 fill-current text-orange-400" /> Versão PRO Liberada por R$ 149,90/mês
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Gestão Inteligente de Fretes, Entregas e Vendas
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
            Funciona 100% offline para motoristas em campo. Controle de frota, pneus, despesas e faturamento integrado em uma plataforma robusta e moderna.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button
                variant="action"
                size="xl"
                className="w-full sm:w-auto bg-[#F57C00] hover:bg-[#E65100] text-white font-bold text-base px-8 py-6 shadow-lg shadow-orange-500/20 rounded-2xl flex items-center justify-center gap-2 group transition-all"
              >
                Assinar Plano PRO <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <Button
              variant="outline"
              size="xl"
              onClick={() => navigate({ to: "/auth" })}
              className="w-full sm:w-auto text-white border-white/10 hover:bg-white/5 font-bold text-base px-8 py-6 rounded-2xl"
            >
              Testar e Acessar
            </Button>
          </div>

          <div className="pt-10 flex items-center justify-center gap-8 text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#F57C00]" /> Sem fidelidade</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#F57C00]" /> Implantação rápida</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#F57C00]" /> Suporte humano</div>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-20 bg-slate-900/50 border-y border-white/5 px-4 md:px-8">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight">O que o Frete Fácil PRO faz por você?</h2>
            <p className="text-slate-400">Uma única ferramenta para consolidar e descomplicar todo o faturamento e monitoramento das suas entregas rodoviárias.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#0b1530] border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-1 group">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-[#F57C00] grid place-items-center mb-4 group-hover:bg-[#F57C00] group-hover:text-white transition-all">
                <Truck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Entregas & Vendas</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Lançamento ágil de pedidos de fretes. Os motoristas recebem em tempo real as entregas pendentes direto na tela de seus celulares.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#0b1530] border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-1 group">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-[#F57C00] grid place-items-center mb-4 group-hover:bg-[#F57C00] group-hover:text-white transition-all">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Funcionamento 100% Offline</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Desenvolvido especialmente para rodovias e áreas sem sinal. O motorista faz a entrega, anexa fotos e assinaturas mesmo sem internet. Os dados sobem quando houver conexão.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#0b1530] border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-1 group">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-[#F57C00] grid place-items-center mb-4 group-hover:bg-[#F57C00] group-hover:text-white transition-all">
                <Wrench className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Gestão Completa de Pneus</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Controle de pneus instalados, rodízios, aferição de profundidade de sulco (milímetros) e histórico de descartes. Reduza custos drasticamente.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#0b1530] border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-1 group">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-[#F57C00] grid place-items-center mb-4 group-hover:bg-[#F57C00] group-hover:text-white transition-all">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Comprovação com GPS e Foto</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Tire fotos da carga entregue e do odômetro. O sistema registra automaticamente a coordenada GPS (latitude/longitude) no exato instante do descarregamento.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-[#0b1530] border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-1 group">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-[#F57C00] grid place-items-center mb-4 group-hover:bg-[#F57C00] group-hover:text-white transition-all">
                <PenTool className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Assinatura Digital no Celular</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Sem papelada. Colete a assinatura do cliente recebedor desenhando com o dedo na própria tela do dispositivo móvel do motorista.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-[#0b1530] border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-1 group">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-[#F57C00] grid place-items-center mb-4 group-hover:bg-[#F57C00] group-hover:text-white transition-all">
                <CircleDollarSign className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Financeiro & Despesas</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Acompanhe o faturamento por veículo, despesas com abastecimento e custos fixos. Calcule com precisão a rentabilidade da sua operação.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Destaque Offline */}
      <section id="offline" className="py-20 px-4 md:px-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-semibold">
            Tecnologia PWA de Ponta
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Seus motoristas nunca ficarão travados sem internet!
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Sabemos que o sinal de internet nas rodovias brasileiras e zonas rurais é instável. Por isso, o Frete Fácil PRO foi projetado com banco de dados embarcado na memória do dispositivo (`IndexedDB/Dexie`).
          </p>
          <ul className="space-y-3.5">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
              <span>O app abre e funciona mesmo sem nenhuma rede active.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
              <span>Fila de sincronização inteligente gerencia o envio em segundo plano assim que a rede móvel retornar.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
              <span>Sem perda de fotos, assinaturas ou registros de quilometragem.</span>
            </li>
          </ul>
        </div>
        
        {/* Mockup visual */}
        <div className="p-8 rounded-3xl bg-slate-900 border border-white/5 shadow-2xl relative">
          <div className="absolute top-0 right-0 p-3 bg-green-500/10 text-green-400 text-xs font-semibold rounded-tr-3xl rounded-bl-3xl border-l border-b border-white/5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span> Banco Local Ativo (Offline)
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <div className="h-3.5 w-3.5 rounded-full bg-red-400"></div>
              <div className="h-3.5 w-3.5 rounded-full bg-yellow-400"></div>
              <div className="h-3.5 w-3.5 rounded-full bg-green-400"></div>
              <span className="text-xs text-slate-500 ml-2">Simulador de Fila de Envio Offline</span>
            </div>
            
            <div className="p-3.5 rounded-xl bg-[#0b1530] border border-white/5 text-xs flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-200">Entrega #1405 - Areia Fina (15m³)</p>
                <p className="text-slate-500 mt-0.5">Aguardando conexão · Foto & GPS Salvos</p>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-md font-semibold text-[10px]">Pendente na Fila</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0b1530] border border-white/5 text-xs flex justify-between items-center opacity-60">
              <div>
                <p className="font-semibold text-slate-200">Abastecimento Veículo (AAA-1234)</p>
                <p className="text-slate-500 mt-0.5">Enviado com sucesso para a Nuvem</p>
              </div>
              <span className="px-2.5 py-1 bg-green-500/10 text-green-400 rounded-md font-semibold text-[10px]">Sincronizado</span>
            </div>
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="py-20 bg-slate-900/50 border-t border-white/5 px-4 md:px-8">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight">Um plano sob medida para sua frota</h2>
            <p className="text-slate-400">Acesso completo sem limites abusivos, taxas ocultas ou sustos no fim do mês.</p>
          </div>

          <div className="max-w-md mx-auto rounded-3xl bg-[#0b1530] border-2 border-orange-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#F57C00] text-white text-[10px] font-extrabold px-5 py-1.5 uppercase tracking-wider rotate-45 translate-x-8 translate-y-3">
              Completo
            </div>
            
            <div className="p-8 text-center border-b border-white/5">
              <h3 className="text-2xl font-extrabold text-white">Plano Único PRO</h3>
              <p className="text-sm text-slate-400 mt-1">Todas as funcionalidades inclusas</p>
              
              <div className="mt-6 flex items-baseline justify-center gap-1.5">
                <span className="text-sm font-semibold text-slate-400">R$</span>
                <span className="text-5xl font-extrabold text-white tracking-tight">149,90</span>
                <span className="text-sm font-semibold text-slate-400">/ mês</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Sem taxas de adesão · Cancele quando quiser</p>
            </div>

            <div className="p-8 space-y-6">
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0" />
                  <span>Suporte a motoristas ilimitados</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0" />
                  <span>Módulo completo de pneus e sulcos</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0" />
                  <span>Controle de combustível e odômetros</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0" />
                  <span>Sincronização offline em tempo real</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0" />
                  <span>Assinaturas na tela & fotos geolocalizadas</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0" />
                  <span>Exportação de relatórios financeiros</span>
                </li>
              </ul>

              <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="block w-full pt-4">
                <Button
                  variant="action"
                  size="lg"
                  className="w-full bg-[#F57C00] hover:bg-[#E65100] text-white font-bold text-base py-6 rounded-2xl shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2 group transition-all"
                >
                  Contratar Agora <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-4 md:px-8 max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Pronto para digitalizar seu negócio?</h2>
        <p className="text-slate-300 max-w-xl mx-auto">Elimine anotações de papel de uma vez por todas, reduza o desgaste de pneus e simplifique o acerto de contas com motoristas.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button
              variant="action"
              size="lg"
              className="w-full sm:w-auto bg-[#F57C00] hover:bg-[#E65100] text-white font-bold px-8 py-5 rounded-2xl shadow-lg shadow-orange-500/15"
            >
              Falar com Consultor
            </Button>
          </a>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate({ to: "/auth" })}
            className="w-full sm:w-auto text-white border-white/10 hover:bg-white/5 font-bold px-8 py-5 rounded-2xl"
          >
            Entrar no Painel
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="bg-[#060c1d] border-t border-white/5 px-4 md:px-8 py-12 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-white/5">
          <div className="space-y-3">
            <Logo variant="horizontal" size="sm" />
            <p className="max-w-xs leading-relaxed">Gestão inteligente e segura de fretes e entregas. Projetado para transportadoras e motoristas autônomos.</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Contato Comercial</h4>
            <p className="text-slate-400">Rodrigo Rodrigues</p>
            <p className="text-slate-400">Telefone: (63) 98444-6555</p>
            <p className="text-slate-400">E-mail: comercial@fretefacilpro.com.br</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Endereço Eletrônico</h4>
            <p className="text-slate-400">Palmas - Tocantins, Brasil</p>
            <div className="pt-2 flex items-center gap-1.5 text-slate-400">
              <Lock className="h-3.5 w-3.5 text-orange-400" /> Servidores Supabase Criptografados
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Frete Fácil PRO. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-slate-400">
            <a href="#funcionalidades" className="hover:underline">Funcionalidades</a>
            <a href="#precos" className="hover:underline">Assinatura</a>
            <a href="/auth" className="hover:underline font-semibold text-[#F57C00]">Login</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
