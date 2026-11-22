import {
  ages, armorRules, attributes, bodyTypes, categoryNames, courseList, courses, gear, ranks, spellList,
} from './data.mjs';
import {
  blankCharacter, calculate, clamp, coins, combatChance, courseDuration, courseIssue, d100, learningChance,
  naturalDeath, newId, priceInCopper, rollOrigin, rollTraining, savingChance, studyAttempt, weaponTraining,
} from './rules.mjs';
import {persist, readCharacter, restore} from './state.mjs';

const $ = (selector) => document.querySelector(selector);
const format = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 4});
const fmt = (number) => format.format(number);
const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const selected = (a, b) => String(a) === String(b) ? ' selected' : '';
const checked = (value) => value ? ' checked' : '';
const option = (value, label, current) => `<option value="${escape(value)}"${selected(value, current)}>${escape(label)}</option>`;
const units = {gp: 'з.м.', sp: 'с.м.', cp: 'м.м.'};
const weight = (value) => fmt(value) + ' фн.';
const inch = (value) => fmt(value) + '″';
const plus = (value) => (value > 0 ? '+' : '') + fmt(value);
const directPrice = (value, unit) => value ? fmt(value) + ' ' + units[unit] : 'Бесплатно';
const money = (value) => {
  const parts = coins(value, state.rates);
  return (value < 0 ? '−' : '') + (Object.entries(parts).filter(([, amount]) => amount)
    .map(([unit, amount]) => `${fmt(amount)} ${units[unit]}`).join(' ') || '0 з.м.');
};
const textField = (field, value, placeholder = '') => `<input type="text" data-field="${field}" value="${escape(value)}" placeholder="${escape(placeholder)}" maxlength="100">`;
const numField = (field, value, min, max, step = 1) =>
  `<input type="number" data-field="${field}" value="${escape(value)}" min="${min}" max="${max}" step="${step}" inputmode="${step === 1 ? 'numeric' : 'decimal'}">`;
const stat = (label, value, detail = '') => `<div class="stat"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ''}</div>`;
const button = (action, label, name = '', extra = '') => `<button type="button" data-action="${action}"${name ? ` data-id="${escape(name)}"` : ''} ${extra}>${label}</button>`;
const section = (title, hint, content) => `<section class="card"><div class="card-head"><h2>${title}</h2>${hint ? `<p>${hint}</p>` : ''}</div>${content}</section>`;
const message = (text) => { $('#status').textContent = text; };

const tabs = new Set(['origin', 'education', 'equipment', 'magic', 'sheet']);
const currentTab = () => tabs.has(location.hash.slice(1)) ? location.hash.slice(1) : 'origin';
let state = restore();
let result = calculate(state);
let numericBlurPending = false;
let deferredRender = false;
let rendering = false;
const ui = {
  course: '5', language: '', studyMonths: null, search: '', category: '', mode: 'buy', horse: '',
  enemyBody: 0, enemyDex: 50, enemyHp: 10, enemyExp: 2, enemyMetric: 'dice', weapon: '', modifier: 0,
  saveCost: 4, caster: 1,
};

function mortalityText() {
  const roll = state.mortality;
  if (!roll) return `Шанс события в возрасте ${state.age} лет — ${result.deathChance}%.`;
  if (roll.save === null) return `Бросок ${roll.check} · возрастных осложнений нет.`;
  if (roll.weeks) return `Бросок ${roll.check}, проверка Здоровья ${roll.save} · болезнь на ${roll.weeks} нед.`;
  return `Бросок ${roll.check}, проверка Здоровья ${roll.save} · естественная смерть.`;
}

function renderSummary() {
  $('#summary').innerHTML = [
    stat('Хиты', fmt(result.remainingHp) + ' / ' + fmt(result.hp), result.magic.trained ? 'Маг · человек' : 'Воин · человек'),
    stat('Социальный статус', fmt(result.status), escape(result.rank.name)),
    stat('Месяцы обучения', fmt(result.education.remaining), 'из ' + fmt(result.education.months)),
    stat('Остаток средств', money(result.balance)),
    stat('Вес на себе', weight(result.carried), 'предел ' + weight(result.pace.maximum)),
    stat('Скорость пешком', inch(result.pace.speed), 'Таблица E'),
  ].join('');
}

function settings() {
  return `<div class="setting-fields">
    <label>Серебряных за 1 золотую ${numField('spPerGp', state.rates.spPerGp, 1, 1000)}</label>
    <label>Медных за 1 серебряную ${numField('cpPerSp', state.rates.cpPerSp, 1, 1000)}</label>
    <label>Монет в фунте ${numField('coinsPerLb', state.rates.coinsPerLb, 0, 10000)}</label>
    <p class="micro">Курс 1:10:100 редактируется. При 0 вес кошеля отключён. Иначе остаток считается в монетах старших номиналов и переносится на себе.</p>
    <label>Поправка к стартовой сумме, з.м. ${numField('fundsAdjustment', state.fundsAdjustment, -1000000, 1000000, 0.01)}</label>
    <p class="micro">Для займа, денежного дара или решения Рефери.</p>
  </div>`;
}

