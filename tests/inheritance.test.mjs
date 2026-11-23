import {test} from 'node:test';
import assert from 'node:assert/strict';
import {describeInheritance, rollInheritance} from '../docs/inheritance.mjs';
import {blankCharacter, calculate} from '../docs/rules.mjs';
import {readCharacter} from '../docs/state.mjs';

function roll(age, values) {
  let index = 0;
  const result = rollInheritance(age, (sides) => {
    const value = values[index++];
    assert.ok(Number.isInteger(value) && value >= 1 && value <= sides, `Unexpected к${sides} roll ${value}`);
    return value;
  });
  assert.equal(index, values.length);
  return result;
}

test('проверка на наследство проходит на результате, равном возрасту', () => {
  const failed = roll(25, [26]);
  assert.deepEqual(failed, {age: 25, check: 26});
  assert.deepEqual(describeInheritance(failed), {gold: 0, items: []});

  const sword = describeInheritance(roll(25, [25, 1, 2, 1, 10, 100, 95, 98, 40])).items[0];
  assert.equal(sword.id, 'heir-sword');
  assert.equal(sword.weight, 3.5);
  assert.equal(sword.combatBonus, 15);
  assert.match(sword.notes[0], /Интеллект меча 4 · эго 65 · Хаос/);
});

test('4–6 даёт меч, доспех, и ровно 50 з.м. после возрастного множителя', () => {
  const state = {...blankCharacter(), age: 32, rank: 9};
  state.inheritance = roll(32, [1, 1, 3, 1, 5, 20, 1, 1, 41, 96, 88]);
  const result = calculate(state);
  assert.equal(result.inheritance.gold, 50);
  assert.equal(result.funds, 50000);
  assert.equal(result.spent, 0);
  assert.equal(result.carried, 107);
  state.heirloomGear['heir-armor'] = {position: 'person', equipped: true, weight: 85};
  assert.equal(calculate(state).heirloomDefense, 15);
  const saved = readCharacter(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(saved.inheritance, state.inheritance);
  assert.equal(calculate(saved).carried, 92);
  assert.equal(calculate(saved).funds, result.funds);
  saved.heirloomGear['heir-armor'].position = 'stashed';
  assert.equal(calculate(saved).heirloomDefense, 0);
  assert.equal(calculate(saved).carried, 7);
});

test('7–15 даёт 20–200 з.м. и амулет только при проверке до 20%', () => {
  const amulet = describeInheritance(roll(20, [20, 2, 5, 10, 10, 20, 100]));
  assert.equal(amulet.gold, 200);
  assert.equal(amulet.items[0].name, 'Амулет — Топаз');
  const noAmulet = describeInheritance(roll(20, [20, 5, 10, 1, 1, 21]));
  assert.deepEqual(noAmulet, {gold: 20, items: []});
});

test('16–19 даёт 10–100 з.м., амулет и талисман', () => {
  const result = describeInheritance(roll(20, [20, 9, 10, 10, 98, 31]));
  assert.equal(result.gold, 100);
  assert.deepEqual(result.items.map(({name}) => name), ['Амулет — Воздух', 'Талисман — Луна']);
  assert.match(result.items[1].notes[1], /Закон/);
});

test('20 всегда даёт меч заклинаний для мага и два оберега', () => {
  const result = describeInheritance(roll(20, [20, 10, 10, 25, 20, 80, 1, 99, 15, 100]));
  assert.equal(result.gold, 0);
  assert.deepEqual(result.items.map(({name}) => name), ['Меч заклинаний', 'Амулет — Крест', 'Талисман — Змеевик']);
  assert.equal(result.items[0].magesOnly, true);
  assert.match(result.items[0].notes.join(' '), /на 50% больше очков магии/);
});

test('старые листы можно импортировать и проверить без пересоздания персонажа', () => {
  const {inheritance, heirloomGear, ...old} = blankCharacter();
  const state = readCharacter(old);
  assert.equal(state.inheritance, null);
  assert.deepEqual(state.heirloomGear, {});
  assert.equal(calculate(state).funds, 3000);
});
