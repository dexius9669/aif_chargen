import {
  attributes, ages, ranks, courses, gear, soldierKit, soldierSack, spellList, combatMatrix,
} from './data.mjs';
import {describeInheritance} from './inheritance.mjs';

export const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
export const die = (sides, random = Math.random) => Math.floor(random() * sides) + 1;
export const d100 = () => die(100);
export const rollTraining = () => die(10) + die(10);
export const newId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
const total = (values) => values.reduce((sum, value) => sum + value, 0);
const trimLanguage = (language) => language.trim().toLocaleLowerCase('ru');
const hasLanguage = (languages, language) => languages.some((item) => trimLanguage(item) === trimLanguage(language));

export function rolledRank(first, second) {
  if (first <= 20) return 0;
  if (first <= 40) return 1;
  if (first <= 60) return 2;
  if (first <= 75) return 3;
  if (first <= 85) return second <= 20 ? 4 : second <= 40 ? 5 : second <= 85 ? 6 : 7;
  if (first <= 99) {
    return second <= 40 ? 8 : second <= 69 ? 9 : second <= 79 ? 10
      : second <= 85 ? 11 : second <= 90 ? 12 : second <= 95 ? 13 : 14;
  }
  return second <= 49 ? 15 : second <= 89 ? 16 : second <= 99 ? 17 : 18;
}

export function rollOrigin(state) {
  state.scores = Object.fromEntries(Object.keys(attributes).map((key) => [key, d100()]));
  state.rolls = {age: d100(), rank: d100(), second: d100()};
  state.age = ages.find((row) => state.rolls.age <= row.roll).age;
  state.rank = rolledRank(state.rolls.rank, state.rolls.second);
  state.trainingBonus = rollTraining();
  state.mortality = null;
  return state;
}

export function blankCharacter() {
  return {
    version: 1, name: '', notes: '', native: 'Общий', scores: {str: 50, dex: 50, int: 50, cha: 50, sta: 50, hea: 50},
    rank: 2, age: 20, rolls: null, soldier: false, courseRolls: false, education: [],
    trainingBonus: 0, spells: [], experience: 1, items: [], kit: {}, stock: {}, fundsAdjustment: 0,
    rates: {spPerGp: 10, cpPerSp: 10, coinsPerLb: 0},
    characterWeight: 150, rider: '', mountTraining: {}, mortality: null, wounds: 0, inheritance: null, heirloomGear: {},
  };
}

function promotedRank(initialRank, level) {
  return ranks.filter((rank) => (rank.royal === initialRank.royal || rank.id === 18)
    && rank.level <= level).at(-1) ?? initialRank;
}

function professionRanks(state, mastered) {
  const age = ages.find((row) => row.age === state.age);
  const initialRank = ranks[state.rank];
  const startingStatus = initialRank.level + age.status;
  const skillBonus = ['21', '25', '26a', '26b'].filter((id) => mastered.has(id)).length;
  const status = Math.max(mastered.has('26d') ? 2 : 1, startingStatus + skillBonus);
  return {age, startingStatus, status, rank: promotedRank(initialRank, status)};
}

export function courseDuration(id, mastered) {
  if (id === '20c' && mastered.has('20m') || id === '20m' && mastered.has('20c')) return 45;
  if (mastered.has('25') && ['10', '14', '18'].includes(id)) return courses[id].months / 2;
  return courses[id].months;
}

export function learningChance(course, duration, actual, intelligence) {
  return clamp(100 - (duration / actual * course.difficulty - intelligence), 0, 100);
}

function recordMastery(entry, mastered, languages, literacy) {
  mastered.add(entry.id);
  if (entry.id === '22') {
    mastered.add('5');
    mastered.add('18');
  }
  if (entry.id === '19') mastered.add('5');
  if (entry.id === '25') mastered.add('16');
  if (entry.id === 'magic') {
    mastered.add('1');
    mastered.add('2');
  }
  if (['3', '22', 'magic'].includes(entry.id) && entry.language.trim() && !hasLanguage(languages, entry.language)) {
    languages.push(entry.language.trim());
  }
  if (entry.id === '4') literacy.push(entry.language.trim());
}