function origin() {
  const scores = Object.entries(attributes).map(([id, label]) => `
    <div class="ability">
      <label for="score-${id}">${label}</label>
      <div class="ability-input"><input id="score-${id}" aria-label="${label}" data-field="score-${id}" type="number" min="1" max="120" value="${state.scores[id]}">
      ${button('roll-score', 'к100', id, `class="dice" aria-label="Бросить к100: ${label}"`)}</div>
      <small>Рабочее значение ${fmt(result.score[id])}</small>
    </div>`).join('');
  const ageRoll = state.rolls?.age;
  const rankRoll = state.rolls?.rank;
  return section('Происхождение', 'Характеристики, возраст и исходный ранг по книге I, стр. 2–7.', `
    <div class="grid two fields">
      <label>Имя ${textField('name', state.name, 'Имя персонажа')}</label>
      <label>Родной язык ${textField('native', state.native)}</label>
      <div><label>Возраст <select data-field="age">${ages.map((row) => option(row.age,
        row.age + ' лет' + (row.status ? ' · статус +' + row.status : '') + (row.wealth > 1 ? ' · средства ×' + row.wealth : ''), state.age)).join('')}</select></label>
        ${button('roll-age', 'Бросить возраст', '', 'class="small"')} ${ageRoll ? `<span class="micro">к100: ${ageRoll}</span>` : ''}</div>
      <div><label>Исходный ранг <select data-field="rank">${ranks.map((row) => option(row.id, row.level + ' · ' + row.name, state.rank)).join('')}</select></label>
        ${button('roll-rank', 'Бросить ранг', '', 'class="small"')} ${rankRoll ? `<span class="micro">к100: ${rankRoll}${rankRoll > 75 ? ' / ' + state.rolls.second : ''}</span>` : ''}</div>
      <label>Вес персонажа, фн. ${numField('characterWeight', state.characterWeight, 1, 2000, 0.1)}</label>
      <label>Табличный доход с титула <output>${ranks[result.rank.id].income === null ? 'Не указан' : fmt(ranks[result.rank.id].income) + ' з.м. / год'}</output></label>
    </div>
    <label class="check"><input type="checkbox" data-field="soldier"${checked(state.soldier)}> Служит солдатом · получает казённое снаряжение</label>
    <div class="card-subhead"><h3>Характеристики</h3>${button('roll-scores', 'Бросить все', '', 'class="outline"')}</div>
    <div class="ability-grid">${scores}</div>
    <p class="hint">${result.trained ? 'Физическая подготовка даёт полный доступ к характеристикам.' : 'До физической подготовки рабочие Сила, Ловкость и Выносливость составляют 75% от исходных.'}</p>
    ${result.education.mastered.has('6') ? `<div class="inline-fields"><label>Прибавка за подготовку II ${numField('trainingBonus', state.trainingBonus, 2, 20)}</label>${button('training-roll', 'Бросить 2к10', '', 'class="outline"')}</div>` : ''}
    <details class="rule-box"><summary>Естественная смерть и восстановление</summary>
      <p>${mortalityText()}</p>${button('mortality', 'Бросок за год', '', state.mortality ? 'disabled' : '')}${state.mortality ? button('clear-mortality', 'Сбросить бросок') : ''}
      <p class="micro">Полный отдых: ${fmt(result.score.hea)}% в неделю вылечить 1 Хит. Успешная проверка Здоровья при болезни или отравлении даёт ${fmt(result.recoveryWeeks)} нед. восстановления.</p>
    </details>`);
}

function coursePreview() {
  const course = courses[ui.course];
  const duration = courseDuration(course.id, result.education.mastered);
  const actual = ui.studyMonths ?? duration;
  const skillAttempts = state.education.filter((entry) => entry.id === ui.course
    && entry.language.trim().toLowerCase() === ui.language.trim().toLowerCase());
  const cost = Math.max(0, actual - (skillAttempts.at(-1)?.actual ?? 0));
  const issue = courseIssue(course.id, ui.language, result.education, state);
  const info = [course.apprenticeship ? 'Ученичество' : 'Курс', `норма ${fmt(duration)} мес.`];
  if (course.difficulty !== null) info.push(`сложность ${course.difficulty}`);
  if (course.income) info.push(`+${course.income} з.м. / год`);
  if (state.courseRolls && course.id !== 'magic' && actual > 0) {
    info.push(`проверка ${fmt(learningChance(course, duration, actual, result.score.int))}% · затраты ${fmt(cost)} мес.`);
  }
  return info.join(' · ') + (course.note ? '<br>' + escape(course.note) : '') + (issue ? '<br><strong>' + escape(issue) + '</strong>' : '');
}

