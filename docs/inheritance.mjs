import {gear} from './data.mjs';

const entry = (rows, roll) => rows.find(([maximum]) => roll <= maximum);
const attributes = [
  [2, 'Нерушимый', 'Меч невозможно сломать или изменить, даже магией.', 'neutral'],
  [4, 'Свет', 'Обнажённый меч освещает 10 футов и рассеивает хаотическую тьму.'],
  [6, 'Молния', 'Три молнии в день. Спасбросок против магии в 6 очков.'],
  [8, 'Невидимость', 'Обнажённый меч делает владельца невидимым.'],
  [10, 'Путник', 'Удваивает скорость дальнего путешествия, в том числе верхом.'],
  [12, 'Пронзает камень', 'Действует на камень как василиск. Два применения в день.'],
  [14, 'Расщепляет стрелы', 'Защищает владельца от метательного оружия.'],
  [15, 'Меч смерти', 'Попадание требует спасброска против магии в 6 очков. При успехе урона нет.', 'chaos'],
  [16, 'Меч заклинаний', 'Маг получает на 50% больше очков магии, а спасброски против его заклинаний получают −10%.'],
  [17, 'Хранитель жизни', 'Сохраняет жизнь при критических ранениях и удваивает естественное исцеление.'],
  [18, 'Рассеиватель магии', 'Может рассеивать заклинания и чары при контакте.'],
  [19, 'Воскрешает мёртвых', 'Может вернуть к жизни персонажа игрока в течение одного хода после смерти. Раз в день.', 'law'],
  [20, 'Пожиратель душ', 'Поглощает души при провале спасброска. За каждую временно даёт +10% к Силе.', 'chaos'],
];
const limitations = [
  [40, ''], [50, 'Не обнажается против существ Закона.', 'law'],
  [65, 'Не обнажается против нейтральных существ.', 'neutral'],
  [75, 'Не обнажается против существ Хаоса.', 'chaos'],
  [80, 'При ударе по союзнику или существу своего мировоззрения боевой бонус меняет знак.'],
  [85, 'Не наносит урона драконам.'], [90, 'Не наносит урона народам фэйри.'],
  [95, 'Боевой бонус действует только против Закона.', null, 'law'],
  [99, 'Боевой бонус действует только против Хаоса.', null, 'chaos'],
  [100, 'Боевой бонус действует только против разумных существ.'],
];
const alignmentNames = {law: 'Закон', neutral: 'Нейтральность', chaos: 'Хаос', none: 'Без мировоззрения'};

