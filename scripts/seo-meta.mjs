// SEO 元数据集中生成：为每个页面按语言产出干净的 <title> 与 <meta description>。
// 背景：zh-cn/ru 页面原先由 generate-locales.mjs 的字典正则替换生成元信息，
// 会产生「13 带来源链接的 Subnautica 2 生态区 from permanent official Wiki revisions.」
// 这类半中半英的句子。这里改为按数据 + i18n 整句模板生成，由 enhance-site.mjs 统一覆盖。
// 原则：只使用 data 里真实存在的字段，缺失就退回保守句式，绝不臆造游戏事实。

const SITE_SUFFIX = "Subnautica 2";
const GAME_ZH = "深海迷航2";
const GAME_RU = "Subnautica 2";

const clamp = (value, max) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);
// Wiki 的 biome 字段里混有 "All"、"Void"、"Migratory - Not found in any particular biome"
// 这类非地名值，直接写进 description 会变成 "in All" 这种病句，这里过滤掉。
const JUNK_BIOME = /^(all|none|n\/?a|unknown|void)$/i;
const cleanBiomes = (values) => (values ?? []).filter((value) => value && !JUNK_BIOME.test(value) && !/not found/i.test(value));
const list = (values, locale) => {
  const clean = values.filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return locale === "zh-cn" ? `${clean[0]}和${clean[1]}` : `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}${locale === "zh-cn" ? "和" : " and "}${clean[clean.length - 1]}`;
};