function education() {
  const edu = result.education;
  const course = courses[ui.course];
  const language = ['3', '4', '22', 'magic'].includes(ui.course);
  const rows = state.education.map((entry) => {
    const issue = edu.invalid.find((invalid) => invalid.uid === entry.uid)?.issue;
    return `<div class="line"><div><strong>${courses[entry.id].name}${entry.language ? ' · ' + escape(entry.language) : ''}</strong>
      <small>${fmt(entry.months)} мес. · ${issue ? escape(issue) : entry.passed ? 'Освоено' : 'Проверка не пройдена'}${entry.roll !== null ? ` · к100: ${entry.roll} при ${fmt(entry.chance)}%` : ''}</small></div>
      ${button('remove-course', 'Убрать', entry.uid, 'class="small"')}</div>`;
  }).join('');
  return section('Обучение', 'Таблица B. Один год за каждые два пункта стартового статуса, максимум возраст минус шесть лет. В году 13 месяцев.', `
    <div class="strip"><strong>${fmt(edu.spent)} / ${fmt(edu.months)} мес.</strong><span class="${edu.remaining < 0 ? 'warn' : ''}">Осталось ${fmt(edu.remaining)} мес.</span><span>Доход от курсов ${fmt(edu.income)} з.м. / год</span></div>
    ${edu.remaining < 0 ? '<p class="warn">План выходит за пределы стартового образования. Сократи список курсов.</p>' : ''}
    <label class="check"><input type="checkbox" data-field="courseRolls"${checked(state.courseRolls)}> Проверять освоение курса броском к100</label>
    <div class="editor">
      <label>Курс <select data-ui="course">${courseList.map((entry) => option(entry.id, entry.name, ui.course)).join('')}</select></label>
      ${language ? `<label>${ui.course === 'magic' ? 'Тайный язык' : 'Язык'} <input data-ui="language" value="${escape(ui.language)}" maxlength="100" placeholder="Название языка"></label>` : ''}
      ${state.courseRolls && ui.course !== 'magic' ? `<label>Всего месяцев к попытке
        <input type="number" min="0.25" max="377" step="0.25" data-ui="studyMonths" value="${ui.studyMonths ?? courseDuration(ui.course, edu.mastered)}"></label>` : ''}
      <div class="editor-end">${button('add-course', state.courseRolls && ui.course !== 'magic' ? 'Проверить освоение' : 'Добавить курс', '', 'class="primary"')}</div>
    </div>
    <p id="course-preview" class="hint">${coursePreview()}</p>
    <div class="card-subhead"><h3>История обучения</h3></div>
    ${rows || '<p class="empty">Курсы ещё не выбраны.</p>'}
    <p class="hint">Родной язык: ${escape(state.native || '—')}. Другие языки: ${edu.languages.map(escape).join(', ') || '—'}. Грамота: ${[...(edu.mastered.has('1') && state.native ? [state.native] : []), ...edu.literacy].map(escape).join(', ') || '—'}.
      Ошибка в иностранном языке: ${fmt(edu.languageError)}%.</p>`);
}

const mountLabel = (mount) => {
  const same = result.mounts.filter((row) => row.id === mount.id);
  return mount.item.name + (same.length > 1 ? ' ' + (same.indexOf(mount) + 1) : '');
};
function gearRow(row) {
  const item = row.item;
  const isMount = item.category === 'mount';
  const isService = item.category === 'service';
  const fixed = row.uid.startsWith('kit-');
  const defense = armorRules[row.id];
  const tr = item.skill ? weaponTraining(row, result.education) : 1;
  const details = [fixed ? 'Казённое' : row.paid ? money(row.cost) : 'Получено бесплатно', weight(row.weight)];
  if (tr !== 1) details.push(tr === 1 / 3 ? 'Подготовка ⅓' : 'Подготовка ⅔');
  if (row.equipped && row.position === 'person' && defense) details.push(defense);
  return `<div class="inventory-row">
    <div><strong>${escape(item.name)}</strong><small>${details.join(' · ')}</small></div>
    ${fixed || isMount ? '<span class="qty-static">×1</span>' : `<label class="qty"><span class="sr-only">Количество ${escape(item.name)}</span><input type="number" min="1" max="9999" data-qty="${escape(row.uid)}" value="${row.qty}"></label>`}
    ${isMount || isService ? '' : `<label class="placement"><span class="sr-only">Где лежит ${escape(item.name)}</span><select data-position="${escape(row.uid)}">
      ${option('person', 'На себе', row.position)}${option('stashed', 'Оставлено', row.position)}
      ${result.mounts.map((mount) => option(mount.uid, mountLabel(mount), row.position)).join('')}</select></label>`}
    ${['armor', 'head', 'shield'].includes(item.category) ? `<label class="check equip"><input type="checkbox" data-equip="${escape(row.uid)}"${checked(row.equipped)}${row.position === 'person' ? '' : ' disabled'}> Надето</label>` : ''}
    ${fixed ? '' : button('remove-item', 'Убрать', row.uid, 'class="small"')}`
    + '</div>';
}

function catalogList() {
  const search = ui.search.trim().toLocaleLowerCase('ru');
  const filtered = Object.values(gear).filter((item) => (!ui.category || item.category === ui.category)
    && (!search || item.name.toLocaleLowerCase('ru').includes(search)));
  return filtered.map((item) => {
    const stock = state.stock[item.id];
    const available = item.stock === 100 || (stock !== undefined && stock <= item.stock);
    const canCraft = result.education.mastered.has('21') && item.weeks;
    const mode = ui.mode;
    const cost = item.price * (mode === 'order' && item.weeks ? 1.5 : mode === 'craft' ? 0.5 : mode === 'owned' ? 0 : 1);
    const disabled = (mode === 'stock' && !available) || (mode === 'craft' && !canCraft);
    const terms = [directPrice(cost, item.coin), item.weight ? weight(item.weight) : '', item.weeks ? `${item.weeks} нед. · ${item.supplier}` : '']
      .filter(Boolean).join(' · ');
    return `<div class="line catalog-line"><div><strong>${item.name}</strong><small>${terms}${item.note ? '<br>' + escape(item.note) : ''}</small></div>
      <div class="line-buttons">${item.stock < 100 ? `<small>${stock === undefined ? 'В наличии ' + item.stock + '%' : 'к100: ' + stock + (available ? ' · есть' : ' · нет')}</small>
      ${mode === 'stock' && stock === undefined ? button('stock-roll', 'Проверить', item.id, 'class="small"') : ''}` : ''}
      ${button('add-item', mode === 'buy' || mode === 'stock' ? 'Купить' : mode === 'order' ? 'Заказать' : mode === 'craft' ? 'Изготовить' : 'Внести',
        item.id, `class="small outline" aria-label="${mode === 'stock' || mode === 'buy' ? 'Купить' : 'Добавить'}: ${item.name}" ${disabled ? 'disabled' : ''}`)}</div></div>`;
  }).join('') || '<p class="empty">Подходящих предметов нет.</p>';
}