const armorTypes = [
  [30, 'Волшебный щит', 'lshield', -15], [70, 'Волшебная кольчуга', 'mail', 5],
  [95, 'Волшебный латно-кольчужный доспех', 'breast', 0], [100, 'Волшебный полный латный доспех', 'plate', 10],
];
const amulets = [
  [15, 'Крест', 'Даёт +3% к спасброскам против Хаоса и отгоняет фэйри и вампиров.'],
  [25, 'Мандрагора', 'На виду даёт свет и помогает открывать замки.'],
  [30, 'Жёлудь', 'Даёт +3% к защите и спасброскам, +50% к спасброску от молнии.'],
  [35, 'Пепел', 'При ношении повышает Силу на 20%.'],
  [40, 'Колокольчики', 'Даёт +15% к спасброскам от магии и защищает от физических атак магов и указанных в книге народов.'],
  [45, 'Кошка', 'Безошибочно предсказывает погоду и распознаёт подготовку погодного заклинания.'],
  [50, 'Ворон', 'Повышает Интеллект на 20% и ведёт к знакомой цели.'],
  [60, 'Чеснок', 'Может рассеивать направленную на владельца магию и отпугивает чудовищ.'],
  [65, 'Соль', 'Защищает от джиннов, ифритов и гулей.'],
  [70, 'Кровь', 'Свойства зависят от животного, которое определяет Рефери.'],
  [75, 'Волосы', 'Магу даёт на 20% больше очков магии.'],
  [80, 'Красный коралл', 'Отгоняет существ Хаоса.'],
  [85, 'Бурый коралл', 'Отгоняет существ Закона и привлекает существ Хаоса.'],
  [90, 'Агат', 'Защищает от яда и улучшает спасброски от непогоды и молнии.'],
  [94, 'Жабий камень', 'Даёт +5% к спасброскам от магии и защищает от проклятий.'],
  [98, 'Воздух', 'Даёт +5% к спасброскам от магии и защищает душу. Маг может летать раз в неделю.'],
  [99, 'Лотос', 'Приносит на 10% больше богатства. Магу даёт бессмертие, два уровня и ещё 20% к запасу магии.'],
  [100, 'Топаз', 'Даёт бесстрашие, разумную осторожность и способность говорить с обычными животными.'],
];
const talismans = [
  [5, 'Жемчуг', 'Транс на 10 ходов и прибавка 10% к запасу магии.'],
  [10, 'Ящерица', 'Поражает одну цель жаром.'],
  [15, 'Красный', 'Создаёт конус силы. У немага усиливает эмоции окружающих.'],
  [20, 'Зелёный', 'Успокаивает, препятствуя бою. На немага действует постоянно.'],
  [25, 'Петух', 'Рассеивает постоянные чары Хаоса и действует на василисков.'],
  [30, 'Железо', 'Поражает существ, уязвимых к железу.'],
  [35, 'Луна', 'Управляет водными существами и может удвоить силу одного заклинания.'],
  [40, 'Кристалл', 'Действует как заклинание предвидения.'],
  [50, 'Алмаз', 'Отравляет либо защищает от обмана и некоторых атак.'],
  [60, 'Аметист', 'Удваивает Харизму. Действует на людей.'],
  [65, 'Синий', 'Вызывает безумие и защищает от засады.'],
  [70, 'Жёлтый', 'Позволяет полностью использовать характеристики, усиливает магию и вызывает ненависть.'],
  [75, 'Кабан', 'Поражает одну цель в пределах 10 футов или действует как разрушение.'],
  [80, 'Бык', 'Удваивает Силу на три хода и улучшает спасброски от непогоды.'],
  [85, 'Свинец', 'Поражает одну цель в пределах 30 футов. Не действует на магов и существ, владеющих магией.'],
  [90, 'Изумруд', 'Помогает понимать языки, увеличивает богатство и на три хода удваивает Интеллект.'],
  [95, 'Турмалин', 'Поглощает свет на три хода.'],
  [100, 'Змеевик', 'Защищает некроманта от духов и позволяет наслать тление.'],
];
const talismanRestrictions = {
  Луна: 'law', Кабан: 'law', Турмалин: 'law', Змеевик: 'law', Зелёный: 'chaos', Петух: 'chaos', Железо: 'chaos',
};

export const heirloomIds = ['heir-sword', 'heir-armor', 'heir-amulet', 'heir-talisman'];

export function rollInheritance(age, die) {
  const check = die(100);
  if (check > age) return {age, check};
  const twoDigits = () => die(10) + die(10);
  const type = twoDigits();
  const rolls = {age, check, type};
  if (type <= 6 || type === 20) {
    rolls.sword = {
      attribute: type === 20 ? 16 : die(6) >= 4 ? twoDigits() : 0,
      limitation: die(100), bonus: die(100), intelligence: die(100), alignment: die(100), material: die(100),
    };
  }
  if (type >= 4 && type <= 6) rolls.armor = {type: die(100), enchantment: die(100)};
  if (type >= 7 && type <= 15) {
    rolls.goldDice = twoDigits();
    rolls.amuletCheck = die(100);
  } else if (type >= 16 && type <= 19) rolls.goldDice = die(10);
  if (type >= 16 || rolls.amuletCheck <= 20) rolls.amulet = die(100);
  if (type >= 16) rolls.talisman = die(100);
  return rolls;
}