// 核心 hub 页的人工文案（三语言整句，不做字符串替换）
export const corePageMeta = {
  "index.html": {
    en: { title: "Subnautica 2 Guide: Crafting, Blueprints, Creatures & Bases", description: "A Subnautica 2 guide built from the official Wiki: crafting recipes, blueprint fragments, where to find resources, creature habitats, base building and the Tadpole. Every fact links to a permanent Wiki revision." },
    "zh-cn": { title: "深海迷航2 攻略：配方、蓝图、生物与基地", description: "基于官方 Wiki 的《深海迷航2：异星水域》攻略：合成配方、蓝图碎片、材料获取位置、生物出没地、基地建造与蝌蚪号载具。每条事实都附永久 Wiki 修订链接。" },
    ru: { title: "Subnautica 2: Гайд по крафту, чертежам, существам и базам", description: "Гайд Subnautica 2 на основе официальной вики: рецепты, фрагменты чертежей, где искать ресурсы, места обитания существ, строительство базы и транспорт Головастик." },
  },
  "crafting.html": {
    en: { title: "Subnautica 2 Crafting Recipes: All Items & Ingredients", description: "Every known Subnautica 2 crafting recipe in one searchable table: which station builds it, the exact ingredients and the Wiki revision it came from." },
    "zh-cn": { title: "深海迷航2 全部合成配方与材料表", description: "《深海迷航2》所有已知合成配方：在哪个制造站制作、需要哪些材料与数量，并标注对应的 Wiki 修订版本，可按物品或材料搜索。" },
    ru: { title: "Subnautica 2: Все рецепты крафта и ингредиенты", description: "Все известные рецепты крафта Subnautica 2: станция, точные ингредиенты и ревизия вики, из которой взяты данные. Есть поиск по таблице." },
  },
  "blueprints.html": {
    en: { title: "Subnautica 2 Blueprint Fragments: Counts & Where Found", description: "Fragment counts needed to unlock every Subnautica 2 blueprint, plus the biomes and sources recorded in the item infoboxes." },
    "zh-cn": { title: "深海迷航2 蓝图碎片数量与解锁位置", description: "《深海迷航2》每个蓝图解锁所需的碎片数量，以及物品信息框中记录的生物群系与来源位置。" },
    ru: { title: "Subnautica 2: Фрагменты чертежей и где их найти", description: "Сколько фрагментов нужно для каждого чертежа Subnautica 2, а также биомы и источники, записанные в карточках предметов." },
  },
  "starter-planner.html": {
    en: { title: "Subnautica 2 Starter Crafting Order (Scanner, Tank, Fins)", description: "The exact craft order and total raw materials for starter gear: Scanner, Standard Air Tank, Basic Fins, Habitat Builder and Repair Tool, computed from Wiki recipes." },
    "zh-cn": { title: "深海迷航2 开局合成顺序与所需材料", description: "开局装备（扫描仪、标准气瓶、基础脚蹼、栖息地建造器、修理工具）的准确合成顺序与原材料总量，由 Wiki 配方逐步推算得出。" },
    ru: { title: "Subnautica 2: Порядок начального крафта", description: "Точный порядок крафта и общее сырьё для стартового снаряжения: сканер, баллон, плавники, строитель базы и ремонтный инструмент." },
  },
  "starter-materials.html": {
    en: { title: "Subnautica 2 Starter Materials: Where to Find Them First", description: "Where to gather the materials early-game recipes need, with the biomes recorded for each resource in the Subnautica 2 Wiki." },
    "zh-cn": { title: "深海迷航2 开局材料去哪找", description: "前期配方所需材料的采集位置，按官方 Wiki 中记录的生物群系列出每种资源可以在哪里找到。" },
    ru: { title: "Subnautica 2: Где искать стартовые материалы", description: "Где собирать ресурсы, нужные для ранних рецептов, с указанием биомов из официальной вики Subnautica 2." },
  },
  "equipment-upgrades.html": {
    en: { title: "Subnautica 2 Equipment Upgrades: Air Tank, Fins, Scanner", description: "Upgrade chains that are proven by recipe inputs — each tier that actually consumes the previous piece of equipment, with its ingredient list." },
    "zh-cn": { title: "深海迷航2 装备升级路线：气瓶、脚蹼、扫描仪", description: "只按配方输入关系成立的升级链：每一级确实消耗上一级装备的才列入，并附完整材料清单。" },
    ru: { title: "Subnautica 2: Улучшения снаряжения — баллон, плавники, сканер", description: "Цепочки улучшений, подтверждённые ингредиентами рецептов: каждый следующий уровень реально расходует предыдущий предмет." },
  },
  "vehicle-planner.html": {
    en: { title: "Subnautica 2 Tadpole Planner: Modules, Depth & Fragments", description: "What the Tadpole needs to be built and upgraded: fragments, depth rating and module options recorded in the Wiki." },
    "zh-cn": { title: "深海迷航2 蝌蚪号规划：碎片、深度与模块", description: "蝌蚪号载具的建造与升级所需：Wiki 记录的碎片数量、下潜深度上限与模块选项。" },
    ru: { title: "Subnautica 2: План транспорта Головастик", description: "Что нужно для сборки и апгрейда Головастика: фрагменты, глубина и модули из официальной вики." },
  },
  "locations.html": {
    en: { title: "Subnautica 2 Key Locations & Biome Map Reference", description: "Biomes and points of interest with their recorded depth ranges, so you know what an area contains before diving into it." },
    "zh-cn": { title: "深海迷航2 关键地点与生物群系参考", description: "各生物群系的深度范围与关键地点（POI）一览，下潜前先知道那片区域有什么。" },
    ru: { title: "Subnautica 2: Ключевые места и биомы", description: "Биомы и точки интереса с записанной глубиной — чтобы знать, что находится в зоне до погружения." },
  },
  "base-building.html": {
    en: { title: "Subnautica 2 Base Building: Habitat Builder Catalogue", description: "Every structure the Habitat Builder can make, with the exact ingredients for each room, corridor and module." },
    "zh-cn": { title: "深海迷航2 基地建造：栖息地建造器可建清单", description: "栖息地建造器能制作的全部结构，含每个房间、走廊与模块的准确材料。" },
    ru: { title: "Subnautica 2: Строительство базы — каталог строителя", description: "Все конструкции, которые создаёт строитель базы, с точными ингредиентами для комнат, коридоров и модулей." },
  },
  "oxygen.html": {
    en: { title: "Subnautica 2 Oxygen: Tanks, Rebreather & Survival Gear", description: "Oxygen equipment in Subnautica 2 with recipes and upgrade order, taken from the Wiki crafting records." },
    "zh-cn": { title: "深海迷航2 氧气装备：气瓶与循环呼吸器", description: "《深海迷航2》中所有氧气相关装备的配方与升级顺序，数据来自 Wiki 合成记录。" },
    ru: { title: "Subnautica 2: Кислород — баллоны и ребризер", description: "Кислородное снаряжение Subnautica 2: рецепты и порядок улучшений из записей крафта вики." },
  },
  "resources.html": {
    en: { title: "Subnautica 2 Resources: Where to Find Every Material", description: "Every raw resource in Subnautica 2, what drops or spawns it, which biomes it appears in and what it is used to craft." },
    "zh-cn": { title: "深海迷航2 材料获取：每种资源在哪找", description: "《深海迷航2》全部原始材料：由什么掉落、出现在哪些生物群系，以及能用来合成什么。" },
    ru: { title: "Subnautica 2: Ресурсы и где их добывать", description: "Все сырьевые ресурсы Subnautica 2: что их даёт, в каких биомах встречаются и что из них крафтится." },
  },
  "creatures.html": {
    en: { title: "Subnautica 2 Creatures: Habitats, Danger & Drops", description: "Creature list with each animal's biome, attitude toward the player and nutrition value, sourced from the official Wiki." },
    "zh-cn": { title: "深海迷航2 生物大全：出没地、危险度与掉落", description: "生物列表，含每种生物的出没生物群系、对玩家的态度以及食用价值，数据取自官方 Wiki。" },
    ru: { title: "Subnautica 2: Существa — среда, опасность и добыча", description: "Список существ с биомом обитания, отношением к игроку и питательной ценностью из официальной вики." },
  },
  "biomes.html": {
    en: { title: "Subnautica 2 Biomes: Depth Ranges & What's Inside", description: "Every mapped biome with its depth range and recorded points of interest, so you can plan a dive before you leave base." },
    "zh-cn": { title: "深海迷航2 生物群系：深度范围与内部资源", description: "所有已记录生物群系的深度范围与关键地点，出发下潜前就能规划路线。" },
    ru: { title: "Subnautica 2: Биомы, глубина и что в них есть", description: "Каждый биом с диапазоном глубин и записанными точками интереса — чтобы планировать погружение из базы." },
  },
  "vehicles.html": {
    en: { title: "Subnautica 2 Vehicles: Stats, Depth & How to Build", description: "Vehicles in Subnautica 2 with speed, depth, health and the fragments needed to unlock them." },
    "zh-cn": { title: "深海迷航2 载具：属性、深度与建造方式", description: "《深海迷航2》载具的速度、下潜深度、耐久以及解锁所需碎片数量。" },
    ru: { title: "Subnautica 2: Транспорт — характеристики и сборка", description: "Транспорт Subnautica 2: скорость, глубина, прочность и количество фрагментов для открытия." },
  },
  "questions.html": {
    en: { title: "Subnautica 2 Player Questions: What People Get Stuck On", description: "Real questions from the Subnautica 2 subreddit with answers that say what is confirmed, what is partial and what is still open." },
    "zh-cn": { title: "深海迷航2 玩家问题：大家真正卡在哪", description: "来自 Subnautica 2 Reddit 版块的真实玩家提问，答案明确区分已确认、部分确认与仍未解决。" },
    ru: { title: "Subnautica 2: Вопросы игроков и где все застревают", description: "Реальные вопросы из сабреддита Subnautica 2 с ответами: что подтверждено, что частично, а что ещё открыто." },
  },
  "coop.html": {
    en: { title: "Subnautica 2 Co-op: Confirmed Multiplayer Facts", description: "What is actually confirmed about Subnautica 2 multiplayer, separated from speculation, with each claim tied to a source." },
    "zh-cn": { title: "深海迷航2 联机：已确认的多人事实", description: "把《深海迷航2》多人模式中已被证实的内容与猜测分开列出，每条结论都标注来源。" },
    ru: { title: "Subnautica 2: Кооператив — подтверждённые факты", description: "Что действительно известно о мультиплеере Subnautica 2, отделено от слухов; каждое утверждение со ссылкой на источник." },
  },
  "story.html": {
    en: { title: "Subnautica 2 Story Reference: Progression & Endgame", description: "A structured story reference for Subnautica 2, listing what is documented by the Wiki and what is still unknown." },
    "zh-cn": { title: "深海迷航2 剧情参考：流程与终局", description: "结构化的《深海迷航2》剧情参考，标明哪些由 Wiki 记录、哪些仍属未知。" },
    ru: { title: "Subnautica 2: Сюжет — прогрессия и финал", description: "Структурированный справочник по сюжету: что задокументировано вики, а что пока неизвестно." },
  },
  "tools.html": {
    en: { title: "Subnautica 2 Tools: Planners and Calculators", description: "Interactive planning tools for Subnautica 2 — starter craft order, Tadpole modules and blueprint fragments." },
    "zh-cn": { title: "深海迷航2 工具：规划器与计算器", description: "《深海迷航2》交互规划工具：开局合成顺序、蝌蚪号模块与蓝图碎片统计。" },
    ru: { title: "Subnautica 2: Инструменты и планировщики", description: "Интерактивные планировщики Subnautica 2: порядок крафта, модули Головастикa и фрагменты чертежей." },
  },
  "guide/items/index.html": {
    en: { title: "All Subnautica 2 Craftable Items & Recipes", description: "Complete alphabetical list of every craftable item in Subnautica 2 with the station it is built at, each linking to its full recipe record." },
    "zh-cn": { title: "深海迷航2 全部可制作物品一览", description: "《深海迷航2》所有可制作物品按字母排序，标注制造站，点击进入完整配方记录。" },
    ru: { title: "Subnautica 2: Все создаваемые предметы", description: "Полный список предметов Subnautica 2 по алфавиту, с указанием станции создания и ссылкой на полный рецепт." },
  },
  "guide/resources/index.html": {
    en: { title: "All Subnautica 2 Resources: Where to Find Each One", description: "Every raw resource in Subnautica 2 with what produces it, its recorded biomes and the items it is used to craft." },
    "zh-cn": { title: "深海迷航2 全部材料获取一览", description: "《深海迷航2》每种原始材料：由什么产出、记录在哪些生物群系，以及能用来合成什么物品。" },
    ru: { title: "Subnautica 2: Все ресурсы и где их брать", description: "Каждый ресурс Subnautica 2: источник, записанные биомы и предметы, для крафта которых он нужен." },
  },
  "guide/creatures/index.html": {
    en: { title: "All Subnautica 2 Creatures: Biomes, Danger & Drops", description: "Every documented Subnautica 2 creature with its biome list, attitude toward players and nutrition value." },
    "zh-cn": { title: "深海迷航2 全部生物：出没地、危险度与食用价值", description: "《深海迷航2》每种已记录生物的生物群系、对玩家的态度与营养数值。" },
    ru: { title: "Subnautica 2: Все существа, биомы и опасность", description: "Каждое существо Subnautica 2: список биомов, отношение к игроку и питательная ценность." },
  },
  "guide/biomes/index.html": {
    en: { title: "All Subnautica 2 Biomes: Depth Ranges & Locations", description: "Every mapped Subnautica 2 biome with its depth range and the points of interest recorded inside it." },
    "zh-cn": { title: "深海迷航2 全部生物群系与深度范围", description: "《深海迷航2》每个已测绘生物群系的深度范围与内部记录的关键地点。" },
    ru: { title: "Subnautica 2: Все биомы, глубина и точки интереса", description: "Каждый биом Subnautica 2 с диапазоном глубин и записанными внутри точками интереса." },
  },
  "guide/vehicles/index.html": {
    en: { title: "All Subnautica 2 Vehicles: Stats & Unlock Requirements", description: "Subnautica 2 vehicles with speed, depth rating, health and the fragment counts needed to build them." },
    "zh-cn": { title: "深海迷航2 全部载具：属性与解锁条件", description: "《深海迷航2》载具的速度、下潜深度、耐久值与建造所需碎片数量。" },
    ru: { title: "Subnautica 2: Весь транспорт и условия открытия", description: "Транспорт Subnautica 2: скорость, глубина, прочность и количество фрагментов для сборки." },
  },
  "sources.html": {
    en: { title: "Subnautica 2 Guide Sources & Evidence Policy", description: "Where every fact on this guide comes from, what each source is allowed to prove, and what is still awaiting in-game verification." },
    "zh-cn": { title: "深海迷航2 攻略来源与证据规则", description: "本站每条事实的来源、该来源被允许证明什么，以及哪些内容仍待游戏内验证。" },
    ru: { title: "Subnautica 2: Источники и правила доказательств", description: "Откуда взяты факты, что может подтвердить каждый источник и что ещё ждёт проверки в игре." },
  },
};

