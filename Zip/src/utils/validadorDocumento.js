// src/utils/validadorDocumento.js
// Valida CPF (11 dígitos) e CNPJ (14 dígitos) com dígito verificador.
// Aceita entrada com ou sem máscara.

function apenasNumeros(str) {
  return String(str || '').replace(/\D/g, '');
}

function validarCPF(cpf) {
  const num = apenasNumeros(cpf);
  if (num.length !== 11) return false;

  // Rejeita sequências como 11111111111, 22222222222 etc.
  if (/^(\d)\1+$/.test(num)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(num[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(num[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(num[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(num[10]);
}

function validarCNPJ(cnpj) {
  const num = apenasNumeros(cnpj);
  if (num.length !== 14) return false;
  if (/^(\d)\1+$/.test(num)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(num[i]) * pesos1[i];
  let resto = soma % 11;
  const dv1 = resto < 2 ? 0 : 11 - resto;
  if (dv1 !== parseInt(num[12])) return false;

  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(num[i]) * pesos2[i];
  resto = soma % 11;
  const dv2 = resto < 2 ? 0 : 11 - resto;
  return dv2 === parseInt(num[13]);
}

function validarDocumento(doc, tipo) {
  if (tipo === 'PF') return validarCPF(doc);
  if (tipo === 'PJ') return validarCNPJ(doc);
  return false;
}

function formatarCPF(cpf) {
  const n = apenasNumeros(cpf);
  if (n.length !== 11) return cpf;
  return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
}

function formatarCNPJ(cnpj) {
  const n = apenasNumeros(cnpj);
  if (n.length !== 14) return cnpj;
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
}

function formatarDocumento(doc, tipo) {
  if (tipo === 'PF') return formatarCPF(doc);
  if (tipo === 'PJ') return formatarCNPJ(doc);
  return doc;
}

module.exports = {
  apenasNumeros,
  validarCPF,
  validarCNPJ,
  validarDocumento,
  formatarCPF,
  formatarCNPJ,
  formatarDocumento
};
