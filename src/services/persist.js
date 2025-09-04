import { getJSON, setJSON, updateArray } from '../utils/safeStorage.js';

// Conferidos
export function saveConferido(item) {
  updateArray('confApp.conferidos', arr => {
    arr.push(item);
    return arr;
  });
}

// Excedentes (SKU, descricao, qtd, preco_unit?, obs?)
export function saveExcedente(reg) {
  updateArray('confApp.excedentes', arr => {
    arr.push(reg);
    return arr;
  });
}

// Leitura
export function loadConferidos()  { return getJSON('confApp.conferidos',  []); }
export function loadExcedentes()  { return getJSON('confApp.excedentes',  []); }