const nameOf = (english, locale, localizedNames) => localizedNames[english]?.[locale] ?? english;

function itemMeta(item, locale, localizedNames) {
  const name = nameOf(item.title, locale, localizedNames);
  const recipe = item.recipes?.[0];
  const station = recipe?.station ? nameOf(recipe.station, locale, localizedNames) : null;
  const ingredients = recipe?.ingredients?.map((ing) => nameOf(ing.item, locale, localizedNames)).filter(Boolean) ?? [];
  const fragments = item.unlock?.fragments ?? null;
  const biomes = cleanBiomes(item.unlock?.biomes).map((b) => nameOf(b, locale, localizedNames));
  if (locale === "zh-cn") {
    const parts = [];
    if (station) parts.push(`在${station}制作`);
    if (ingredients.length) parts.push(`需要${ingredients.slice(0, 3).join("、")}${ingredients.length > 3 ? "等" : ""}`);
    if (fragments) parts.push(`解锁需 ${fragments} 个碎片`);
    if (biomes.length) parts.push(`出没于${biomes.slice(0, 2).join("、")}`);
    return {
      title: clamp(`${name} 怎么做？配方与获取 · ${GAME_ZH}`, 60),
      description: clamp(`${GAME_ZH} ${name}：${parts.join("；")}。数据取自官方 Wiki 永久修订版本。`, 158),
    };
  }
  if (locale === "ru") {
    const parts = [];
    if (station) parts.push(`создаётся на «${station}»`);
    if (ingredients.length) parts.push(`ингредиенты: ${ingredients.slice(0, 3).join(", ")}`);
    if (fragments) parts.push(`нужно ${fragments} фрагментов`);
    if (biomes.length) parts.push(`биомы: ${biomes.slice(0, 2).join(", ")}`);
    return {
      title: clamp(`${name} — крафт и получение | ${SITE_SUFFIX}`, 60),
      description: clamp(`${name} в Subnautica 2: ${parts.join("; ")}. Данные из постоянной ревизии официальной вики.`, 158),
    };
  }
  const parts = [];
  if (station) parts.push(`built at the ${station}`);
  if (ingredients.length) parts.push(`needs ${ingredients.slice(0, 3).join(", ")}${ingredients.length > 3 ? " and more" : ""}`);
  if (fragments) parts.push(`${fragments} fragments to unlock`);
  if (biomes.length) parts.push(`found in ${biomes.slice(0, 2).join(" and ")}`);
  return {
    title: clamp(`${item.title} Recipe & How to Get | Subnautica 2`, 60),
    description: clamp(`How to get ${item.title} in Subnautica 2: ${parts.join(", ")}. Checked against a permanent revision of the official Wiki.`, 158),
  };
}

