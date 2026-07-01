export interface PermissoesEfetivas {
  cpf_cnpj_obrigatorio: boolean;
  telefone_obrigatorio: boolean;
  pode_cadastrar_cliente: boolean;
  pode_alterar_valor_produto: boolean;
  desconto_maximo_percent: number;
  pode_alterar_frete: boolean;
  frete_maximo: number | null;
  materiais_permitidos: string[] | null;
  valor_venda_minimo: number | null;
  valor_venda_maximo: number | null;
  foto_odometro_obrigatoria: boolean;
  gps_obrigatorio: boolean;
  observacao_obrigatoria: boolean;
  pode_cancelar_entrega: boolean;
}

export const PERMISSOES_DEFAULT: PermissoesEfetivas = {
  cpf_cnpj_obrigatorio: false,
  telefone_obrigatorio: false,
  pode_cadastrar_cliente: true,
  pode_alterar_valor_produto: true,
  desconto_maximo_percent: 0,
  pode_alterar_frete: true,
  frete_maximo: null,
  materiais_permitidos: null,
  valor_venda_minimo: null,
  valor_venda_maximo: null,
  foto_odometro_obrigatoria: true,
  gps_obrigatorio: false,
  observacao_obrigatoria: false,
  pode_cancelar_entrega: false,
};

export function parsePermissoes(raw: any): PermissoesEfetivas {
  if (!raw || typeof raw !== "object") return { ...PERMISSOES_DEFAULT };
  return { ...PERMISSOES_DEFAULT, ...raw };
}

// --- Máscaras / validações de CPF e CNPJ ---
export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D+/g, "");
}

export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCpfCnpj(v: string, tipo: "fisica" | "juridica"): string {
  return tipo === "fisica" ? maskCpf(v) : maskCnpj(v);
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(cpf[i]) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(cpf[9]) && calc(10) === parseInt(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(base[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(c, w1) === parseInt(c[12]) && calc(c, w2) === parseInt(c[13]);
}

export function isValidCpfCnpj(value: string, tipo: "fisica" | "juridica"): boolean {
  return tipo === "fisica" ? isValidCpf(value) : isValidCnpj(value);
}