export function courseIssue(id, language, education, state) {
  const course = courses[id];
  if (id === 'magic' && state.scores.int < 43) return 'Для магии нужен Интеллект 43 или выше.';
  if (id !== '3' && id !== '4' && education.mastered.has(id)) return 'Навык уже освоен.';
  const missing = course.requires.filter((required) => !(id === '4' && required === '3') && !education.mastered.has(required));
  if (missing.length) return 'Сначала требуется: ' + missing.map((required) => courses[required].name).join(', ') + '.';
  if (id === '3' || id === '4') {
    if (!language.trim()) return 'Укажи язык.';
    if (id === '3' && hasLanguage([state.native, ...education.languages], language)) return 'Персонаж уже говорит на этом языке.';
    if (id === '4' && !hasLanguage(education.languages, language)) return 'Сначала освой разговорный вариант этого языка.';
    if (id === '4' && hasLanguage(education.literacy, language)) return 'Персонаж уже читает и пишет на этом языке.';
  }
  return '';
}

export function educationResult(state) {
  const {startingStatus} = professionRanks(state, new Set());
  const months = Math.min(Math.floor(startingStatus / 2), state.age - 6) * 13;
  const result = {months, spent: 0, income: 0, mastered: new Set(), languages: [], literacy: [], invalid: [], attempts: {}};
  for (const entry of state.education) {
    result.spent += entry.months;
    const issue = courseIssue(entry.id, entry.language, result, state);
    if (issue) {
      result.invalid.push({uid: entry.uid, issue});
      continue;
    }
    result.attempts[entry.id] = Math.max(result.attempts[entry.id] ?? 0, entry.actual);
    if (!entry.passed) continue;
    recordMastery(entry, result.mastered, result.languages, result.literacy);
    result.income += courses[entry.id].income;
  }
  return {...result, remaining: months - result.spent, languageError: Math.max(0, 15 - state.scores.int / 3)};
}

export function studyAttempt(state, id, language, actual, random = Math.random) {
  const education = educationResult(state);
  const course = courses[id];
  const issue = courseIssue(id, language, education, state);
  if (issue) return {issue};
  const duration = courseDuration(id, education.mastered);
  const usesCheck = state.courseRolls && id !== 'magic';
  const attempts = state.education.filter((entry) => entry.id === id && trimLanguage(entry.language) === trimLanguage(language));
  const prior = attempts.at(-1);
  const months = usesCheck ? actual : duration;
  if (attempts.length >= 3) return {issue: 'Три попытки уже израсходованы. Повторное обучение возможно в кампании.'};
  if (!Number.isFinite(months) || months <= (prior?.actual ?? 0)) return {issue: 'Укажи общий срок обучения дольше предыдущей попытки.'};
  if (usesCheck && course.apprenticeship && months < duration) return {issue: 'Срок ученичества нельзя сократить.'};
  if (usesCheck && prior && prior.actual < duration && (attempts.length !== 1 || months !== duration)) {
    return {issue: 'После досрочной попытки следующая проверка проводится ровно в нормативный срок.'};
  }
  if (usesCheck && !prior && months > duration) return {issue: 'Первая проверка проводится до нормативного срока или в сам нормативный срок.'};
  const cost = months - (prior?.actual ?? 0);
  if (cost > education.remaining) return {issue: 'Не хватает месяцев обучения.'};
  const chance = usesCheck ? learningChance(course, duration, months, state.scores.int) : 100;
  const roll = usesCheck ? die(100, random) : null;
  return {entry: {uid: newId(), id, language, months: cost, actual: months, roll, chance, passed: roll === null || roll <= chance}};
}

export function hitPoints({str, sta, dex}) {
  return Math.ceil((str * 6 + sta * 4 + dex * 3) / 60);
}

const humanLoads = [
  [20, [3,4,5,6,7,8]], [40, [2.5,3.5,4.5,5.5,6.5,7.5]], [60, [2,3,4,5,6,7]],
  [80, [1.5,2.5,3.5,4.5,5.5,6.5]], [100, [1,2,3,4,5,6]], [125, [0.5,1.5,2.5,3.5,4.5,5.5]],
  [150, [0,1,2,3,4,5]], [175, [0,0.5,1.5,2.5,3.5,4.5]], [200, [0,0,0.5,2,3,4]],
];
const mountLoads = [
  [25, 14, 12], [50, 12, 10], [100, 10, 8], [150, 8, 7], [200, 7, 6],
  [250, 6, 5], [300, 5, 4], [400, 4, 0], [500, 3, 0], [600, 2, 0],
];
export const dexMove = (dexterity) => (dexterity - clamp(dexterity, 25, 80)) / 8;
const roundedWeight = (weight) => Math.round(weight * 1000000) / 1000000;

