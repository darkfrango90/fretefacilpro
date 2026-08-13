export function parseMoeda(valor: string | number | null | undefined): number | null {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = valor.trim().replace(/R\$|\s/g, "");
  if (!texto) return null;
  const temVirgula = texto.includes(",");
  const pontosComoMilhar = /^\d{1,3}(?:\.\d{3})+$/.test(texto);
  const normalizado = temVirgula
    ? texto.replace(/\./g, "").replace(",", ".")
    : pontosComoMilhar
      ? texto.replace(/\./g, "")
      : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function formatarMoeda(valor: string | number | null | undefined): string {
  const numero = parseMoeda(valor);
  if (numero == null) return "R$ 0,00";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarValorMonetarioCampo(valor: string): string {
  if (!valor) return "";
  const negativo = valor.startsWith("-");
  const limpo = valor.replace("-", "");
  const decimalPendente = limpo.endsWith(".");
  const [inteiroRaw = "0", decimalRaw = ""] = limpo.split(".");
  const inteiro = (inteiroRaw.replace(/^0+(?=\d)/, "") || "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
  const decimal = decimalRaw.slice(0, 2);
  return `${negativo ? "-" : ""}${inteiro}${decimalPendente || decimal ? `,${decimal}` : ""}`;
}

export function normalizarDigitacaoMonetaria(proximo: string): string {
  const texto = proximo.replace(/R\$|\s/g, "").replace(/[^\d.,]/g, "");
  if (!texto) return "";

  const indiceVirgula = texto.lastIndexOf(",");
  if (indiceVirgula >= 0) {
    const inteiro = texto.slice(0, indiceVirgula).replace(/\D/g, "") || "0";
    const decimal = texto
      .slice(indiceVirgula + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
    return `${Number(inteiro)}.${decimal}`;
  }

  // Pontos exibidos pelo próprio componente são separadores de milhar.
  return String(Number(texto.replace(/\D/g, "") || "0"));
}