function supplySummary() {
  const packed = result.items.filter((row) => row.position !== 'stashed');
  const count = (ids) => packed.filter((row) => ids.includes(row.id)).reduce((sum, row) => sum + row.qty, 0);
  const food = count(['beef', 'fish', 'pork', 'tinned', 'waybread']);
  const water = count(['water']);
  const horses = result.mounts.filter((row) => row.id === 'horse').length;
  const mules = result.mounts.length - horses;
  const waterPerDay = 1 + horses * 5 + mules * 3;
  return `В походе: еда на ${food} дн. · вода на ${fmt(water / waterPerDay)} дн. (${waterPerDay} рац. в день)`
    + (horses ? ` · корм для лошадей на ${fmt(count(['feed']) / horses)} дн.` : '.');
}

function equipment() {
  const loadWarnings = [
    result.pace.overload ? 'Превышен предельный вес на себе.' : '',
    result.balance < 0 ? 'Расходы превышают доступные средства.' : '',
    ...result.mounts.filter((row) => row.ridden && !row.saddle).map((row) => 'В весе ' + mountLabel(row) + ' нет седла. При необходимости добавь седло из каталога.'),
  ].filter(Boolean);
  const mounts = result.mounts.map((row) => `<div class="line"><div><strong>${mountLabel(row)}</strong>
    <small>${weight(row.burden)} · ${inch(row.speed)}${row.ridden ? ' · под всадником' : ''} · совместная подготовка ${row.level}</small></div>
    <label>Обучение животного <select data-mount-training="${escape(row.uid)}">${[0,1,2,3].map((level) => option(level, level, state.mountTraining[row.uid] ?? 0)).join('')}</select></label></div>`).join('');
  return section('Снаряжение', 'Цены и вес из таблиц C и D. Можно распределить груз между персонажем, животными и поклажей вне похода.', `
    <div class="strip"><span>Старт ${money(result.funds)}</span><span>Потрачено ${money(result.spent)}</span><strong>Остаток ${money(result.balance)}</strong></div>
    <div class="strip secondary"><span>Без усталости до ${weight(result.pace.comfortable)}</span><span>Предел ${weight(result.pace.maximum)}</span>
      <span>Проверка Ловкости с грузом ${result.pace.dexCheck}%</span>${result.cashWeight ? '<span>Кошель ' + weight(result.cashWeight) + '</span>' : ''}</div>
    <p class="hint">${supplySummary()}</p>
    ${loadWarnings.map((warning) => '<p class="warn">' + escape(warning) + '</p>').join('')}
    <div class="card-subhead"><h3>Инвентарь</h3></div>
    ${result.items.map(gearRow).join('') || '<p class="empty">Добавь снаряжение из каталога ниже.</p>'}
    ${mounts ? `<div class="card-subhead"><h3>Животные</h3></div><label class="rider">Верхом на <select data-field="rider">${option('', 'Идёт пешком', state.rider)}${result.mounts.map((mount) => option(mount.uid, mountLabel(mount), state.rider)).join('')}</select></label>${mounts}` : ''}
    <div class="card-subhead"><h3>Каталог</h3>${Object.keys(state.stock).length ? button('market-month', 'Новый месяц рынка', '', 'class="small"') : ''}</div>
    <div class="catalog-tools">
      <label>Поиск <input type="search" data-ui="search" placeholder="Например, верёвка" value="${escape(ui.search)}"></label>
      <label>Категория <select data-ui="category">${option('', 'Все категории', ui.category)}${Object.entries(categoryNames).map(([value, label]) => option(value, label, ui.category)).join('')}</select></label>
      <label>Способ получения <select data-ui="mode">${Object.entries({buy: 'Покупка', stock: 'Покупка с проверкой наличия', order: 'Под заказ (+50%)', craft: 'Изготовление оружейником', owned: 'Уже принадлежит'}).map(([value, label]) => option(value, label, ui.mode)).join('')}</select></label>
    </div>
    <div id="catalog">${catalogList()}</div>
    <details class="rule-box"><summary>Добавить свой предмет</summary>
      <form id="custom-item" class="editor">
        <label>Название <input name="name" required maxlength="100"></label>
        <label>Вес, фн. <input name="weight" type="number" min="0" max="1000000" step="0.001" value="0" required></label>
        <label>Цена <input name="price" type="number" min="0" max="1000000" step="0.01" value="0" required></label>
        <label>Монета <select name="coin">${Object.entries(units).map(([value, label]) => option(value, label, 'gp')).join('')}</select></label>
        <button type="submit" class="primary">Добавить</button>
      </form>
    </details>`);
}

