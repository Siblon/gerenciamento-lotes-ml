import { describe, test, expect } from 'vitest'
import { validarCodigo, calcularLucro } from '../src/js/app'

describe('Validações básicas', () => {
  test('Código válido confere com planilha', () => {
    const codigo = 'CECP92804'
    const planilha = [{ codigo_ml: 'CECP92804' }]
    expect(validarCodigo(codigo, planilha)).toBe(true)
  })

  test('Cálculo de lucro bruto', () => {
    const precoVenda = 120
    const precoPago = 80
    expect(calcularLucro(precoVenda, precoPago)).toBe(40)
  })
})