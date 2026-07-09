import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      { title: "Frete Fácil PRO — Gestão de entregas para materiais de construção" },
      { name: "description", content: "Organize entregas, motoristas e frota em um só painel. Comprovante por foto, funcionamento offline e visão em tempo real. Feito para lojas de materiais de construção." },
      { name: "theme-color", content: "#1B2A4A" }
    ]
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Monitora scroll para fixar o header com transparência
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Monitora animações de revelar ao rolar (reveal on scroll)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            // Adiciona atraso escalonado com base na posição
            (entry.target as HTMLElement).style.transitionDelay = `${(idx % 3) * 90}ms`;
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const contactWhatsapp = "https://wa.me/5563984446555?text=Olá!%20Gostaria%20de%20assinar%20o%20plano%20PRO%20do%20Frete%20Fácil%20PRO.";

  return (
    <>
      {/* Estilos originais incorporados da Landing Page do Usuário */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --navy-950: #081226;
          --navy-900: #0B1730;
          --navy-800: #122447;
          --navy-700: #1B2A4A;
          --navy-600: #27406E;
          --amber: #FFB020;
          --amber-deep: #F08C00;
          --paper: #F4F6FA;
          --white: #FFFFFF;
          --ink: #101828;
          --ink-soft: #42506B;
          --line: #E3E8F0;
          --green: #12B76A;
          --green-soft: #E4F8EE;
          --blue-soft: #E8F0FE;
          --amber-soft: #FFF3DC;
          --red-soft: #FEECEB;
          --red: #E5484D;
          --radius: 16px;
          --shadow-lg: 0 24px 60px -18px rgba(11,23,48,.35);
          --shadow-md: 0 12px 32px -12px rgba(11,23,48,.18);
          --shadow-sm: 0 4px 14px -4px rgba(11,23,48,.12);
          --font-display: 'Archivo', sans-serif;
          --font-body: 'Manrope', sans-serif;
          --font-mono: 'IBM Plex Mono', monospace;
        }

        /* Reset local para a Landing Page */
        .lp-wrapper {
          font-family: var(--font-body);
          color: var(--ink);
          background: var(--paper);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          width: 100%;
        }

        .lp-wrapper * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .lp-wrapper html {
          scroll-behavior: smooth;
        }

        .lp-wrapper img {
          max-width: 100%;
          display: block;
        }

        .lp-wrapper a {
          color: inherit;
          text-decoration: none;
        }

        .lp-wrapper ul {
          list-style: none;
        }

        .lp-wrapper .container {
          width: min(1160px, 92%);
          margin-inline: auto;
        }

        /* ============ UTILITIES ============ */
        .lp-wrapper .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: .72rem;
          font-weight: 600;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--amber-deep);
        }

        .lp-wrapper .eyebrow::before {
          content: "";
          width: 26px;
          height: 2px;
          background: var(--amber);
          border-radius: 2px;
        }

        .lp-wrapper .section {
          padding: 96px 0;
        }

        .lp-wrapper .section-head {
          max-width: 640px;
          margin-bottom: 56px;
        }

        .lp-wrapper .section-head h2 {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(1.8rem, 3.6vw, 2.6rem);
          line-height: 1.15;
          letter-spacing: -.02em;
          margin: 14px 0 14px;
        }

        .lp-wrapper .section-head p {
          color: var(--ink-soft);
          font-size: 1.05rem;
        }

        .lp-wrapper .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: .95rem;
          padding: 15px 28px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
          letter-spacing: .01em;
        }

        .lp-wrapper .btn:focus-visible {
          outline: 3px solid var(--amber);
          outline-offset: 3px;
        }

        .lp-wrapper .btn-amber {
          background: linear-gradient(180deg, var(--amber), var(--amber-deep));
          color: var(--navy-950);
          box-shadow: 0 10px 24px -8px rgba(240,140,0,.55);
        }

        .lp-wrapper .btn-amber:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px -8px rgba(240,140,0,.6);
        }

        .lp-wrapper .btn-ghost {
          background: transparent;
          color: var(--white);
          border: 1.5px solid rgba(255, 255, 255, .28);
        }

        .lp-wrapper .btn-ghost:hover {
          background: rgba(255, 255, 255, .08);
          transform: translateY(-2px);
        }

        .lp-wrapper .btn-navy {
          background: var(--navy-800);
          color: var(--white);
        }

        .lp-wrapper .btn-navy:hover {
          background: var(--navy-700);
          transform: translateY(-2px);
        }

        /* reveal on scroll */
        .lp-wrapper .reveal {
          opacity: 0;
          transform: translateY(26px);
          transition: opacity .7s ease, transform .7s ease;
        }

        .lp-wrapper .reveal.in {
          opacity: 1;
          transform: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-wrapper .reveal {
            opacity: 1;
            transform: none;
          }
        }

        /* ============ NAV ============ */
        .lp-wrapper .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          transition: background .25s ease, box-shadow .25s ease;
        }

        .lp-wrapper .nav.scrolled {
          background: rgba(8, 18, 38, .92);
          backdrop-filter: blur(12px);
          box-shadow: 0 2px 20px rgba(0, 0, 0, .3);
        }

        .lp-wrapper .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 0;
        }

        .lp-wrapper .logo {
          display: flex;
          align-items: center;
          gap: 11px;
          color: var(--white);
        }

        .lp-wrapper .logo-mark {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: linear-gradient(140deg, var(--amber), var(--amber-deep));
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .lp-wrapper .logo-mark svg {
          width: 23px;
          height: 23px;
        }

        .lp-wrapper .logo-text {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.08rem;
          letter-spacing: -.01em;
          line-height: 1.1;
        }

        .lp-wrapper .logo-text span {
          display: block;
          font-family: var(--font-mono);
          font-size: .6rem;
          font-weight: 600;
          letter-spacing: .22em;
          color: var(--amber);
        }

        .lp-wrapper .nav-links {
          display: flex;
          gap: 32px;
          align-items: center;
        }

        .lp-wrapper .nav-links a {
          color: rgba(255, 255, 255, .78);
          font-weight: 600;
          font-size: .92rem;
          transition: color .2s;
        }

        .lp-wrapper .nav-links a:hover {
          color: var(--amber);
        }

        .lp-wrapper .nav .btn {
          padding: 11px 22px;
          font-size: .86rem;
        }

        .lp-wrapper .nav-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
        }

        .lp-wrapper .nav-toggle span {
          display: block;
          width: 24px;
          height: 2.5px;
          background: var(--white);
          margin: 5px 0;
          border-radius: 2px;
          transition: .25s;
        }

        /* ============ HERO ============ */
        .lp-wrapper .hero {
          position: relative;
          overflow: hidden;
          background: radial-gradient(1000px 500px at 85% -10%, rgba(39,64,110,.55), transparent 60%),
            radial-gradient(700px 420px at -10% 110%, rgba(240,140,0,.14), transparent 55%),
            linear-gradient(165deg, var(--navy-900) 0%, var(--navy-950) 100%);
          color: var(--white);
          padding: 168px 0 120px;
        }

        .lp-wrapper .hero-grid {
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          gap: 56px;
          align-items: center;
        }

        .lp-wrapper .hero h1 {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: clamp(2.4rem, 5vw, 3.7rem);
          line-height: 1.06;
          letter-spacing: -.025em;
          margin: 20px 0 22px;
        }

        .lp-wrapper .hero h1 em {
          font-style: normal;
          color: var(--amber);
          position: relative;
          white-space: nowrap;
        }

        .lp-wrapper .hero h1 em::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 4px;
          height: 10px;
          background: rgba(255, 176, 32, .22);
          border-radius: 4px;
          z-index: -1;
        }

        .lp-wrapper .hero-sub {
          color: rgba(255, 255, 255, .75);
          font-size: 1.13rem;
          max-width: 520px;
          margin-bottom: 34px;
        }

        .lp-wrapper .hero-ctas {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }

        .lp-wrapper .hero-proof {
          display: flex;
          gap: 28px;
          flex-wrap: wrap;
        }

        .lp-wrapper .proof-item {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, .7);
          font-size: .88rem;
          font-weight: 600;
        }

        .lp-wrapper .proof-item svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        /* route line decorativa */
        .lp-wrapper .route-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          opacity: .5;
        }

        .lp-wrapper .route-path {
          fill: none;
          stroke: var(--amber);
          stroke-width: 2.5;
          stroke-dasharray: 10 12;
          animation: routeflow 26s linear infinite;
        }

        @keyframes routeflow {
          to {
            stroke-dashoffset: -880;
          }
        }

        /* ---- phone mockup ---- */
        .lp-wrapper .hero-visual {
          position: relative;
          display: flex;
          justify-content: center;
        }

        .lp-wrapper .phone {
          width: 318px;
          background: var(--navy-950);
          border-radius: 42px;
          padding: 12px;
          box-shadow: var(--shadow-lg), inset 0 0 0 2px rgba(255, 255, 255, .07);
          position: relative;
          z-index: 2;
          animation: phonefloat 7s ease-in-out infinite;
        }

        @keyframes phonefloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        .lp-wrapper .phone-screen {
          background: var(--paper);
          border-radius: 32px;
          overflow: hidden;
        }

        .lp-wrapper .phone-top {
          background: var(--navy-700);
          color: var(--white);
          padding: 20px 18px 16px;
        }

        .lp-wrapper .phone-top .greeting {
          font-size: .72rem;
          color: rgba(255, 255, 255, .6);
          font-weight: 600;
        }

        .lp-wrapper .phone-top .title {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.05rem;
          margin-top: 2px;
        }

        .lp-wrapper .phone-stats {
          display: flex;
          gap: 8px;
          margin-top: 14px;
        }

        .lp-wrapper .pstat {
          flex: 1;
          background: rgba(255, 255, 255, .1);
          border-radius: 10px;
          padding: 8px 10px;
        }

        .lp-wrapper .pstat b {
          font-family: var(--font-display);
          font-size: 1.05rem;
          display: block;
          line-height: 1.1;
        }

        .lp-wrapper .pstat span {
          font-size: .62rem;
          color: rgba(255, 255, 255, .65);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .lp-wrapper .phone-body {
          padding: 14px 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lp-wrapper .dcard {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px 14px;
          box-shadow: var(--shadow-sm);
        }

        .lp-wrapper .dcard-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .lp-wrapper .dcard-head b {
          font-size: .84rem;
          font-weight: 800;
        }

        .lp-wrapper .dcard-head .cod {
          font-family: var(--font-mono);
          font-size: .62rem;
          color: var(--ink-soft);
        }

        .lp-wrapper .dcard p {
          font-size: .72rem;
          color: var(--ink-soft);
          margin-top: 3px;
        }

        .lp-wrapper .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: .62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
          padding: 4px 10px;
          border-radius: 999px;
          margin-top: 8px;
        }

        .lp-wrapper .chip::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .lp-wrapper .chip.pendente {
          background: var(--amber-soft);
          color: var(--amber-deep);
        }

        .lp-wrapper .chip.rota {
          background: var(--blue-soft);
          color: #2563EB;
        }

        .lp-wrapper .chip.rota::before {
          animation: pulse 1.4s ease infinite;
        }

        .lp-wrapper .chip.entregue {
          background: var(--green-soft);
          color: var(--green);
        }

        @keyframes pulse {
          50% {
            opacity: .3;
          }
        }

        /* floating badges ao redor do phone */
        .lp-wrapper .float-badge {
          position: absolute;
          background: var(--white);
          border-radius: 14px;
          box-shadow: var(--shadow-md);
          padding: 12px 16px;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 11px;
          animation: phonefloat 8s ease-in-out infinite;
        }

        .lp-wrapper .float-badge .fb-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .lp-wrapper .float-badge b {
          font-family: var(--font-display);
          font-size: .82rem;
          display: block;
          line-height: 1.2;
          color: var(--ink);
        }

        .lp-wrapper .float-badge span {
          font-size: .68rem;
          color: var(--ink-soft);
          font-weight: 600;
        }

        .lp-wrapper .fb-1 {
          top: 9%;
          left: -4%;
          animation-delay: .8s;
        }

        .lp-wrapper .fb-1 .fb-icon {
          background: var(--green-soft);
        }

        .lp-wrapper .fb-2 {
          bottom: 14%;
          right: -6%;
          animation-delay: 1.6s;
        }

        .lp-wrapper .fb-2 .fb-icon {
          background: var(--amber-soft);
        }

        @media(max-width:560px) {
          .lp-wrapper .fb-1 {
            left: 0;
          }
          .lp-wrapper .fb-2 {
            right: 0;
          }
        }

        /* ============ LOGO STRIP / NUMBERS ============ */
        .lp-wrapper .strip {
          background: var(--navy-950);
          color: var(--white);
          padding: 34px 0;
        }

        .lp-wrapper .strip-inner {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .lp-wrapper .strip-item {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .lp-wrapper .strip-item b {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--amber);
        }

        .lp-wrapper .strip-item span {
          font-size: .82rem;
          color: rgba(255, 255, 255, .65);
          font-weight: 600;
          max-width: 150px;
          line-height: 1.35;
        }

        /* ============ PAIN ============ */
        .lp-wrapper .pain-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }

        .lp-wrapper .pain-card {
          background: var(--white);
          border-radius: var(--radius);
          padding: 30px 28px;
          border: 1px solid var(--line);
          position: relative;
          overflow: hidden;
          transition: transform .25s ease, box-shadow .25s ease;
        }

        .lp-wrapper .pain-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-md);
        }

        .lp-wrapper .pain-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--red), #FF8A65);
        }

        .lp-wrapper .pain-card .p-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: var(--red-soft);
          display: grid;
          place-items: center;
          margin-bottom: 18px;
        }

        .lp-wrapper .pain-card h3 {
          font-family: var(--font-display);
          font-size: 1.08rem;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .lp-wrapper .pain-card p {
          color: var(--ink-soft);
          font-size: .93rem;
        }

        /* ============ FEATURES ============ */
        .lp-wrapper .features {
          background: var(--white);
        }

        .lp-wrapper .feat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }

        .lp-wrapper .feat-card {
          background: var(--paper);
          border-radius: var(--radius);
          padding: 32px 28px;
          border: 1px solid var(--line);
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }

        .lp-wrapper .feat-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-md);
          border-color: var(--amber);
        }

        .lp-wrapper .feat-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(140deg, var(--navy-700), var(--navy-900));
          display: grid;
          place-items: center;
          margin-bottom: 20px;
          box-shadow: 0 8px 18px -6px rgba(27, 42, 74, .5);
        }

        .lp-wrapper .feat-icon svg {
          width: 26px;
          height: 26px;
        }

        .lp-wrapper .feat-card h3 {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 800;
          margin-bottom: 9px;
        }

        .lp-wrapper .feat-card p {
          color: var(--ink-soft);
          font-size: .93rem;
        }

        .lp-wrapper .feat-tag {
          display: inline-block;
          margin-top: 14px;
          font-family: var(--font-mono);
          font-size: .64rem;
          font-weight: 600;
          letter-spacing: .1;
          text-transform: uppercase;
          background: var(--amber-soft);
          color: var(--amber-deep);
          padding: 4px 10px;
          border-radius: 6px;
        }

        /* ============ FLOW (como funciona) ============ */
        .lp-wrapper .flow {
          background: var(--navy-900);
          color: var(--white);
          position: relative;
          overflow: hidden;
        }

        .lp-wrapper .flow .section-head h2 {
          color: var(--white);
        }

        .lp-wrapper .flow .section-head p {
          color: rgba(255, 255, 255, .7);
        }

        .lp-wrapper .flow-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 26px;
          position: relative;
          z-index: 2;
        }

        .lp-wrapper .flow-step {
          background: rgba(255, 255, 255, .05);
          border: 1px solid rgba(255, 255, 255, .1);
          border-radius: var(--radius);
          padding: 34px 28px;
          backdrop-filter: blur(4px);
          transition: transform .25s ease, background .25s ease;
        }

        .lp-wrapper .flow-step:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, .08);
        }

        .lp-wrapper .flow-num {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: .75rem;
          color: var(--amber);
          letter-spacing: .16em;
          margin-bottom: 16px;
          display: block;
        }

        .lp-wrapper .flow-step h3 {
          font-family: var(--font-display);
          font-size: 1.15rem;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .lp-wrapper .flow-step p {
          color: rgba(255, 255, 255, .7);
          font-size: .93rem;
        }

        .lp-wrapper .flow-status {
          margin-top: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .lp-wrapper .flow-status .chip {
          margin-top: 0;
        }

        .lp-wrapper .flow-status svg {
          width: 14px;
          height: 14px;
          opacity: .5;
        }

        /* ============ PRICING ============ */
        .lp-wrapper .price-grid {
          display: flex;
          justify-content: center;
          gap: 24px;
          align-items: stretch;
          max-width: 480px;
          margin-inline: auto;
        }

        .lp-wrapper .price-card {
          background: var(--white);
          border-radius: 20px;
          padding: 42px 36px;
          border: 1.5px solid var(--line);
          display: flex;
          flex-direction: column;
          transition: transform .25s ease, box-shadow .25s ease;
          position: relative;
          width: 100%;
        }

        .lp-wrapper .price-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--shadow-md);
        }

        .lp-wrapper .price-card.featured {
          background: linear-gradient(170deg, var(--navy-800), var(--navy-950));
          color: var(--white);
          border-color: var(--amber);
          box-shadow: var(--shadow-lg);
        }

        .lp-wrapper .badge-pop {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(90deg, var(--amber), var(--amber-deep));
          color: var(--navy-950);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: .7rem;
          letter-spacing: .08em;
          text-transform: uppercase;
          padding: 7px 18px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .lp-wrapper .plan-name {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.3rem;
          text-align: center;
        }

        .lp-wrapper .plan-desc {
          font-size: .88rem;
          color: rgba(255, 255, 255, .65);
          margin-top: 6px;
          text-align: center;
          min-height: 40px;
        }

        .lp-wrapper .plan-price {
          margin: 24px 0 6px;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
        }

        .lp-wrapper .plan-price .cur {
          font-family: var(--font-mono);
          font-size: .9rem;
          font-weight: 600;
          color: rgba(255, 255, 255, .6);
        }

        .lp-wrapper .plan-price .val {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: 3.3rem;
          letter-spacing: -.03em;
          line-height: 1;
        }

        .lp-wrapper .plan-price .per {
          font-size: .85rem;
          color: rgba(255, 255, 255, .6);
          font-weight: 600;
        }

        .lp-wrapper .plan-note {
          font-size: .75rem;
          color: rgba(255, 255, 255, .55);
          margin-bottom: 24px;
          text-align: center;
        }

        .lp-wrapper .plan-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 34px;
          flex: 1;
        }

        .lp-wrapper .plan-list li {
          display: flex;
          gap: 10px;
          font-size: .92rem;
          align-items: flex-start;
        }

        .lp-wrapper .plan-list svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .lp-wrapper .price-card .btn {
          width: 100%;
        }

        /* ============ TESTIMONIAL / CASE ============ */
        .lp-wrapper .case {
          background: var(--white);
        }

        .lp-wrapper .case-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 56px;
          align-items: center;
          background: linear-gradient(150deg, var(--navy-800), var(--navy-950));
          border-radius: 26px;
          padding: 64px;
          color: var(--white);
          position: relative;
          overflow: hidden;
        }

        .lp-wrapper .case-box::after {
          content: "";
          position: absolute;
          right: -120px;
          top: -120px;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 176, 32, .22), transparent 65%);
        }

        .lp-wrapper .case-quote {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.4rem;
          line-height: 1.4;
          letter-spacing: -.01em;
        }

        .lp-wrapper .case-quote::before {
          content: "“";
          color: var(--amber);
          font-size: 3rem;
          line-height: 0;
          vertical-align: -14px;
          margin-right: 6px;
        }

        .lp-wrapper .case-author {
          margin-top: 26px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .lp-wrapper .case-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(140deg, var(--amber), var(--amber-deep));
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-weight: 800;
          color: var(--navy-950);
          font-size: 1rem;
        }

        .lp-wrapper .case-author b {
          font-size: .95rem;
          display: block;
        }

        .lp-wrapper .case-author span {
          font-size: .8rem;
          color: rgba(255, 255, 255, .6);
        }

        .lp-wrapper .case-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          position: relative;
          z-index: 2;
        }

        .lp-wrapper .cs-item {
          background: rgba(255, 255, 255, .06);
          border: 1px solid rgba(255, 255, 255, .1);
          border-radius: 16px;
          padding: 24px;
        }

        .lp-wrapper .cs-item b {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: 2rem;
          color: var(--amber);
          display: block;
          letter-spacing: -.02em;
        }

        .lp-wrapper .cs-item span {
          font-size: .8rem;
          color: rgba(255, 255, 255, .7);
          font-weight: 600;
        }

        /* ============ FAQ ============ */
        .lp-wrapper .faq-list {
          max-width: 760px;
          margin-inline: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .lp-wrapper .faq-item {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
          transition: box-shadow .2s;
        }

        .lp-wrapper .faq-item[open] {
          box-shadow: var(--shadow-sm);
        }

        .lp-wrapper .faq-item summary {
          cursor: pointer;
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: .98rem;
          gap: 16px;
        }

        .lp-wrapper .faq-item summary::-webkit-details-marker {
          display: none;
        }

        .lp-wrapper .faq-item summary::after {
          content: "+";
          font-size: 1.5rem;
          color: var(--amber-deep);
          font-weight: 500;
          transition: transform .25s;
          flex-shrink: 0;
          line-height: 1;
        }

        .lp-wrapper .faq-item[open] summary::after {
          transform: rotate(45deg);
        }

        .lp-wrapper .faq-item .faq-body {
          padding: 0 24px 22px;
          color: var(--ink-soft);
          font-size: .93rem;
        }

        /* ============ CTA FINAL ============ */
        .lp-wrapper .cta-final {
          background: radial-gradient(700px 340px at 50% -20%, rgba(255, 176, 32, .16), transparent 60%),
            linear-gradient(165deg, var(--navy-900), var(--navy-950));
          color: var(--white);
          text-align: center;
          padding: 110px 0;
          position: relative;
          overflow: hidden;
        }

        .lp-wrapper .cta-final h2 {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: clamp(2rem, 4.4vw, 3.1rem);
          letter-spacing: -.025em;
          line-height: 1.1;
          max-width: 720px;
          margin: 0 auto 18px;
        }

        .lp-wrapper .cta-final p {
          color: rgba(255, 255, 255, .7);
          max-width: 520px;
          margin: 0 auto 36px;
          font-size: 1.08rem;
        }

        .lp-wrapper .cta-final .hero-ctas {
          justify-content: center;
          margin-bottom: 26px;
        }

        .lp-wrapper .cta-note {
          font-size: .8rem;
          color: rgba(255, 255, 255, .5);
          font-family: var(--font-mono);
        }

        /* ============ FOOTER ============ */
        .lp-wrapper footer {
          background: var(--navy-950);
          color: rgba(255, 255, 255, .6);
          padding: 56px 0 32px;
        }

        .lp-wrapper .footer-grid {
          display: flex;
          justify-content: space-between;
          gap: 40px;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }

        .lp-wrapper .footer-brand {
          max-width: 300px;
        }

        .lp-wrapper .footer-brand p {
          font-size: .85rem;
          margin-top: 14px;
        }

        .lp-wrapper .footer-col h4 {
          font-family: var(--font-display);
          color: var(--white);
          font-size: .85rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 16px;
        }

        .lp-wrapper .footer-col ul {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lp-wrapper .footer-col a {
          font-size: .88rem;
          transition: color .2s;
        }

        .lp-wrapper .footer-col a:hover {
          color: var(--amber);
        }

        .lp-wrapper .footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, .08);
          padding-top: 26px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          font-size: .78rem;
          font-family: var(--font-mono);
        }

        /* ============ RESPONSIVE ============ */
        @media(max-width:960px) {
          .lp-wrapper .hero-grid {
            grid-template-columns: 1fr;
            gap: 64px;
          }
          .lp-wrapper .hero {
            padding-top: 140px;
          }
          .lp-wrapper .pain-grid,
          .lp-wrapper .feat-grid,
          .lp-wrapper .flow-steps {
            grid-template-columns: 1fr 1fr;
          }
          .lp-wrapper .price-grid {
            max-width: 100%;
          }
          .lp-wrapper .case-box {
            grid-template-columns: 1fr;
            padding: 44px 32px;
            gap: 36px;
          }
        }

        @media(max-width:680px) {
          .lp-wrapper .section {
            padding: 72px 0;
          }
          .lp-wrapper .pain-grid,
          .lp-wrapper .feat-grid,
          .lp-wrapper .flow-steps {
            grid-template-columns: 1fr;
          }
          .lp-wrapper .nav-links {
            position: fixed;
            inset: 0;
            background: var(--navy-950);
            flex-direction: column;
            justify-content: center;
            gap: 30px;
            transform: translateX(100%);
            transition: transform .3s ease;
          }
          .lp-wrapper .nav-links.open {
            transform: none;
          }
          .lp-wrapper .nav-links a {
            font-size: 1.2rem;
          }
          .lp-wrapper .nav-toggle {
            display: block;
            position: relative;
            z-index: 70;
          }
          .lp-wrapper .nav-toggle.open span:nth-child(1) {
            transform: translateY(7.5px) rotate(45deg);
          }
          .lp-wrapper .nav-toggle.open span:nth-child(2) {
            opacity: 0;
          }
          .lp-wrapper .nav-toggle.open span:nth-child(3) {
            transform: translateY(-7.5px) rotate(-45deg);
          }
          .lp-wrapper .strip-inner {
            justify-content: flex-start;
          }
          .lp-wrapper .case-stats {
            grid-template-columns: 1fr;
          }
          .lp-wrapper .phone {
            width: 280px;
          }
        }
      `}} />

      <div className="lp-wrapper">

        {/* ==================== NAV ==================== */}
        <nav className={`nav ${scrolled ? "scrolled" : ""}`} id="nav">
          <div className="container nav-inner">
            <a href="#" className="logo" aria-label="Frete Fácil PRO">
              <div className="logo-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="#081226" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 8h12v9H1z" />
                  <path d="M13 11h4l3 3v3h-7" />
                  <circle cx="6" cy="19" r="1.8" />
                  <circle cx="17" cy="19" r="1.8" />
                </svg>
              </div>
              <div className="logo-text">Frete Fácil<span>PRO · ENTREGAS</span></div>
            </a>
            
            <div className={`nav-links ${mobileMenuOpen ? "open" : ""}`} id="navLinks">
              <a href="#recursos" onClick={() => setMobileMenuOpen(false)}>Recursos</a>
              <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)}>Como funciona</a>
              <a href="#planos" onClick={() => setMobileMenuOpen(false)}>Planos</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)}>Dúvidas</a>
              <a href="/auth" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigate({ to: "/auth" }); }} className="btn btn-ghost" style={{ border: "1px solid rgba(255,255,255,0.15)", padding: "10px 20px" }}>Acessar Sistema</a>
              <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-amber">Assinar Plano PRO</a>
            </div>

            <button className={`nav-toggle ${mobileMenuOpen ? "open" : ""}`} id="navToggle" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <span></span><span></span><span></span>
            </button>
          </div>
        </nav>

        {/* ==================== HERO ==================== */}
        <header className="hero">
          <svg className="route-svg" viewBox="0 0 1440 700" preserveAspectRatio="none" aria-hidden="true">
            <path className="route-path" d="M-40,560 C240,470 320,640 560,540 S900,320 1120,400 S1380,300 1500,340" />
          </svg>
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">Gestão de entregas · materiais de construção</span>
              <h1>Da loja ao canteiro, <em>cada entrega</em> sob controle.</h1>
              <p className="hero-sub">
                Chega de canhoto perdido e telefone tocando. O Frete Fácil PRO organiza
                entregas, motoristas e frota em um só painel — com comprovante por foto,
                funcionamento offline e visão em tempo real.
              </p>
              <div className="hero-ctas">
                <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-amber">
                  Assinar Plano PRO
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
                <a href="#como-funciona" className="btn btn-ghost">Ver como funciona</a>
              </div>
              <div className="hero-proof">
                <div className="proof-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#12B76A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Ativação imediata
                </div>
                <div className="proof-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#12B76A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Configuração em minutos
                </div>
                <div className="proof-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#12B76A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Funciona sem internet
                </div>
              </div>
            </div>

            <div className="hero-visual">
              {/* badge flutuante 1 */}
              <div className="float-badge fb-1">
                <div class="fb-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12B76A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div><b>Entrega concluída</b><span>Foto + assinatura salvas</span></div>
              </div>
              
              {/* badge flutuante 2 */}
              <div className="float-badge fb-2">
                <div class="fb-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F08C00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <path d="M7 20h10M9 9h6M9 13h4" />
                  </svg>
                </div>
                <div><b>Controle de Frota</b><span>Manutenção e pneus</span></div>
              </div>

              {/* mockup do app */}
              <div className="phone" aria-hidden="true">
                <div className="phone-screen">
                  <div className="phone-top">
                    <div className="greeting">Bom dia, Carlos 👋</div>
                    <div className="title">Entregas de hoje</div>
                    <div className="phone-stats">
                      <div className="pstat"><b>8</b><span>Pendentes</span></div>
                      <div className="pstat"><b>3</b><span>Em rota</span></div>
                      <div className="pstat"><b>14</b><span>Entregues</span></div>
                    </div>
                  </div>
                  <div className="phone-body">
                    <div className="dcard">
                      <div className="dcard-head"><b>Constr. Bela Vista</b><span className="cod">#2841</span></div>
                      <p>40 sacos de cimento · 2 ton de areia</p>
                      <span className="chip rota">Em rota</span>
                    </div>
                    <div className="dcard">
                      <div className="dcard-head"><b>Obra Jardim Europa</b><span class="cod">#2842</span></div>
                      <p>Cerâmica 60x60 · argamassa AC-III</p>
                      <span className="chip pendente">Pendente</span>
                    </div>
                    <div className="dcard">
                      <div className="dcard-head"><b>Residencial Aurora</b><span class="cod">#2839</span></div>
                      <p>Tijolos 8 furos · vergalhão 10mm</p>
                      <span className="chip entregue">Entregue</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ==================== STRIP ==================== */}
        <div className="strip">
          <div className="container strip-inner">
            <div className="strip-item"><b>100%</b><span>das entregas com comprovação digital</span></div>
            <div className="strip-item"><b>3</b><span>perfis de acesso: gestor, balcão e motorista</span></div>
            <div className="strip-item"><b>0</b><span>papel: adeus pranchetas e canhotos</span></div>
            <div className="strip-item"><b>24/7</b><span>funciona offline e sincroniza sozinho</span></div>
          </div>
        </div>

        {/* ==================== DORES ==================== */}
        <section className="section" id="dores">
          <div className="container">
            <div className="section-head reveal">
              <span className="eyebrow">O problema de todo dia</span>
              <h2>Você reconhece essa rotina?</h2>
              <p>Quem tem loja de material de construção sabe: a entrega é onde a operação vira caos — e onde o cliente forma a opinião sobre a sua loja.</p>
            </div>
            <div className="pain-grid">
              <div className="pain-card reveal">
                <div className="p-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M9 15l6-6M15 15l-6-6" />
                  </svg>
                </div>
                <h3>Canhoto que some</h3>
                <p>O cliente jura que não recebeu, o papel sumiu na caçamba e a loja fica sem prova. Toda discussão de entrega vira prejuízo ou desgaste.</p>
              </div>
              <div className="pain-card reveal">
                <div class="p-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.79.63 2.65a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6 6l1.43-1.29a2 2 0 0 1 2.11-.45c.86.29 1.75.51 2.65.63A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <h3>Telefone que não para</h3>
                <p>"Onde está minha entrega?" O balcão vira central de atendimento, o motorista não atende e ninguém sabe responder o cliente com certeza.</p>
              </div>
              <div className="pain-card reveal">
                <div class="p-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <h3>Frota no escuro</h3>
                <p>Combustível, pneu, manutenção: os custos do caminhão aparecem só no fim do mês — e sempre maiores do que você imaginava.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== RECURSOS ==================== */}
        <section className="section features" id="recursos">
          <div className="container">
            <div className="section-head reveal">
              <span className="eyebrow">A solução completa</span>
              <h2>Tudo o que a sua operação de entrega precisa</h2>
              <p>Do pedido no balcão à assinatura no canteiro, cada etapa registrada — sem papel, sem planilha, sem adivinhação.</p>
            </div>
            <div className="feat-grid">
              <div className="feat-card reveal">
                <div className="feat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 8h12v9H1z" />
                    <path d="M13 11h4l3 3v3h-7" />
                    <circle cx="6" cy="19" r="1.8" />
                    <circle cx="17" cy="19" r="1.8" />
                  </svg>
                </div>
                <h3>Fluxo de entrega em tempo real</h3>
                <p>Cada entrega passa por status claros — pendente, em rota, entregue — visíveis para o balcão e para o gestor no mesmo instante.</p>
                <span className="feat-tag">Tempo real</span>
              </div>
              <div className="feat-card reveal">
                <div className="feat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <h3>Comprovação por foto e assinatura</h3>
                <p>O motorista registra foto da entrega e assinatura do cliente direto no celular. A prova fica salva para sempre, ligada ao pedido.</p>
                <span class="feat-tag">Fim do canhoto</span>
              </div>
              <div className="feat-card reveal">
                <div className="feat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <path d="M7 20h10M9 9h6M9 13h4" />
                  </svg>
                </div>
                <h3>Abastecimento simplificado</h3>
                <p>Monitore médias de consumo de combustível, lançando de forma rápida os abastecimentos diretamente no sistema em rota.</p>
                <span class="feat-tag">Combustível</span>
              </div>
              <div className="feat-card reveal">
                <div className="feat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3.5" />
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                  </svg>
                </div>
                <h3>Gestão de pneus e sulcos</h3>
                <p>Controle rodízio, quilometragem, aferições de sulco (em milímetros) e vida útil dos pneus da frota. Evite desgastes prematuros.</p>
                <span class="feat-tag">Frota</span>
              </div>
              <div className="feat-card reveal">
                <div className="feat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <h3>Custo real por veículo</h3>
                <p>Combustível, manutenção e despesas lançadas na hora. Você enxerga quanto cada caminhão custa de verdade, todo mês.</p>
                <span class="feat-tag">Financeiro</span>
              </div>
              <div className="feat-card reveal">
                <div className="feat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1.42 9a16 16 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                  </svg>
                </div>
                <h3>Funciona sem internet</h3>
                <p>No canteiro sem sinal? O app continua funcionando e sincroniza tudo sozinho quando a conexão volta. Nenhum registro se perde.</p>
                <span class="feat-tag">Offline-first</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== COMO FUNCIONA ==================== */}
        <section className="section flow" id="como-funciona">
          <div className="container">
            <div className="section-head reveal">
              <span className="eyebrow">Como funciona</span>
              <h2>Três passos. Zero papel.</h2>
              <p>O Frete Fácil PRO acompanha a entrega do jeito que ela acontece de verdade na sua loja.</p>
            </div>
            <div className="flow-steps">
              <div className="flow-step reveal">
                <span className="flow-num">PASSO 01</span>
                <h3>O balcão registra</h3>
                <p>Fechou a venda? Em segundos a entrega está no sistema, com endereço, itens e veículo definidos. Sem prancheta, sem bloquinho.</p>
                <div className="flow-status"><span className="chip pendente">Pendente</span></div>
              </div>
              <div className="flow-step reveal">
                <span className="flow-num">PASSO 02</span>
                <h3>O motorista recebe no celular</h3>
                <p>A rota do dia aparece no app do motorista. Ele inicia a entrega com um toque e a loja acompanha tudo em tempo real.</p>
                <div className="flow-status">
                  <span className="chip pendente">Pendente</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <span className="chip rota">Em rota</span>
                </div>
              </div>
              <div className="flow-step reveal">
                <span className="flow-num">PASSO 03</span>
                <h3>O cliente confirma no canteiro</h3>
                <p>Foto do material entregue e assinatura na tela. A comprovação fica salva no pedido, disponível para consulta a qualquer momento.</p>
                <div className="flow-status">
                  <span className="chip rota">Em rota</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <span className="chip entregue">Entregue ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== CASE ==================== */}
        <section className="section case">
          <div className="container">
            <div className="case-box reveal">
              <div>
                <p className="case-quote">Antes, toda semana tinha discussão por causa de entrega sem comprovante. Hoje o cliente pergunta e eu respondo na hora, com foto e assinatura na tela.</p>
                <div className="case-author">
                  <div className="case-avatar">CR</div>
                  <div>
                    <b>CR Materiais para Construção</b>
                    <span>Luzimangues · Tocantins — primeira operação rodando com Frete Fácil PRO</span>
                  </div>
                </div>
              </div>
              <div className="case-stats">
                <div className="cs-item"><b>-90%</b><span>de ligações \"cadê minha entrega?\"</span></div>
                <div className="cs-item"><b>100%</b><span>das entregas com foto e assinatura</span></div>
                <div className="cs-item"><b>1 tela</b><span>para toda a operação do dia</span></div>
                <div className="cs-item"><b>R$ 0</b><span>gastos com bloco de canhoto</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== PLANOS ==================== */}
        <section className="section" id="planos">
          <div className="container">
            <div className="section-head reveal" style={{ marginInline: "auto", textAlign: "center", maxWidth: "600px" }}>
              <span className="eyebrow" style={{ justifyContent: "center" }}>Plano e preço</span>
              <h2>O plano completo para a sua operação</h2>
              <p>Adote o Frete Fácil PRO com tudo liberado e simplifique o controle das suas entregas hoje mesmo.</p>
            </div>
            
            <div className="price-grid">
              <div className="price-card featured reveal">
                <span className="badge-pop">Plano Comercial Único</span>
                <div className="plan-name">Plano PRO</div>
                <p className="plan-desc">Acesso completo para toda a sua equipe de balcão e estrada.</p>
                
                <div className="plan-price">
                  <span className="cur">R$</span>
                  <span className="val">149,90</span>
                  <span className="per">/mês</span>
                </div>
                <p className="plan-note">Sem taxa de adesão · Cancele quando quiser</p>
                
                <ul className="plan-list">
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Motoristas e veículos ilimitados
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Comprovação digital por foto e assinatura
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Funcionamento offline com sincronização automática
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Gestão de pneus, sulcos e manutenções da frota
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Lançamento de despesas e custos reais dos veículos
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Suporte humanizado direto via WhatsApp
                  </li>
                </ul>
                
                <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-amber">
                  Assinar Plano PRO
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== FAQ ==================== */}
        <section className="section" id="faq" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head reveal" style={{ marginInline: "auto", textAlign: "center" }}>
              <span className="eyebrow" style={{ justifyContent: "center" }}>Perguntas frequentes</span>
              <h2>Ficou alguma dúvida?</h2>
            </div>
            <div className="faq-list">
              <details className="faq-item reveal">
                <summary>Preciso instalar algum programa?</summary>
                <div class="faq-body">Não. O Frete Fácil PRO funciona direto no navegador do computador e pode ser instalado como aplicativo no celular do motorista com um toque — sem loja de aplicativos, sem complicação.</div>
              </details>
              <details className="faq-item reveal">
                <summary>E se o motorista ficar sem internet na rota?</summary>
                <div class="faq-body">O app continua funcionando normalmente. O motorista registra a entrega, tira foto e coleta assinatura mesmo sem sinal. Quando a conexão volta, tudo sincroniza sozinho — nada se perde.</div>
              </details>
              <details className="faq-item reveal">
                <summary>O motorista consegue ver dados da loja?</summary>
                <div class="faq-body">Não. Cada perfil vê apenas o que precisa: o motorista vê só as entregas dele; o balcão registra e acompanha; o gestor enxerga a operação inteira, incluindo custos e relatórios.</div>
              </details>
              <details className="faq-item reveal">
                <summary>Meus dados ficam seguros?</summary>
                <div class="faq-body">Sim. Os dados ficam em nuvem com criptografia e isolamento por empresa: as informações da sua loja são acessíveis apenas pelos usuários que você autorizar.</div>
              </details>
              <details className="faq-item reveal">
                <summary>Consigo cancelar quando quiser?</summary>
                <div class="faq-body">Sim. Não há fidelidade nem multa no Plano PRO. Você pode cancelar a qualquer momento e exportar seus dados antes de sair.</div>
              </details>
            </div>
          </div>
        </section>

        {/* ==================== CTA FINAL ==================== */}
        <section className="cta-final">
          <div className="container reveal">
            <h2>Sua próxima entrega já pode sair com o Frete Fácil PRO.</h2>
            <p>Assine hoje mesmo por apenas R$ 149,90 ao mês e revolucione o fluxo de expedição do seu negócio.</p>
            <div className="hero-ctas">
              <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-amber">
                Assinar Plano PRO
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a href={contactWhatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Falar no WhatsApp</a>
            </div>
            <span className="cta-note">SEM ADESÃO · SEM FIDELIDADE · SUPORTE DIRETO COM DESENVOLVEDOR</span>
          </div>
        </section>

        {/* ==================== FOOTER ==================== */}
        <footer>
          <div className="container">
            <div className="footer-grid">
              <div className="footer-brand">
                <a href="#" className="logo">
                  <div className="logo-mark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#081226" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 8h12v9H1z" />
                      <path d="M13 11h4l3 3v3h-7" />
                      <circle cx="6" cy="19" r="1.8" />
                      <circle cx="17" cy="19" r="1.8" />
                    </svg>
                  </div>
                  <div className="logo-text">Frete Fácil<span>PRO · ENTREGAS</span></div>
                </a>
                <p>Gestão de entregas feita para lojas de materiais de construção. Do balcão ao canteiro, tudo sob controle.</p>
              </div>
              
              <div className="footer-col">
                <h4>Produto</h4>
                <ul>
                  <li><a href="#recursos">Recursos</a></li>
                  <li><a href="#como-funciona">Como funciona</a></li>
                  <li><a href="#planos">Planos</a></li>
                  <li><a href="#faq">Dúvidas</a></li>
                </ul>
              </div>
              
              <div className="footer-col">
                <h4>Contato</h4>
                <ul>
                  <li><a href="https://wa.me/5563984446555">WhatsApp Comercial</a></li>
                  <li><a href="mailto:comercial@fretefacilpro.com.br">comercial@fretefacilpro.com.br</a></li>
                  <li style={{ marginTop: "10px", fontSize: "0.8rem", color: "#FFB020" }}>Suporte Rodrigo: (63) 98444-6555</li>
                </ul>
              </div>
              
              <div className="footer-col">
                <h4>Legal</h4>
                <ul>
                  <li><a href="#">Política de privacidade</a></li>
                  <li><a href="#">Termos de uso</a></li>
                </ul>
              </div>
            </div>
            
            <div className="footer-bottom">
              <span>© {new Date().getFullYear()} Frete Fácil PRO. Todos os direitos reservados.</span>
              <span>fretefacilpro.vercel.app</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
