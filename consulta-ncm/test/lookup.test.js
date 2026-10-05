const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'data', 'base.js'), 'utf8'));
const ConsultaNcm = require('../lookup.js');
const consulta = ConsultaNcm.criar(window.BASE_REFORMA);

function codigos(ncm, data) {
  return consulta.consultar(ncm, data || '2026-10-05').resultados.map((r) => r.cst + '/' + r.cClassTrib);
}

test('aceita NCM com pontos e exige 8 dígitos', () => {
  assert.strictEqual(consulta.consultar('1006.30.21', '2026-10-05').ncm, '10063021');
  assert.strictEqual(consulta.consultar('1006', '2026-10-05').ok, false);
});

test('arroz: cesta básica nacional (Anexo I)', () => {
  assert.ok(codigos('10063021').includes('200/200003'));
  const r = consulta.consultar('10063021', '2026-10-05').resultados.find((x) => x.cClassTrib === '200003');
  assert.strictEqual(r.reducaoCBS, '100');
  assert.deepStrictEqual(r.itensAnexo.map((i) => i.item), ['I/1']);
});

test('carne de frango no Anexo I, foie gras excluído pela exceção', () => {
  assert.deepStrictEqual(codigos('02071400'), ['200/200003']);
  const foieGras = consulta.consultar('02074300', '2026-10-05');
  assert.strictEqual(foieGras.tributacaoIntegral, true);
  assert.deepStrictEqual(codigos('02074300'), ['000/000001']);
  assert.ok(foieGras.excluidaEm.includes('200003'));
});

test('produto fora dos anexos: tributação integral', () => {
  const r = consulta.consultar('84713012', '2026-10-05');
  assert.strictEqual(r.tributacaoIntegral, true);
  assert.deepStrictEqual(codigos('84713012'), ['000/000001']);
});

test('hortícolas com redução de 100% (Anexo XV)', () => {
  assert.ok(codigos('07020000').includes('200/200014'));
});

test('cerveja: Imposto Seletivo a partir de 2027', () => {
  assert.strictEqual(consulta.consultar('22030000', '2026-10-05').impostoSeletivoFuturo, true);
  assert.strictEqual(consulta.consultar('22030000', '2027-06-01').impostoSeletivo, true);
});

test('alertas de medicamento e combustível', () => {
  assert.strictEqual(consulta.consultar('30049099', '2026-10-05').alertas[0].titulo, 'Possível medicamento');
  assert.match(consulta.consultar('27101259', '2026-10-05').alertas[0].titulo, /combustível/);
});
