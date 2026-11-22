import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  blankCharacter, calculate, combatChance, hitPoints, magicProfile, mountSpeed,
  movement, naturalDeath, rolledRank, savingChance, studyAttempt,
} from '../docs/rules.mjs';
import {readCharacter} from '../docs/state.mjs';

function learn(state, id, language = '', months, random) {
  const attempt = studyAttempt(state, id, language, months, random);
  assert.ok(attempt.entry, attempt.issue);
  state.education.push(attempt.entry);
  return attempt.entry;
}

test('Хиты считают по рабочим характеристикам и округляют один раз вверх', () => {
  const state = blankCharacter();
  assert.equal(hitPoints({str: 96, sta: 31, dex: 65}), 15);
  assert.equal(calculate(state).hp, 9);
  learn(state, '5');
  assert.equal(calculate(state).hp, 11);
  assert.equal(hitPoints({str: 8, sta: 3, dex: 20}), 2);
});

test('ранг повышается с возрастом, образование ограничено возрастом', () => {
  assert.equal(rolledRank(75, 1), 3);
  assert.equal(rolledRank(99, 79), 10);
  assert.equal(rolledRank(100, 100), 18);
  const state = {...blankCharacter(), rank: 9, age: 32};
  const result = calculate(state);
  assert.equal(result.rank.name, 'Барон');
  assert.equal(result.status, 16);
  assert.equal(result.education.months, 104);
  assert.equal(result.funds, 45000);
  assert.equal(calculate({...state, rank: 12, age: 18}).education.months, 156);
  assert.equal(calculate({...state, rank: 15, age: 20}).rank.name, 'Принц / принцесса');
});

test('учебные навыки открывают следующие курсы и корректируют длительность', () => {
  const state = {...blankCharacter(), rank: 12, age: 18};
  assert.match(studyAttempt(state, '10', '').issue, /подготовка/i);
  learn(state, '22', 'Морской');
  learn(state, '25');
  const bow = learn(state, '10');
  assert.equal(bow.months, 18);
  learn(state, '3', 'Горный');
  const result = calculate(state);
  assert.ok(result.education.mastered.has('5'));
  assert.ok(result.education.mastered.has('18'));
  assert.ok(result.education.mastered.has('16'));
  assert.deepEqual(result.education.languages, ['Морской', 'Горный']);
  assert.equal(result.status, 31);
  assert.equal(result.education.spent, 102);
});

test('проверка курса учитывает только дополнительные месяцы, а ученичество нельзя сократить', () => {
  const state = {...blankCharacter(), rank: 12, courseRolls: true};
  assert.match(studyAttempt(state, '22', '', 35).issue, /нельзя сократить/);
  const first = learn(state, '12', '', 6, () => .99);
  assert.equal(first.passed, false);
  assert.equal(first.chance, 60);
  assert.match(studyAttempt(state, '12', '', 11).issue, /нормативный срок/);
  const second = learn(state, '12', '', 12, () => 0);
  assert.equal(second.passed, true);
  assert.equal(second.months, 6);
  assert.equal(calculate(state).education.spent, 12);
});

test('нагрузка, ловкость и вес животного используют границы таблицы', () => {
  assert.equal(movement(80, 80, 40).speed, 5.5);
  assert.equal(movement(80, 80, 40.1).speed, 5);
  assert.equal(movement(60, 88, 20).speed, 6);
  assert.equal(movement(20, 100, 61).speed, 0);
  assert.equal(movement(50, 50, 125).fatigue, 2);
  assert.equal(movement(50, 50, 150).fatigue, 3);
  assert.equal(mountSpeed('mule', 301, false, 3), 0);
  assert.equal(mountSpeed('horse', 250, true, 0), 3);
});

test('кошель, казённый набор и поклажа не удваивают вес и расходы', () => {
  const state = {...blankCharacter(), soldier: true, rank: 9};
  state.items = [
    {uid: 'h', id: 'horse', qty: 1, paid: true, position: 'stashed'},
    {uid: 's', id: 'saddle', qty: 1, paid: true, position: 'h'},
    {uid: 'w', id: 'water', qty: 2, paid: true, position: 'h'},
  ];
  state.rider = 'h';
  const result = calculate(state);
  assert.equal(result.spent, 6002);
  assert.equal(result.balance, 3998);
  assert.equal(result.carried, 25.05);
  assert.equal(result.mounts[0].burden, 201.05);
  assert.equal(result.mounts[0].speed, 3);
  assert.equal(result.mounts[0].saddle, true);
  state.rates.coinsPerLb = 10;
  assert.equal(calculate(state).cashWeight, 5.6);
  assert.deepEqual(calculate(readCharacter(JSON.parse(JSON.stringify(state)))).mounts, calculate(state).mounts.map((mount) => ({
    ...mount, equipped: false, price: undefined, weight: mount.weight, coin: undefined,
  })));
});

test('магия, рукопашный бой, спасбросок и естественная смерть', () => {
  const state = {...blankCharacter(), rank: 12};
  state.scores.int = 96;
  learn(state, 'magic', 'Тайный язык');
  assert.equal(calculate(state).magic.daily, 16);
  assert.equal(magicProfile(68, true, 2).daily, 10);
  assert.equal(magicProfile(43, true, 1).slots, 2);
  assert.equal(combatChance({dex: 89, hp: 9, exp: 12, enemyDex: 23, enemyHp: 30, enemyExp: 5, enemyBody: 0}).chance, 68);
  assert.equal(savingChance({cost: 5, warrior: true, dex: 50, intelligence: 50, level: 12, caster: 11}), 68);
  assert.deepEqual(naturalDeath(calculate(state), () => 0), {check: 1, save: 1, weeks: 1});
});