function entityMeta(entity, locale, localizedNames, uses) {
  const name = nameOf(entity.title, locale, localizedNames);
  const f = entity.facts ?? {};
  const biomes = cleanBiomes(f.biomes).map((b) => nameOf(b, locale, localizedNames));
  const zh = locale === "zh-cn";
  const ru = locale === "ru";
  const kind = entity.kind;
  if (kind === "resources") {
    const src = f.source ? nameOf(f.source, locale, localizedNames) : null;
    const useList = (uses ?? []).slice(0, 3).map((u) => nameOf(u, locale, localizedNames));
    if (zh) return { title: clamp(`${name} 在哪找？获取与用途 · ${GAME_ZH}`, 60), description: clamp(`${GAME_ZH} ${name}：${src ? `由${src}掉落，` : ""}${biomes.length ? `出现在${biomes.slice(0, 2).join("、")}，` : ""}${useList.length ? `可合成${useList.join("、")}。` : ""}数据来自官方 Wiki。`, 158) };
    if (ru) return { title: clamp(`${name} — где найти и для чего | ${SITE_SUFFIX}`, 60), description: clamp(`${name} в Subnautica 2: ${src ? `падает с ${src}, ` : ""}${biomes.length ? `биомы: ${biomes.slice(0, 2).join(", ")}, ` : ""}${useList.length ? `крафт: ${useList.join(", ")}.` : ""}Данные из вики.`, 158) };
    return { title: clamp(`Where to Find ${entity.title} | Subnautica 2`, 60), description: clamp(`Where to get ${entity.title} in Subnautica 2${src ? ` (dropped by ${src})` : ""}${biomes.length ? ` in ${biomes.slice(0, 2).join(" and ")}` : ""}${useList.length ? `, and what it crafts into: ${useList.join(", ")}` : ""}.`, 158) };
  }
  if (kind === "creatures") {
    const attitude = f.attitude ? nameOf(f.attitude, locale, localizedNames) : null;
    const nutrition = f.nutrition ?? null;
    if (zh) return { title: clamp(`${name} 在哪？习性与掉落 · ${GAME_ZH}`, 60), description: clamp(`${GAME_ZH} ${name}：${biomes.length ? `出没于${biomes.slice(0, 3).join("、")}，` : ""}${attitude ? `性情${attitude}，` : ""}${nutrition ? `${nutrition}。` : ""}数据来自官方 Wiki。`, 158) };
    if (ru) return { title: clamp(`${name} — где найти и поведение | ${SITE_SUFFIX}`, 60), description: clamp(`${name} в Subnautica 2: ${biomes.length ? `обитает в ${biomes.slice(0, 3).join(", ")}, ` : ""}${attitude ? `отношение: ${attitude}, ` : ""}${nutrition ? `${nutrition}.` : ""}Данные из вики.`, 158) };
    return { title: clamp(`${entity.title}: Habitat, Danger & Drops | Subnautica 2`, 60), description: clamp(`${entity.title} in Subnautica 2${biomes.length ? ` lives in ${biomes.slice(0, 3).join(", ")}` : ""}${attitude ? ` and is ${attitude.toLowerCase()} toward players` : ""}${nutrition ? `. ${nutrition}` : ""}.`, 158) };
  }
  if (kind === "biomes") {
    const poi = f.pointsOfInterest ?? [];
    if (zh) return { title: clamp(`${name}：深度与地点 · ${GAME_ZH}`, 60), description: clamp(`${GAME_ZH} ${name} 深度 ${f.depth ?? "未记录"}${poi.length ? `，关键地点含${poi.slice(0, 2).join("、")}` : ""}。出发前可用于规划下潜路线。`, 158) };
    if (ru) return { title: clamp(`${name} — глубина и точки | ${SITE_SUFFIX}`, 60), description: clamp(`Биом ${name} в Subnautica 2: глубина ${f.depth ?? "не записана"}${poi.length ? `, точки интереса: ${poi.slice(0, 2).join(", ")}` : ""}.`, 158) };
    return { title: clamp(`${entity.title} Biome: Depth & Locations | Subnautica 2`, 60), description: clamp(`${entity.title} in Subnautica 2: depth range ${f.depth ?? "not recorded"}${poi.length ? `, with ${poi.length} documented points of interest such as ${poi.slice(0, 2).join(" and ")}` : ""}.`, 158) };
  }
  if (kind === "vehicles") {
    if (zh) return { title: clamp(`${name}：深度、模块与解锁 · ${GAME_ZH}`, 60), description: clamp(`${GAME_ZH} ${name}：${f.depth ? `最大深度 ${f.depth}，` : ""}${f.speed ? `速度 ${f.speed}，` : ""}${f.fragments ? `解锁需 ${f.fragments} 个碎片。` : ""}数据来自官方 Wiki。`, 158) };
    if (ru) return { title: clamp(`${name} — глубина и модули | ${SITE_SUFFIX}`, 60), description: clamp(`Транспорт ${name} в Subnautica 2: ${f.depth ? `глубина ${f.depth}, ` : ""}${f.speed ? `скорость ${f.speed}, ` : ""}${f.fragments ? `нужно ${f.fragments} фрагментов.` : ""}`, 158) };
    return { title: clamp(`${entity.title}: Depth, Modules & Unlock | Subnautica 2`, 60), description: clamp(`The ${entity.title} in Subnautica 2${f.depth ? ` reaches ${f.depth}` : ""}${f.fragments ? ` and needs ${f.fragments} fragments to unlock` : ""}${f.speed ? `, speed ${f.speed}` : ""}.`, 158) };
  }
  return null;
}

