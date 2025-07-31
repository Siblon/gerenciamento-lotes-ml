export function validarCodigo(codigo, planilha) {
  return planilha.some(item => item.codigo_ml === codigo);
}

export function calcularLucro(precoVenda, precoPago) {
  return precoVenda - precoPago;
}

if (typeof window !== 'undefined') {
  window.buscar = function () {
    const codigo = document.getElementById("inputCodigo").value.trim();
    const dummyPlanilha = [{ codigo_ml: "CECP92804" }];
    const found = validarCodigo(codigo, dummyPlanilha);
    document.getElementById("resultado").innerText = found
      ? "Produto encontrado!"
      : "Código não encontrado.";
  }
}