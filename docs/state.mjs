import {attributes, courses, gear, soldierKit, spellList} from './data.mjs';
import {blankCharacter, clamp, newId, rollOrigin} from './rules.mjs';
import {heirloomIds} from './inheritance.mjs';

const key = 'aif-character-v1';
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const entries = (value) => Array.isArray(value) ? value.slice(0, 1000).map(record) : [];
const str = (value, max = 100) => typeof value === 'string' ? value.slice(0, max) : '';
const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
const integer = (value, fallback, min, max) => Math.floor(number(value, fallback, min, max));
const coin = (value) => ['gp', 'sp', 'cp'].includes(value) ? value : 'gp';
const has = (dictionary, id) => Object.hasOwn(dictionary, id);

function readInheritance(value) {
  const input = record(value);
  if (!Number.isInteger(input.check)) return null;
  const age = integer(input.age, 17, 17, 35);
  const check = integer(input.check, 100, 1, 100);
  if (check > age) return {age, check};
  const type = integer(input.type, null, 2, 20);
  if (type === null) return null;
  const percentile = (value) => integer(value, 100, 1, 100);
  const rolls = {age, check, type};
  if (type <= 6 || type === 20) {
    const sword = record(input.sword);
    rolls.sword = {attribute: type === 20 ? 16 : integer(sword.attribute, 0, 0, 20),
      limitation: percentile(sword.limitation), bonus: percentile(sword.bonus),
      intelligence: percentile(sword.intelligence), alignment: percentile(sword.alignment), material: percentile(sword.material)};
  }
  if (type >= 4 && type <= 6) {
    const armor = record(input.armor);
    rolls.armor = {type: percentile(armor.type), enchantment: percentile(armor.enchantment)};
  }
  if (type >= 7 && type <= 15) {
    rolls.goldDice = integer(input.goldDice, 2, 2, 20);
    rolls.amuletCheck = percentile(input.amuletCheck);
  } else if (type >= 16 && type <= 19) rolls.goldDice = integer(input.goldDice, 1, 1, 10);
  if (type >= 16 || rolls.amuletCheck <= 20) rolls.amulet = percentile(input.amulet);
  if (type >= 16) rolls.talisman = percentile(input.talisman);
  return rolls;
}

