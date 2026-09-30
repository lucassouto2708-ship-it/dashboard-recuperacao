// CONFIGURAÇÃO — edite só este arquivo.
window.CONFIG = {
  // ID da planilha: é o trecho entre /d/ e /edit no link do Google Sheets
  SHEET_ID: "1Oe8n6LxwyguYykRL3lFEgs--3Wsx-YUYbVrZ5mZ-Tfc",

  // Nome EXATO de cada aba, como aparece embaixo na planilha.
  // tipo "cobranca" = tabela com TENTATIVA 01/02 e VALOR ATUAL
  // tipo "parcelamento" = tabela com VALOR DA PARCELA e QTDE DE PARCELAS
  // Cada aba pode ser indicada por "gid" (número no final do link ao clicar na aba: ...#gid=123)
  // ou por "nome" (exato). O tipo é detectado sozinho pelos cabeçalhos.
  ABAS: [
    { gid: 0 }
    // { gid: 123456789 },   // adicione aqui a aba de parcelamento
  ],

  // Palavras na coluna SITUAÇÃO que significam "já foi pago"
  PALAVRAS_PAGO: ["pago", "paga", "quitado", "quitada", "liquidado"],
  // Palavras que NÃO contam como pago (ex.: "não pago")
  PALAVRAS_NAO_PAGO: ["não pago", "nao pago", "não paga", "nao paga", "a pagar", "pendente"]
};