function magic() {
  const profile = result.magic;
  if (!profile.trained) {
    return section('Магия', 'Книга II, стр. 1–5. Магия становится доступна после ученичества.', `
      <p>${result.score.int < 43 ? 'Для ученичества нужен Интеллект 43 или выше.' :
        `Интеллект ${result.score.int} даёт ${profile.perLevel} очк. магии за уровень, ${profile.slots} начальных заклинаний стоимостью до ${profile.cap} очк. каждое.`}</p>
      <p class="hint">На старте ученичество занимает 39 месяцев из бюджета образования. Нужен наставник выше 8-го уровня.</p>
      <a class="button-link outline" href="#education" data-action="magic-course">К ученичеству</a>`);
  }
  const eligible = spellList.filter((spell) => spell.points <= profile.cap);
  return section('Магия', 'На старте доступны заклинания без мировоззрения. Выбор первого заклинания мировоззрения происходит в игре.', `
    <div class="strip"><strong>${profile.daily} очк. магии / день</strong><span>${profile.castLimit} очк. за боевой ход</span><span>Уровень ${profile.effectiveLevel}</span></div>
    <p>Начальные заклинания · ${result.knownSpells.length} / ${profile.slots}. Предел стоимости ${profile.cap} очк.</p>
    ${result.knownSpells.length > profile.slots ? '<p class="warn">Сними лишние заклинания после изменения Интеллекта.</p>' : ''}
    <div class="spell-list">${eligible.map((spell) => {
      const known = state.spells.includes(spell.id);
      return `<label class="check spell"><input type="checkbox" data-spell="${spell.id}"${checked(known)}${!known && result.knownSpells.length >= profile.slots ? ' disabled' : ''}>
        <span><strong>${spell.name}</strong><small>${spell.note ?? spell.points + ' очк.'}${spell.points > profile.daily ? ' · текущего запаса мало для сотворения' : ''}</small></span></label>`;
    }).join('')}</div>`);
}

function combatPreview() {
  const carriedWeapons = result.items.filter((row) => row.position === 'person' && row.item.category === 'weapon');
  const weapon = carriedWeapons.find((row) => row.uid === ui.weapon);
  const mount = result.mounts.find((row) => row.ridden);
  const training = weaponTraining(weapon, result.education);
  const attack = combatChance({
    dex: result.score.dex, hp: result.hp, exp: state.experience, enemyBody: ui.enemyBody,
    enemyDex: ui.enemyDex, enemyHp: ui.enemyHp, enemyExp: ui.enemyMetric === 'dice' ? Math.min(15, ui.enemyExp) : ui.enemyExp,
    training, stance: mount && mount.level < 2 ? 0.5 : 1, modifier: ui.modifier,
  });
  const save = savingChance({
    cost: ui.saveCost, warrior: !result.magic.trained, dex: result.score.dex, intelligence: result.score.int,
    level: state.experience, caster: ui.caster,
  });
  const mountRestriction = mount && weapon && (
    ['twosword', 'pike'].includes(weapon.id)
    || (mount.level < 2 && weapon.id === 'spear')
    || (mount.level < 3 && (['lance', 'dagger'].includes(weapon.id) || weapon.item.skill === '10'))
  );
  return `<details class="rule-box" id="combat-box"><summary>Проверки боя и магии</summary>
    <div class="grid two fields">
      <label>Оружие на себе <select data-ui="weapon">${option('', 'Без оружия', ui.weapon)}${carriedWeapons.map((row) => option(row.uid, row.item.name, ui.weapon)).join('')}</select></label>
      <label>Тип тела противника <select data-ui="enemyBody">${bodyTypes.map((body, i) => option(i, body, ui.enemyBody)).join('')}</select></label>
      <label>Ловкость противника <input type="number" min="0" max="200" data-ui="enemyDex" value="${ui.enemyDex}"></label>
      <label>Хиты противника <input type="number" min="0" max="5000" data-ui="enemyHp" value="${ui.enemyHp}"></label>
      <label>Источник боевого модификатора <select data-ui="enemyMetric">${option('dice', 'Кости Хитов', ui.enemyMetric)}${option('exp', 'Уровень опыта', ui.enemyMetric)}</select></label>
      <label>${ui.enemyMetric === 'dice' ? 'Кости Хитов противника' : 'Уровень опыта противника'} <input type="number" min="0" max="1000" data-ui="enemyExp" value="${ui.enemyExp}"></label>
      <label>Прочие поправки, % <input type="number" min="-200" max="200" data-ui="modifier" value="${ui.modifier}"></label>
    </div>
    <p id="combat-result">${mountRestriction ? 'Это оружие недоступно в седле при текущей подготовке.' :
    `<strong>Попадание ${attack.chance}%</strong> · база ${attack.base} · Ловкость ${plus(attack.dexBonus)} · размер ${plus(attack.sizeBonus)} · опыт ${plus(attack.experience)}.`}</p>
    <div class="grid two fields">
      <label>Стоимость заклинания <select data-ui="saveCost">${[1,2,3,4,5,6,7,8,9,10,13,15].map((points) => option(points, points, ui.saveCost)).join('')}</select></label>
      <label>Уровень вражеского мага <input type="number" min="1" max="1000" data-ui="caster" value="${ui.caster}"></label>
    </div>
    <p><strong>Спасбросок против магии ${save}%</strong></p>
  </details>`;
}