export function movement(str, dex, burden) {
  const comfortable = str * 2;
  const maximum = comfortable * 1.5;
  const base = humanLoads.find(([weight]) => roundedWeight(burden) <= weight)?.[1][clamp(Math.ceil(str / 20) - 1, 0, 5)] ?? 0;
  const overload = burden > maximum;
  const dexterity = dexMove(dex);
  return {
    comfortable, maximum, overload, base, dexterity, speed: overload || base === 0 ? 0 : Math.max(0, base + dexterity),
    fatigue: burden >= maximum ? 3 : burden >= comfortable * 1.25 ? 2 : 1,
    immediateFatigue: burden >= comfortable + 1, dexCheck: Math.max(0, Math.floor(dex) - Math.floor(burden / 2)),
  };
}

export function mountSpeed(kind, burden, ridden, ridingLevel) {
  const speed = mountLoads.find(([max]) => roundedWeight(burden) <= max)?.[kind === 'horse' ? 1 : 2] ?? 0;
  return ridden && ridingLevel === 0 ? speed / 2 : speed;
}

export function magicProfile(intelligence, trained, level) {
  const perLevel = intelligence < 43 ? 0 : intelligence <= 54 ? 1 : intelligence <= 67 ? 3
    : intelligence <= 80 ? 5 : intelligence <= 95 ? 6 : intelligence <= 100 ? 8 : 10;
  const starting = intelligence >= 96 ? {slots: 5, cap: 4, level: 2}
    : intelligence >= 68 ? {slots: 3, cap: 3, level: 1} : {slots: 2, cap: 2, level: 1};
  const effectiveLevel = trained ? Math.max(starting.level, level) : level;
  const castLimit = effectiveLevel <= 8 ? 5 : effectiveLevel <= 14 ? 8 : effectiveLevel <= 21 ? 13 : 20;
  return {trained, perLevel, effectiveLevel, daily: trained ? perLevel * effectiveLevel : 0, castLimit, ...starting};
}

export function priceInCopper(price, denomination, rates) {
  return price * (denomination === 'gp' ? rates.spPerGp * rates.cpPerSp : denomination === 'sp' ? rates.cpPerSp : 1);
}

export function coins(value, rates) {
  const factor = rates.spPerGp * rates.cpPerSp;
  const absolute = Math.abs(Math.round(value * 10000) / 10000);
  const gp = Math.floor(absolute / factor);
  const sp = Math.floor((absolute - gp * factor) / rates.cpPerSp);
  const cp = Math.round((absolute - gp * factor - sp * rates.cpPerSp) * 10000) / 10000;
  return {gp, sp, cp};
}

function inventory(state, inheritance) {
  const kit = state.soldier ? soldierKit.map((id) => ({
    uid: 'kit-' + id, id, qty: 1, paid: false, position: state.kit[id]?.position ?? 'person',
    equipped: state.kit[id]?.equipped ?? ['helmet', 'lshield'].includes(id),
  })) : [];
  const heirlooms = inheritance.items.map((item) => {
    const placement = state.heirloomGear[item.id];
    return {uid: item.id, id: item.id, qty: 1, paid: false, custom: item, inherited: true,
      position: placement?.position ?? 'person', equipped: placement?.equipped ?? false,
      weight: placement?.weight};
  });
  return [...kit, ...heirlooms, ...state.items].map((row) => {
    const item = row.custom ?? (row.id === 'smallSack' ? soldierSack : gear[row.id]);
    const price = row.price ?? item.price;
    const unit = row.coin ?? item.coin;
    return {...row, item, cost: row.paid ? priceInCopper(price, unit, state.rates) * row.qty : 0,
      weight: (row.weight ?? item.weight) * row.qty};
  });
}