function inheritedSword(rolls, magesOnly) {
  const attribute = rolls.attribute ? entry(attributes, rolls.attribute) : null;
  const limitation = entry(limitations, Math.min(100, rolls.limitation + (attribute ? 30 : 0)));
  const fixedAlignment = attribute?.[3];
  const alignment = fixedAlignment ?? limitation[2] ?? entry(
    [[34, 'neutral'], [67, 'law'], [99, 'chaos'], [100, 'none']], rolls.alignment,
  )[1];
  const combatBonus = entry([[50, 0], [83, 5], [99, 10], [100, 15]], rolls.bonus)[1];
  const intelligence = entry([[60, 1], [80, 2], [85, 3], [95, 4], [100, 5]], rolls.intelligence)[1];
  const ego = combatBonus * intelligence + rolls.attribute + (alignment === 'chaos' ? 5 : alignment === 'law' ? -10 : 0);
  const swordLimit = fixedAlignment && fixedAlignment === limitation[3] && rolls.attribute !== 20 ? '' : limitation[1];
  const nonFerrous = rolls.material <= 40;
  return {
    ...gear.sword, id: 'heir-sword', name: magesOnly ? 'Меч заклинаний' : 'Волшебный меч',
    weight: gear.sword.weight * (nonFerrous ? 0.5 : 1), combatBonus, swordLimit, magesOnly,
    notes: [
      `Боевой бонус +${combatBonus}% · Интеллект меча ${intelligence} · эго ${ego} · ${alignmentNames[alignment]}.`,
      nonFerrous && 'Цветной металл, половина обычного веса.',
      attribute ? attribute[1] + '. ' + attribute[2] : 'Особого свойства нет.',
      rolls.attribute === 16 && !magesOnly && 'Немагу даёт только +5% к сопротивлению магии.',
      magesOnly && 'Владелец может пользоваться мечом только после ученичества у мага.',
      swordLimit,
    ].filter(Boolean),
  };
}

function inheritedArmor(rolls) {
  const [, name, baseId, modifier] = entry(armorTypes, rolls.type);
  const bonus = entry([[60, 0], [80, 5], [95, 10], [100, 15]], Math.min(100, rolls.enchantment + modifier))[1];
  const notes = [`Магическая прибавка к защите +${bonus}%. Бонусы доспеха и щита не складываются.`];
  if (baseId === 'lshield') notes.push('У щита взят вес лёгкого щита. Его можно изменить.');
  if (baseId === 'breast') notes.push('В качестве оценки взят вес кирасы. Его можно изменить.');
  return {...gear[baseId], id: 'heir-armor', name, defenseBonus: bonus, baseId, notes};
}

function charm(id, name, note, category) {
  const prefix = category === 'amulet' ? 'Амулет' : 'Талисман';
  const restriction = category === 'talisman' ? talismanRestrictions[name] : null;
  const notes = [note];
  if (restriction) notes.push(`Недоступен для стороны «${alignmentNames[restriction]}» и соответствующих ей нейтральных персонажей.`);
  notes.push('Вес в книге не задан. Его можно указать в инвентаре.');
  return {id, name: prefix + ' — ' + name, category: 'supply', weight: 0, notes};
}

export function describeInheritance(rolls) {
  if (!rolls || rolls.check > rolls.age) return {gold: 0, items: []};
  const {type} = rolls;
  const gold = type >= 4 && type <= 6 ? 50 : type >= 7 && type <= 19 ? rolls.goldDice * 10 : 0;
  const items = [];
  if (rolls.sword) items.push(inheritedSword(rolls.sword, type === 20));
  if (rolls.armor) items.push(inheritedArmor(rolls.armor));
  if (rolls.amulet) items.push(charm('heir-amulet', ...entry(amulets, rolls.amulet).slice(1), 'amulet'));
  if (rolls.talisman) items.push(charm('heir-talisman', ...entry(talismans, rolls.talisman).slice(1), 'talisman'));
  return {gold, items};
}