function sheetContent(print = false) {
  const trained = courseList.filter((course) => result.education.mastered.has(course.id));
  const defenses = result.items.filter((row) => row.position === 'person' && row.equipped && armorRules[row.id]);
  const wornBreastplate = result.items.some((row) => row.position === 'person' && row.equipped && row.id === 'breast');
  const inv = result.items.map((row) => {
    const mount = result.mounts.find((animal) => animal.uid === row.position);
    const place = mount ? mountLabel(mount) : row.position === 'person' ? 'На себе' : row.item.category === 'mount' || row.item.category === 'service' ? '—' : 'Оставлено';
    return `<tr><th scope="row">${escape(row.item.name)}</th><td>${row.qty}</td><td>${weight(row.weight)}</td><td>${escape(place)}</td><td>${money(row.cost)}</td></tr>`;
  }).join('');
  return `
    <div class="sheet-heading"><h2>${escape(state.name.trim() || 'Безымянный искатель приключений')}</h2>
    <p>Человек · ${result.magic.trained ? 'Маг' : 'Воин'} · ${escape(result.rank.name)} · ${state.age} лет · статус ${result.status}</p></div>
    <div class="sheet-abilities">${Object.entries(attributes).map(([key, label]) => stat(label, fmt(result.score[key]), state.scores[key] === result.score[key] ? '' : 'исходное ' + state.scores[key])).join('')}</div>
    <div class="grid two sheet-grid">
      <div><h3>Хиты и движение</h3><p><strong>${result.remainingHp} / ${result.hp} Хитов</strong> · уровень ${result.magic.effectiveLevel}</p>
      <p>Пешком ${inch(result.pace.speed)} · вес ${weight(result.carried)} · предел ${weight(result.pace.maximum)}</p>
      <p>Нагрузка и Ловкость: проверка ${result.pace.dexCheck}% · множитель усталости ×${result.pace.fatigue}.</p>
      <p>Выносливость: ${result.fatigueFree} раунд. до усталости, ${result.fatigueTurns} при половинной эффективности. По боевому правилу (стр. 52): ${result.meleeTurns} раунд. без передышки.</p>
      <p>Естественная смерть: ${mortalityText()}</p>
      ${state.mortality?.weeks ? `<p>Болезнь после возрастной проверки: ${state.mortality.weeks} нед.</p>` : ''}</div>
      <div><h3>Обучение и доход</h3><p>${fmt(result.education.spent)} из ${fmt(result.education.months)} мес., доход от навыков для старта ${fmt(result.income)} з.м.</p>
      <p>${trained.map((course) => course.name).join(', ') || 'Обучение отсутствует.'}</p>
      <p>Языки: ${[state.native, ...result.education.languages].filter(Boolean).map(escape).join(', ') || '—'}</p>
      ${result.magic.trained ? `<h3>Магия</h3><p>${result.magic.daily} очк. в день · ${result.magic.castLimit} за боевой ход</p><p>${result.knownSpells.map((spell) => spell.name + ' (' + spell.points + ')').join(', ') || 'Заклинания не выбраны.'}</p>` : ''}</div>
    </div>
    <h3>Защита <small>Опциональное правило</small></h3>
    ${defenses.length ? `<ul class="compact-list">${defenses.map((row) => `<li>${escape(row.item.name)} · ${armorRules[row.id]}</li>`).join('')}</ul>` : '<p>Без табличной защиты.</p>'}
    ${wornBreastplate ? '<p>Для кирасы в таблице спасбросков отдельный показатель не указан.</p>' : ''}
    <h3>Снаряжение</h3><p>${supplySummary()}</p><p>Старт ${money(result.funds)} · потрачено ${money(result.spent)} · остаток ${money(result.balance)}</p>
    ${inv ? `<div class="table-wrap"><table><thead><tr><th>Предмет</th><th>Кол.</th><th>Вес</th><th>Где</th><th>Потрачено</th></tr></thead><tbody>${inv}</tbody></table></div>` : '<p>Пусто.</p>'}
    ${result.mounts.map((mount) => `<p>${escape(mountLabel(mount))} · груз ${weight(mount.burden)} · скорость ${inch(mount.speed)}${mount.ridden ? ' · с всадником' : ''}</p>`).join('')}
    ${print && state.notes.trim() ? '<h3>Заметки</h3><p class="notes-print">' + escape(state.notes) + '</p>' : ''}`;
}

function sheet() {
  return `<section class="card sheet">${sheetContent()}
    <div class="grid two fields">
      <label>Уровень опыта ${numField('experience', state.experience, 1, 1000)}</label>
      <label>Потерянные Хиты ${numField('wounds', state.wounds, 0, 1000)}</label>
    </div>
    ${combatPreview()}
    <label class="note-field">Заметки <textarea data-field="notes" rows="4" maxlength="12000" placeholder="Происхождение, связи и цели">${escape(state.notes)}</textarea></label>
  </section>`;
}