export function calculate(state) {
  const education = educationResult(state);
  const {mastered} = education;
  const social = professionRanks(state, mastered);
  const trained = mastered.has('5');
  const score = {...state.scores};
  for (const key of ['str', 'dex', 'sta']) {
    score[key] = trained ? score[key] + (mastered.has('6') ? state.trainingBonus : 0) : score[key] * 0.75;
  }
  const hp = hitPoints(score);
  const magic = magicProfile(score.int, mastered.has('magic'), state.experience);
  const knownSpells = spellList.filter((spell) => magic.trained && spell.points <= magic.cap && state.spells.includes(spell.id));
  const inheritance = describeInheritance(state.inheritance);
  const items = inventory(state, inheritance);
  const heirloomDefense = Math.max(0, ...items.filter((row) => row.position === 'person' && row.equipped)
    .map((row) => row.item.defenseBonus ?? 0));
  const income = state.soldier ? 0 : education.income;
  const startingGold = (social.rank.level * 10 + income) * social.age.wealth;
  const funds = priceInCopper(startingGold + inheritance.gold + state.fundsAdjustment, 'gp', state.rates);
  const spent = total(items.map((row) => row.cost));
  const balance = funds - spent;
  const purse = coins(Math.max(0, balance), state.rates);
  const cashWeight = state.rates.coinsPerLb > 0 ? (purse.gp + purse.sp + purse.cp) / state.rates.coinsPerLb : 0;
  const carried = roundedWeight(total(items.filter((row) => row.position === 'person').map((row) => row.weight)) + cashWeight);
  const pace = movement(score.str, score.dex, carried);
  const ridingLevel = mastered.has('9') ? 3 : mastered.has('8') ? 2 : mastered.has('7') ? 1 : 0;
  const mounts = items.filter((row) => row.item.category === 'mount').map((row) => {
    const ridden = row.uid === state.rider;
    const level = Math.min(ridingLevel, state.mountTraining[row.uid] ?? 0);
    const load = total(items.filter((other) => other.position === row.uid).map((other) => other.weight));
    const burden = roundedWeight(load + (ridden ? state.characterWeight + carried : 0));
    const saddle = items.some((other) => other.id === 'saddle' && other.position === row.uid);
    return {...row, level, load, burden, ridden, saddle, speed: mountSpeed(row.id, burden, ridden, level)};
  });
  return {
    ...social, education, score, hp, remainingHp: Math.max(0, hp - state.wounds), magic, knownSpells,
    trained, items, income, funds, inheritance, heirloomDefense, spent, balance, cashWeight, carried, pace, mounts, ridingLevel,
    fatigueFree: pace.immediateFatigue ? 0 : Math.floor(score.sta + 5),
    fatigueTurns: Math.floor(score.sta / pace.fatigue),
    meleeTurns: Math.floor(score.sta / (5 * pace.fatigue)),
    recoveryWeeks: Math.floor(score.hea / 10),
    deathChance: state.age <= 25 ? 1 : 2,
  };
}

export function naturalDeath(result, random = Math.random) {
  const check = die(100, random);
  const save = check <= result.deathChance ? die(100, random) : null;
  const weeks = save !== null && save <= result.score.hea ? die(6, random) : 0;
  return {check, save, weeks};
}

export function weaponTraining(row, education) {
  if (!row) return 1;
  const skill = row.item.skill;
  if (!skill || education.mastered.has(skill)) return 1;
  return education.attempts?.[skill] >= courses[skill].months / 2 ? 2 / 3 : 1 / 3;
}

export function combatChance({dex, hp, exp, enemyDex, enemyHp, enemyExp, enemyBody, training = 1, stance = 1, modifier = 0}) {
  const base = Math.floor(combatMatrix[0][enemyBody] * training * stance);
  const dexDelta = dex - enemyDex;
  const dexBonus = Math.sign(dexDelta) * Math.min(10, Math.floor(Math.abs(dexDelta) / 4));
  const sizeDelta = enemyHp - hp;
  const sizeBonus = Math.sign(sizeDelta) * Math.min(sizeDelta >= 0 ? 15 : 10, Math.round(Math.abs(sizeDelta) / 2));
  const experience = exp - enemyExp;
  return {base, dexBonus, sizeBonus, experience, chance: clamp(Math.floor(base + dexBonus + sizeBonus + experience + modifier), 2, 98)};
}

export function savingChance({cost, warrior, dex, intelligence, level, caster}) {
  const base = {1: 80, 2: 77, 3: 74, 4: 70, 5: 66, 6: 62, 7: 58, 8: 54, 9: 50, 10: 45, 13: 40, 15: 30}[cost];
  return clamp(base + (warrior ? Math.floor(level / 4) * 2 : 0) + (dex >= 95 ? 5 : 0)
    + (intelligence >= 91 ? 5 : 0) - 2 * Math.max(0, caster - 9), 10, 99);
}
