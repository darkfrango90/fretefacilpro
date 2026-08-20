type LinhaRanking = {
  nome: string;
  qtd: number;
  receita: number;
};

type LinhaVenda = {
  numero?: number | null;
  criada_em: string;
  cliente: string;
  material: string;
  motorista: string;
  motorista_venda: string;
  motorista_entrega: string;
  forma_pagamento?: string | null;
  status: string;
  valor_venda: number;
  valor_frete: number;
  total: number;
  custo_materiais: number;
  lucro_bruto: number;
  margem_bruta: number;
  observacoes: string;
};

export type DadosRelatorioExportacao = {
  total: number;
  finalizadas: number;
  canceladas: number;
  emRota: number;
  pendentes: number;
  totalReceita: number;
  receitaProduto: number;
  receitaFrete: number;
  ticketMedio: number;
  taxaConversao: number;
  gastoCombustivel: number;
  litrosTotais: number;
  despesasOperacionais: number;
  saldoOperacional: number;
  custoMateriais: number;
  lucroReal: number;
  margemLucroReal: number;
  vendas: LinhaVenda[];
  rankingMotoristas: LinhaRanking[];
  topClientes: LinhaRanking[];
  topMateriais: LinhaRanking[];
  porPagamento: LinhaRanking[];
  consumoVeiculos: Array<{
    label: string;
    litros: number;
    valor: number;
    kmRodado: number;
    kmL: number;
    rsKm: number;
    absCount: number;
  }>;
  serieDiaria: Array<{ dia: string; qtd: number; receita: number }>;
};

type OpcoesExportacao = {
  dados: DadosRelatorioExportacao;
  periodo: string;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_rota: "Em rota",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

const PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  deposito: "Depósito",
  cartao_credito: "Cartão de crédito",
  boleto: "Boleto",
  permuta: "Permuta",
  carteira: "Carteira",
};

const COR_PRIMARIA = "1E3158";
const COR_CABECALHO = "E8EDF6";
const COR_TEXTO_SUAVE = "657089";

function nomeArquivo(extensao: "pdf" | "xlsx") {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `relatorio-${ano}-${mes}-${dia}.${extensao}`;
}

function dataHoraBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dataBR(iso: string) {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
  return new Date(data).toLocaleDateString("pt-BR");
}

function pagamentoLabel(valor?: string | null) {
  if (!valor) return "—";
  return PAGAMENTO_LABEL[valor] ?? valor;
}

function statusLabel(valor: string) {
  return STATUS_LABEL[valor] ?? valor;
}