export function readCharacter(value) {
  const data = record(value);
  if (data.version !== 1 || !data.scores || typeof data.scores !== 'object' || Array.isArray(data.scores)) {
    throw new Error('Выбери JSON-файл персонажа, сохранённый этой версией генератора.');
  }
  const state = blankCharacter();
  const rates = record(data.rates);
  const mortality = record(data.mortality);
  const rolls = record(data.rolls);
  for (const name of ['name', 'native', 'notes']) state[name] = str(data[name], name === 'notes' ? 12000 : 100);
  for (const name of Object.keys(attributes)) state.scores[name] = integer(data.scores[name], 50, 1, 120);
  state.rank = integer(data.rank, state.rank, 0, 18);
  state.age = integer(data.age, state.age, 17, 35);
  state.trainingBonus = integer(data.trainingBonus, 0, 0, 20);
  state.experience = integer(data.experience, 1, 1, 1000);
  state.characterWeight = number(data.characterWeight, 150, 1, 2000);
  state.fundsAdjustment = number(data.fundsAdjustment, 0, -1000000, 1000000);
  state.inheritance = readInheritance(data.inheritance);
  state.wounds = integer(data.wounds, 0, 0, 1000);
  state.soldier = data.soldier === true;
  state.courseRolls = data.courseRolls === true;
  state.rates.spPerGp = integer(rates.spPerGp, 10, 1, 1000);
  state.rates.cpPerSp = integer(rates.cpPerSp, 10, 1, 1000);
  state.rates.coinsPerLb = number(rates.coinsPerLb, 0, 0, 10000);
  if (Number.isInteger(rolls.age) && Number.isInteger(rolls.rank) && Number.isInteger(rolls.second)) {
    state.rolls = Object.fromEntries(['age', 'rank', 'second'].map((field) => [field, clamp(rolls[field], field === 'second' ? 1 : 0, 100)]));
  }
  if (Number.isInteger(mortality.check)) {
    state.mortality = {check: integer(mortality.check, 100, 1, 100),
      save: integer(mortality.save, null, 1, 100) || null, weeks: integer(mortality.weeks, 0, 0, 6)};
  }
  state.spells = spellList.filter((spell) => Array.isArray(data.spells) && data.spells.includes(spell.id)).map((spell) => spell.id);
  state.education = entries(data.education).filter((entry) => has(courses, entry.id)).map((entry) => ({
    uid: newId(), id: entry.id, language: str(entry.language), months: number(entry.months, courses[entry.id].months, 0.25, 377),
    actual: number(entry.actual, courses[entry.id].months, 0.25, 377), chance: number(entry.chance, 100, 0, 100),
    roll: Number.isInteger(entry.roll) ? clamp(entry.roll, 1, 100) : null, passed: entry.passed === true,
  }));
  const seen = new Set([...heirloomIds, ...soldierKit.map((id) => 'kit-' + id)]);
  for (const line of entries(data.items)) {
    const catalog = has(gear, line.id) ? gear[line.id] : null;
    const custom = record(line.custom);
    if (!catalog && !str(custom.name).trim()) continue;
    const uid = str(line.uid) || newId();
    if (seen.has(uid) || uid.startsWith('kit-') || ['person', 'stashed', '__proto__', 'constructor', 'prototype'].includes(uid)) continue;
    seen.add(uid);
    const row = {
      uid, id: catalog?.id ?? 'custom', qty: catalog?.category === 'mount' ? 1 : integer(line.qty, 1, 1, 9999),
      paid: line.paid === true, position: str(line.position), equipped: line.equipped === true,
      price: number(line.price, undefined, 0, 1000000), weight: number(line.weight, undefined, 0, 1000000),
      coin: line.coin === undefined ? undefined : coin(line.coin),
    };
    if (!catalog) row.custom = {id: 'custom', name: str(custom.name), price: number(custom.price, 0, 0, 1000000),
      weight: number(custom.weight, 0, 0, 1000000), category: 'supply', coin: coin(custom.coin)};
    state.items.push(row);
  }
  const mountIds = new Set(state.items.filter((row) => gear[row.id]?.category === 'mount').map((row) => row.uid));
  const position = (pos) => pos === 'stashed' || mountIds.has(pos) ? pos : 'person';
  for (const row of state.items) row.position = gear[row.id]?.category === 'mount' ? 'stashed' : position(row.position);
  for (const id of soldierKit) {
    const row = record(record(data.kit)[id]);
    if (Object.keys(row).length) state.kit[id] = {position: position(row.position), equipped: row.equipped === true};
  }
  for (const id of heirloomIds) {
    const row = record(record(data.heirloomGear)[id]);
    if (Object.keys(row).length) {
      state.heirloomGear[id] = {position: position(row.position), equipped: row.equipped === true,
        weight: number(row.weight, undefined, 0, 1000000)};
    }
  }
  for (const id of mountIds) state.mountTraining[id] = integer(record(data.mountTraining)[id], 0, 0, 3);
  if (mountIds.has(data.rider)) state.rider = data.rider;
  for (const id of Object.keys(gear)) {
    const value = record(data.stock)[id];
    if (Number.isInteger(value)) state.stock[id] = clamp(value, 1, 100);
  }
  return state;
}

export function restore() {
  try {
    const file = localStorage.getItem(key);
    if (file) return readCharacter(JSON.parse(file));
  } catch {
    return rollOrigin(blankCharacter());
  }
  return rollOrigin(blankCharacter());
}

export function persist(state) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