const pages = {origin, education, equipment, magic, sheet};
function render() {
  if (rendering) {
    deferredRender = true;
    return;
  }
  deferredRender = false;
  rendering = true;
  try {
    result = calculate(state);
    renderSummary();
    const active = currentTab();
    document.querySelectorAll('#navigation [data-tab]').forEach((link) => {
      if (link.dataset.tab === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const panel = $('#panel');
    const keepDetails = panel.dataset.tab === active && panel.querySelector('details')?.open;
    panel.innerHTML = pages[active]();
    panel.dataset.tab = active;
    if (keepDetails && panel.querySelector('details')) panel.querySelector('details').open = true;
    $('#settings').innerHTML = settings();
  } finally {
    rendering = false;
  }
  if (deferredRender && !numericBlurPending) queueMicrotask(() => { if (deferredRender) render(); });
}

function commit(text, refresh = true) {
  const saved = persist(state);
  if (refresh && numericBlurPending) {
    result = calculate(state);
    deferredRender = true;
  } else if (refresh) render();
  if (text || !saved) message([text, saved ? '' : 'Автосохранение недоступно. Скачай JSON.'].filter(Boolean).join(' '));
}

function manageCourse() {
  const attempt = studyAttempt(state, ui.course, ui.language.trim(), ui.studyMonths ?? courseDuration(ui.course, result.education.mastered));
  if (attempt.issue) return message(attempt.issue);
  state.education.push(attempt.entry);
  if (attempt.entry.passed && attempt.entry.id === '6' && state.trainingBonus < 2) state.trainingBonus = rollTraining();
  ui.language = '';
  ui.studyMonths = null;
  commit(attempt.entry.passed ? 'Курс освоен.' : 'Проверка не пройдена. Затраченные месяцы учтены.');
}

function removeCourse(uid) {
  const index = state.education.findIndex((entry) => entry.uid === uid);
  const target = state.education[index];
  if (!target) return;
  const sameCourse = (entry) => entry.id === target.id && entry.language.toLowerCase() === target.language.toLowerCase();
  if (state.education.slice(index + 1).some(sameCourse)) return message('Сначала убери более поздние попытки этого курса.');
  const old = state.education;
  state.education = old.filter((entry) => entry.uid !== uid);
  const remainingInvalid = calculate(state).education.invalid;
  const previousInvalid = new Set(result.education.invalid.map((entry) => entry.uid));
  if (remainingInvalid.some((entry) => !previousInvalid.has(entry.uid))) {
    state.education = old;
    return message('Сначала убери курсы, которым нужен этот навык.');
  }
  commit('Курс убран.');
}

function addItem(id, custom) {
  const item = custom ?? gear[id];
  const mode = custom ? 'buy' : ui.mode;
  if (mode === 'stock' && item.stock < 100 && !(state.stock[id] <= item.stock)) return;
  if (mode === 'craft' && (!item.weeks || !result.education.mastered.has('21'))) return;
  const paid = mode !== 'owned';
  const price = item.price * (mode === 'order' && item.weeks ? 1.5 : mode === 'craft' ? 0.5 : 1);
  const cost = priceInCopper(price, item.coin, state.rates);
  if (paid && cost > 0 && cost > result.balance + 1e-8) return message('Не хватает средств для покупки.');
  const position = ['service', 'mount'].includes(item.category) ? 'stashed' : 'person';
  const existing = !custom && item.category !== 'mount' && state.items.find((row) => row.id === id && row.paid === paid
    && (row.price ?? item.price) === price && row.position === position && !row.equipped && row.qty < 9999);
  if (existing) existing.qty++;
  else state.items.push({uid: newId(), id, custom, paid, price, qty: 1, position, equipped: false});
  commit('Добавлено: ' + item.name + '.');
}

function removeItem(uid) {
  state.items = state.items.filter((row) => row.uid !== uid);
  for (const row of [...state.items, ...Object.values(state.kit)]) {
    if (row.position === uid) row.position = 'person';
  }
  if (state.rider === uid) state.rider = '';
  delete state.mountTraining[uid];
  commit('Предмет убран. Расходы и нагрузка пересчитаны.');
}

function editableRow(uid) {
  if (uid.startsWith('kit-')) {
    const row = result.items.find((entry) => entry.uid === uid);
    return state.kit[row.id] ??= {position: row.position, equipped: row.equipped};
  }
  return state.items.find((entry) => entry.uid === uid);
}

function download() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (state.name.trim().replace(/[^\p{L}\p{N} _-]/gu, '_') || 'adventures-in-fantasy') + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const actions = {
  import: () => $('#import-file').click(),
  export: download,
  print: () => window.print(),
  new: () => {
    if (!window.confirm('Создать нового персонажа? Текущий лист в браузере будет заменён.')) return;
    state = rollOrigin(blankCharacter());
    Object.assign(ui, {course: '5', language: '', studyMonths: null, search: '', category: '', mode: 'buy', weapon: ''});
    location.hash = 'origin';
    commit('Новый персонаж создан.');
  },
  'roll-score': (id) => { state.scores[id] = d100(); commit(attributes[id] + ': ' + state.scores[id] + '.'); },
  'roll-scores': () => { for (const id of Object.keys(attributes)) state.scores[id] = d100(); commit('Характеристики переброшены.'); },
  'roll-age': () => {
    const rolled = rollOrigin(blankCharacter());
    state.age = rolled.age;
    state.rolls = {...rolled.rolls, ...state.rolls, age: rolled.rolls.age, rank: state.rolls?.rank ?? 0};
    state.mortality = null;
    commit('Возраст переброшен.');
  },
  'roll-rank': () => {
    const rolled = rollOrigin(blankCharacter());
    state.rank = rolled.rank;
    state.rolls = {...rolled.rolls, age: state.rolls?.age ?? 0};
    commit('Ранг переброшен.');
  },
  'training-roll': () => { state.trainingBonus = rollTraining(); commit('Прибавка за подготовку: ' + state.trainingBonus + '.'); },
  mortality: () => { if (!state.mortality) { state.mortality = naturalDeath(result); commit('Возрастная проверка проведена.'); } },
  'clear-mortality': () => { state.mortality = null; commit('Возрастная проверка сброшена.'); },
  'add-course': manageCourse,
  'remove-course': removeCourse,
  'add-item': addItem,
  'remove-item': removeItem,
  'stock-roll': (id) => { if (state.stock[id] === undefined) { state.stock[id] = d100(); commit('Наличие проверено.'); } },
  'market-month': () => { state.stock = {}; commit('Результаты предыдущего месяца сброшены.'); },
  'magic-course': () => {
    ui.course = 'magic';
    ui.language = '';
    ui.studyMonths = null;
    location.hash = 'education';
  },
};

document.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;
  if (control.dataset.action === 'magic-course') event.preventDefault();
  actions[control.dataset.action]?.(control.dataset.id);
});

// A click on another control follows the number input's blur/change event.
document.addEventListener('pointerdown', () => {
  numericBlurPending = document.activeElement?.type === 'number';
}, true);
for (const type of ['pointerup', 'pointercancel']) {
  document.addEventListener(type, () => {
    if (!numericBlurPending) return;
    numericBlurPending = false;
    setTimeout(() => { if (deferredRender) render(); }, 0);
  }, true);
}

const numericUi = ['studyMonths', 'enemyBody', 'enemyDex', 'enemyHp', 'enemyExp', 'modifier', 'saveCost', 'caster'];
document.addEventListener('input', (event) => {
  const input = event.target;
  if (['name', 'notes', 'native'].includes(input.dataset.field)) {
    state[input.dataset.field] = input.value;
    commit('', false);
  }
  if (input.dataset.ui === 'search') {
    ui.search = input.value;
    $('#catalog').innerHTML = catalogList();
  }
  if (['language', 'studyMonths'].includes(input.dataset.ui)) {
    ui[input.dataset.ui] = input.dataset.ui === 'language' ? input.value : input.valueAsNumber;
    $('#course-preview').innerHTML = coursePreview();
  }
});

document.addEventListener('change', async (event) => {
  const input = event.target;
  const {field, qty, position, equip, mountTraining, spell} = input.dataset;
  const uiField = input.dataset.ui;
  if (input.id === 'import-file') {
    const file = input.files[0];
    if (!file) return;
    try {
      state = readCharacter(JSON.parse(await file.text()));
      commit('Персонаж открыт.');
    } catch {
      message('Не удалось открыть файл персонажа. Нужен JSON, скачанный из генератора.');
    } finally {
      input.value = '';
    }
    return;
  }
  if (uiField) {
    if (['search', 'language', 'studyMonths'].includes(uiField)) return;
    if (numericUi.includes(uiField)) {
      const number = Number(input.value);
      if (Number.isFinite(number)) ui[uiField] = clamp(number, input.min === '' || input.min === undefined ? 0 : Number(input.min),
        input.max === '' || input.max === undefined ? 1000 : Number(input.max));
    } else ui[uiField] = input.value;
    if (uiField === 'course') { ui.studyMonths = null; ui.language = ''; }
    if (numericBlurPending) deferredRender = true;
    else render();
    return;
  }
  if (field) {
    if (['name', 'notes', 'native'].includes(field)) {
      return;
    }
    if (input.type === 'checkbox') state[field] = input.checked;
    else if (field === 'rider') state.rider = input.value;
    else if (input.value !== '' && Number.isFinite(Number(input.value))) {
      const numeric = clamp(Number(input.value), input.min ? Number(input.min) : -Infinity, input.max ? Number(input.max) : Infinity);
      const value = input.type === 'number' && input.step !== '' && input.step !== '1' ? numeric : Math.floor(numeric);
      if (field.startsWith('score-')) state.scores[field.slice(6)] = value;
      else if (Object.hasOwn(state.rates, field)) state.rates[field] = value;
      else state[field] = value;
      if (field === 'age') {
        state.mortality = null;
        if (state.rolls) state.rolls.age = 0;
      }
      if (field === 'rank' && state.rolls) state.rolls.rank = 0;
    }
    commit();
  }
  if (qty) {
    const row = editableRow(qty);
    const quantity = input.valueAsNumber;
    const previous = result.items.find((entry) => entry.uid === qty);
    const next = clamp(Math.floor(quantity), 1, 9999);
    if (!Number.isFinite(quantity)) return render();
    const additionalCost = previous.cost / previous.qty * (next - previous.qty);
    if (additionalCost > 0 && additionalCost > result.balance + 1e-8) {
      render();
      return message('Не хватает средств, чтобы увеличить количество.');
    }
    row.qty = next;
    commit();
  }
  if (position) {
    const row = editableRow(position);
    row.position = input.value;
    if (row.position !== 'person') row.equipped = false;
    commit();
  }
  if (equip) {
    const row = editableRow(equip);
    const target = result.items.find((item) => item.uid === equip);
    if (input.checked) {
      for (const item of result.items.filter((item) => item.item.category === target.item.category && item.equipped)) editableRow(item.uid).equipped = false;
    }
    row.equipped = input.checked;
    commit();
  }
  if (mountTraining) { state.mountTraining[mountTraining] = Number(input.value); commit(); }
  if (spell) {
    if (input.checked && result.knownSpells.length < result.magic.slots) state.spells.push(spell);
    if (!input.checked) state.spells = state.spells.filter((item) => item !== spell);
    commit();
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'custom-item') return;
  event.preventDefault();
  const data = new FormData(event.target);
  const name = data.get('name').trim();
  if (!name) return message('Укажи название предмета.');
  addItem('custom', {id: 'custom', category: 'supply', name,
    price: Number(data.get('price')), weight: Number(data.get('weight')), coin: data.get('coin')});
});

window.addEventListener('beforeprint', () => { $('#print-sheet').innerHTML = sheetContent(true); });
window.addEventListener('hashchange', () => { render(); message(''); });
commit();
