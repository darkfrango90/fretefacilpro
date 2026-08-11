const MAX_KM = 99_999_999_999.9;

function arredondarUmaCasa(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10) / 10;
}

/**
 * Converte quilometragem digitada nos formatos mais comuns no Brasil.
 * Exemplos aceitos: 547141,7; 547.141,7; 547141.7; 547.141.
 */
export function parseQuilometragem(valor: string | number): number | null {
  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || valor < 0 || valor > MAX_KM) return null;
    return arredondarUmaCasa(valor);
  }

  const texto = valor.trim().replace(/\s+/g, "");
  if (!texto || !/^\d+(?:[.,]\d+)*$/.test(texto)) return null;

  const ultimoPonto = texto.lastIndexOf(".");
  const ultimaVirgula = texto.lastIndexOf(",");
  let normalizado: string;

  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    const separadorDecimal = ultimoPonto > ultimaVirgula ? "." : ",";
    const separadorMilhar = separadorDecimal === "." ? "," : ".";
    const semMilhar = texto.split(separadorMilhar).join("");
    const indiceDecimal = semMilhar.lastIndexOf(separadorDecimal);
    normalizado =
      semMilhar.slice(0, indiceDecimal).split(separadorDecimal).join("") +
      "." +
      semMilhar.slice(indiceDecimal + 1);
  } else if (ultimoPonto >= 0 || ultimaVirgula >= 0) {
    const separador = ultimoPonto >= 0 ? "." : ",";
    const partes = texto.split(separador);
    const gruposDeMilhar = partes.length > 1 && partes.slice(1).every((parte) => parte.length === 3);

    if (gruposDeMilhar) {
      normalizado = partes.join("");
    } else {
      const decimal = partes.at(-1)!;
      normalizado = `${partes.slice(0, -1).join("")}.${decimal}`;
    }
  } else {
    normalizado = texto;
  }

  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0 || numero > MAX_KM) return null;
  return arredondarUmaCasa(numero);
}

export function formatarQuilometragem(valor: string | number): string {
  const numero = parseQuilometragem(valor);
  if (numero == null) return String(valor);
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(numero) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}