function questionMeta(question, locale) {
  const q = question.question[locale] ?? question.question.en;
  const a = question.answer[locale] ?? question.answer.en;
  const label = locale === "zh-cn" ? GAME_ZH : locale === "ru" ? "Subnautica 2" : "Subnautica 2";
  return {
    title: clamp(`${q.replace(/[?？]$/, "")}${/[?？]$/.test(q) ? "" : "?"} | ${label}`, 62),
    description: clamp(`${a}`, 158),
  };
}

export function buildSeoMeta({ pagePath, locale, items, entities, playerQuestions, localizedNames, usesByTitle }) {
  const unlocalized = pagePath.replace(/^(?:en|zh-cn|ru)\//, "");
  if (corePageMeta[unlocalized]) return corePageMeta[unlocalized][locale] ?? corePageMeta[unlocalized].en;
  const entityMatch = unlocalized.match(/^guide\/(items|resources|creatures|biomes|vehicles)\/([^/]+)\.html$/);
  if (entityMatch) {
    const [, kind, id] = entityMatch;
    if (kind === "items") {
      const item = items.find((entry) => entry.id === id);
      if (item) return itemMeta(item, locale, localizedNames);
    } else {
      const entity = entities.find((entry) => entry.kind === kind && entry.id === id);
      if (entity) return entityMeta(entity, locale, localizedNames, usesByTitle.get(entity.title) ?? []);
    }
  }
  const questionMatch = unlocalized.match(/^questions\/([^/]+)\.html$/);
  if (questionMatch) {
    const question = playerQuestions.find((entry) => entry.id === questionMatch[1]);
    if (question) return questionMeta(question, locale);
  }
  return null;
}

// 覆盖 <title> 与 <meta name="description">，并补 og/twitter 卡片标签。
// 必须幂等：index.html 及其语言副本不会被任何 import 脚本重新生成，
// 若每次 enhance 都追加一套 og 标签，定时同步会让它们无限增长。
export function applySeoMeta(html, meta, pagePath = "") {
  if (!meta?.title || !meta.description) return html;
  const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(meta.description)}">`);
  // 先清掉历史注入的同类标签（含早期非幂等版本留下的重复项），再插入唯一一份。
  out = out
    .replace(/<meta property="og:title" content="[^"]*">/g, "")
    .replace(/<meta property="og:description" content="[^"]*">/g, "")
    .replace(/<meta name="twitter:card" content="[^"]*">/g, "")
    .replace(/<meta property="og:type" content="[^"]*">/g, "");
  // og:type 按页面性质取值：站点首页是 website，其余是 article
  const ogType = /(^|\/)index\.html$/.test(pagePath) ? "website" : "article";
  const tags = `<meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.description)}"><meta property="og:type" content="${ogType}"><meta name="twitter:card" content="summary_large_image">`;
  if (/<meta name="theme-color"/.test(out)) {
    out = out.replace(/<meta name="theme-color"/, `${tags}<meta name="theme-color"`);
  } else if (/<meta name="viewport"[^>]*>/.test(out)) {
    out = out.replace(/<meta name="viewport"[^>]*>/, (m) => `${m}${tags}`);
  } else {
    out = out.replace("</head>", `${tags}</head>`);
  }
  if (!/<meta name="description"/.test(out)) {
    out = out.replace("</head>", `<meta name="description" content="${esc(meta.description)}"></head>`);
  }
  // 收敛因非幂等版本产生的残留空行
  return out.replace(/<head>\s+/, "<head>");
}