function baixar(blob: Blob, arquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function exportarRelatorioExcel({ dados, periodo }: OpcoesExportacao) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Frete Fácil PRO";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 12_000,
      height: 20_000,
      firstSheet: 0,
      activeTab: 1,
      visibility: "visible",
    },
  ];

  const resumo = workbook.addWorksheet("Resumo", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  resumo.columns = [
    { key: "indicador", width: 28 },
    { key: "valor", width: 20 },
    { key: "indicador2", width: 28 },
    { key: "valor2", width: 20 },
  ];
  resumo.mergeCells("A1:D1");
  resumo.getCell("A1").value = "Relatório gerencial - Frete Fácil PRO";
  resumo.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  resumo.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${COR_PRIMARIA}` },
  };
  resumo.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  resumo.getRow(1).height = 30;
  resumo.mergeCells("A2:D2");
  resumo.getCell("A2").value = `Período: ${periodo}`;
  resumo.getCell("A2").font = { italic: true, color: { argb: `FF${COR_TEXTO_SUAVE}` } };
  resumo.getCell("A2").alignment = { horizontal: "center" };
  resumo.addRow([]);
  resumo.addRow(["Indicador", "Valor", "Indicador", "Valor"]);

  const indicadores: Array<[string, number, string, number]> = [
    ["Vendas", dados.total, "Finalizadas", dados.finalizadas],
    ["Em rota", dados.emRota, "Pendentes", dados.pendentes],
    ["Canceladas", dados.canceladas, "Conversão", dados.taxaConversao / 100],
    ["Receita total", dados.totalReceita, "Ticket médio", dados.ticketMedio],
    ["Receita de produtos", dados.receitaProduto, "Receita de fretes", dados.receitaFrete],
    ["Combustível", dados.gastoCombustivel, "Litros", dados.litrosTotais],
    [
      "Despesas conferidas",
      dados.despesasOperacionais,
      "Saldo operacional",
      dados.saldoOperacional,
    ],
  ];
  indicadores.forEach((linha) => resumo.addRow(linha));
  estilizarCabecalho(resumo.getRow(4));
  for (let linha = 5; linha <= 11; linha += 1) {
    resumo.getCell(`A${linha}`).font = { bold: true };
    resumo.getCell(`C${linha}`).font = { bold: true };
  }
  resumo.getCell("D7").numFmt = "0.0%";
  ["B8", "D8", "B9", "D9", "B10", "B11", "D11"].forEach((celula) => {
    resumo.getCell(celula).numFmt = '"R$" #,##0.00';
  });
  resumo.getCell("D10").numFmt = '#,##0.00 "L"';
  aplicarBordas(resumo, 4, 11, 1, 4);

  const vendas = workbook.addWorksheet("Vendas", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  vendas.autoFilter = "A1:L1";
  vendas.columns = [
    { header: "Nº", key: "numero", width: 10 },
    { header: "Data", key: "data", width: 20 },
    { header: "Cliente", key: "cliente", width: 34 },
    { header: "Material", key: "material", width: 38 },
    { header: "Motorista da venda", key: "motorista_venda", width: 28 },
    { header: "Motorista da entrega", key: "motorista_entrega", width: 28 },
    { header: "Valor da venda", key: "valor_venda", width: 18 },
    { header: "Frete", key: "valor_frete", width: 16 },
    { header: "Total", key: "total", width: 18 },
    { header: "Pagamento", key: "pagamento", width: 20 },
    { header: "Status", key: "status", width: 16 },
    { header: "Observação", key: "observacoes", width: 42 },
  ];
  dados.vendas.forEach((venda) => {
    vendas.addRow({
      numero: venda.numero ?? "",
      data: new Date(venda.criada_em),
      cliente: venda.cliente,
      material: venda.material,
      motorista_venda: venda.motorista_venda,
      motorista_entrega: venda.motorista_entrega,
      valor_venda: venda.valor_venda,
      valor_frete: venda.valor_frete,
      total: venda.total,
      pagamento: pagamentoLabel(venda.forma_pagamento),
      status: statusLabel(venda.status),
      observacoes: venda.observacoes || "—",
    });
  });
  estilizarCabecalho(vendas.getRow(1));
  vendas.getColumn("data").numFmt = "dd/mm/yyyy hh:mm";
  ["valor_venda", "valor_frete", "total"].forEach((coluna) => {
    vendas.getColumn(coluna).numFmt = '"R$" #,##0.00';
  });
  vendas.getColumn("material").alignment = { vertical: "top", wrapText: true };
  vendas.getColumn("observacoes").alignment = { vertical: "top", wrapText: true };
  aplicarZebra(vendas, 2, vendas.rowCount, 1, 12);

  criarPlanilhaRanking(workbook, "Motoristas", "Motorista", "Entregas", dados.rankingMotoristas);
  criarPlanilhaRanking(workbook, "Clientes", "Cliente", "Pedidos", dados.topClientes);
  criarPlanilhaRanking(
    workbook,
    "Materiais",
    "Material",
    "Quantidade",
    dados.topMateriais,
    "#,##0.00",
  );
  criarPlanilhaRanking(workbook, "Pagamentos", "Pagamento", "Vendas", dados.porPagamento);

  const veiculos = workbook.addWorksheet("Veículos", { views: [{ state: "frozen", ySplit: 1 }] });
  veiculos.columns = [
    { header: "Veículo", key: "veiculo", width: 35 },
    { header: "Abastecimentos", key: "abastecimentos", width: 18 },
    { header: "KM rodados", key: "km", width: 18 },
    { header: "Litros", key: "litros", width: 16 },
    { header: "Valor", key: "valor", width: 18 },
    { header: "KM/L", key: "kml", width: 14 },
    { header: "R$/KM", key: "rskm", width: 14 },
  ];
  dados.consumoVeiculos.forEach((veiculo) =>
    veiculos.addRow({
      veiculo: veiculo.label,
      abastecimentos: veiculo.absCount,
      km: veiculo.kmRodado,
      litros: veiculo.litros,
      valor: veiculo.valor,
      kml: veiculo.kmL || null,
      rskm: veiculo.rsKm || null,
    }),
  );
  estilizarCabecalho(veiculos.getRow(1));
  veiculos.getColumn("km").numFmt = "#,##0.0";
  veiculos.getColumn("litros").numFmt = "#,##0.00";
  veiculos.getColumn("valor").numFmt = '"R$" #,##0.00';
  veiculos.getColumn("kml").numFmt = "0.00";
  veiculos.getColumn("rskm").numFmt = '"R$" 0.00';
  aplicarZebra(veiculos, 2, veiculos.rowCount, 1, 7);

  const diario = workbook.addWorksheet("Vendas por dia", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  diario.columns = [
    { header: "Data", key: "data", width: 18 },
    { header: "Vendas", key: "vendas", width: 16 },
    { header: "Receita", key: "receita", width: 20 },
  ];
  dados.serieDiaria.forEach((linha) =>
    diario.addRow({
      data: new Date(`${linha.dia}T00:00:00`),
      vendas: linha.qtd,
      receita: linha.receita,
    }),
  );
  estilizarCabecalho(diario.getRow(1));
  diario.getColumn("data").numFmt = "dd/mm/yyyy";
  diario.getColumn("receita").numFmt = '"R$" #,##0.00';
  aplicarZebra(diario, 2, diario.rowCount, 1, 3);

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  baixar(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    nomeArquivo("xlsx"),
  );
}

export async function exportarRelatorioPdf({ dados, periodo }: OpcoesExportacao) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margem = 12;
  let y = 15;

  doc.setFillColor(30, 49, 88);
  doc.rect(0, 0, larguraPagina, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Relatório gerencial", margem, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Período: ${periodo}`, margem, 17);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, larguraPagina - margem, 17, {
    align: "right",
  });
  y = 32;

  const adicionarRodape = () => {
    const paginas = doc.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      doc.setPage(pagina);
      doc.setDrawColor(220, 224, 232);
      doc.line(margem, alturaPagina - 9, larguraPagina - margem, alturaPagina - 9);
      doc.setFontSize(8);
      doc.setTextColor(101, 112, 137);
      doc.text("Frete Fácil PRO", margem, alturaPagina - 5);
      doc.text(`Página ${pagina} de ${paginas}`, larguraPagina - margem, alturaPagina - 5, {
        align: "right",
      });
    }
  };

  const tabela = (
    titulo: string,
    cabecalho: string[],
    corpo: Array<Array<string | number>>,
    tamanhoFonte = 7.5,
  ) => {
    if (y > alturaPagina - 35) {
      doc.addPage();
      y = 16;
    }
    doc.setTextColor(30, 49, 88);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(titulo, margem, y);
    autoTable(doc, {
      startY: y + 3,
      head: [cabecalho],
      body: corpo.length ? corpo : [["Sem dados no período"]],
      margin: { left: margem, right: margem, bottom: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: tamanhoFonte,
        cellPadding: 1.8,
        overflow: "linebreak",
      },
      headStyles: { fillColor: [30, 49, 88], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 248, 251] },
    });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 9;
  };

  tabela(
    "Resumo",
    ["Indicador", "Valor", "Indicador", "Valor"],
    [
      ["Vendas", dados.total, "Finalizadas", dados.finalizadas],
      ["Em rota", dados.emRota, "Pendentes", dados.pendentes],
      ["Canceladas", dados.canceladas, "Conversão", `${dados.taxaConversao.toFixed(1)}%`],
      ["Receita total", moeda(dados.totalReceita), "Ticket médio", moeda(dados.ticketMedio)],
      ["Produtos", moeda(dados.receitaProduto), "Fretes", moeda(dados.receitaFrete)],
      [
        "Combustível",
        moeda(dados.gastoCombustivel),
        "Litros",
        `${dados.litrosTotais.toFixed(2)} L`,
      ],
      ["Custo dos materiais", moeda(dados.custoMateriais), "Lucro real", moeda(dados.lucroReal)],
      ["Margem sobre a receita", `${dados.margemLucroReal.toFixed(1)}%`, "", ""],
    ],
  );

  tabela(
    `Vendas (${dados.vendas.length})`,
    [
      "Nº",
      "Data",
      "Cliente",
      "Material",
      "Motorista",
      "Venda",
      "Custo",
      "Resultado produto",
      "Margem produto",
      "Frete",
      "Status",
      "Observação",
    ],
    dados.vendas.map((venda) => [
      venda.numero ?? "—",
      dataHoraBR(venda.criada_em),
      venda.cliente,
      venda.material,
      venda.motorista,
      moeda(venda.valor_venda),
      moeda(venda.custo_materiais),
      moeda(venda.lucro_bruto),
      `${venda.margem_bruta.toFixed(1)}%`,
      moeda(venda.valor_frete),
      statusLabel(venda.status),
      venda.observacoes || "—",
    ]),
    6.5,
  );

  tabela(
    "Por forma de pagamento",
    ["Forma de pagamento", "Vendas", "Receita"],
    dados.porPagamento.map((linha) => [linha.nome, linha.qtd, moeda(linha.receita)]),
  );
  tabela(
    "Ranking de motoristas",
    ["Motorista", "Entregas", "Receita"],
    dados.rankingMotoristas.map((linha) => [linha.nome, linha.qtd, moeda(linha.receita)]),
  );
  tabela(
    "Top clientes",
    ["Cliente", "Pedidos", "Receita"],
    dados.topClientes.map((linha) => [linha.nome, linha.qtd, moeda(linha.receita)]),
  );
  tabela(
    "Materiais mais vendidos",
    ["Material", "Quantidade", "Receita"],
    dados.topMateriais.map((linha) => [
      linha.nome,
      linha.qtd.toLocaleString("pt-BR"),
      moeda(linha.receita),
    ]),
  );
  tabela(
    "Consumo por caminhão",
    ["Veículo", "Abastecimentos", "KM", "Litros", "Valor", "KM/L", "R$/KM"],
    dados.consumoVeiculos.map((veiculo) => [
      veiculo.label,
      veiculo.absCount,
      veiculo.kmRodado.toLocaleString("pt-BR"),
      veiculo.litros.toFixed(2),
      moeda(veiculo.valor),
      veiculo.kmL ? veiculo.kmL.toFixed(2) : "—",
      veiculo.rsKm ? moeda(veiculo.rsKm) : "—",
    ]),
  );
  tabela(
    "Vendas por dia",
    ["Data", "Vendas", "Receita"],
    dados.serieDiaria.map((linha) => [dataBR(linha.dia), linha.qtd, moeda(linha.receita)]),
  );

  adicionarRodape();
  baixar(doc.output("blob"), nomeArquivo("pdf"));
}

function criarPlanilhaRanking(
  workbook: import("exceljs").Workbook,
  nome: string,
  primeiraColuna: string,
  segundaColuna: string,
  linhas: LinhaRanking[],
  formatoQuantidade = "#,##0",
) {
  const planilha = workbook.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1 }] });
  planilha.columns = [
    { header: primeiraColuna, key: "nome", width: 38 },
    { header: segundaColuna, key: "qtd", width: 18 },
    { header: "Receita", key: "receita", width: 20 },
  ];
  linhas.forEach((linha) => planilha.addRow(linha));
  estilizarCabecalho(planilha.getRow(1));
  planilha.getColumn("qtd").numFmt = formatoQuantidade;
  planilha.getColumn("receita").numFmt = '"R$" #,##0.00';
  aplicarZebra(planilha, 2, planilha.rowCount, 1, 3);
}

function estilizarCabecalho(linha: import("exceljs").Row) {
  linha.height = 22;
  linha.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COR_PRIMARIA}` } };
    celula.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function aplicarZebra(
  planilha: import("exceljs").Worksheet,
  inicio: number,
  fim: number,
  colunaInicial: number,
  colunaFinal: number,
) {
  for (let linha = inicio; linha <= fim; linha += 1) {
    const row = planilha.getRow(linha);
    row.alignment = { vertical: "top" };
    if (linha % 2 === 0) {
      for (let coluna = colunaInicial; coluna <= colunaFinal; coluna += 1) {
        row.getCell(coluna).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${COR_CABECALHO}` },
        };
      }
    }
  }
}

function aplicarBordas(
  planilha: import("exceljs").Worksheet,
  linhaInicial: number,
  linhaFinal: number,
  colunaInicial: number,
  colunaFinal: number,
) {
  for (let linha = linhaInicial; linha <= linhaFinal; linha += 1) {
    for (let coluna = colunaInicial; coluna <= colunaFinal; coluna += 1) {
      planilha.getCell(linha, coluna).border = {
        top: { style: "thin", color: { argb: "FFD9DEE8" } },
        left: { style: "thin", color: { argb: "FFD9DEE8" } },
        bottom: { style: "thin", color: { argb: "FFD9DEE8" } },
        right: { style: "thin", color: { argb: "FFD9DEE8" } },
      };
    }
  }
}

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}
