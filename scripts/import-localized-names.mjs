import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://subnautica2-wiki.com";
const pages = ["items", "base-building", "modules", "vehicles", "lifeforms", "resources", "biomes"];

// Names absent from the extracted-language index. These are community translations,
// kept separate from imported game-language names so provenance remains explicit.
const community = {
  "Acid Raion": ["酸液囊巢虫", "Рейон кислотогенный"],
  Atacamite: ["氯铜矿", "Атакамит"],
  Celestine: ["天青石", "Целестин"],
  "Conduit Crystal": ["导管晶体", "Проводящий кристалл"],
  "Creature Enamel": ["生物珐琅质", "Эмаль существа"],
  "CHBC Live Poster": ["CHBC 纪念海报", "Плакат в память о CHBC"],
  Fiber: ["纤维", "Волокно"],
  "Fibrous Pulp": ["纤维浆", "Волокнистая масса"],
  "Germanium Ingot": ["锗锭", "Слиток германия"],
  Hatch: ["舱门", "Люк"],
  "Hoverthorn Souvlaki": ["悬浮刺鱼烤串", "Сувлаки из иглохвоста"],
  "Interior Arch": ["室内拱门", "Внутренняя арка"],
  "Interior Door": ["室内门", "Внутренняя дверь"],
  "LeviathanAwakens Poster": ["利维坦觉醒海报", "Плакат «Левиафан пробуждается»"],
  Lithium: ["锂", "Литий"],
  "Macaron Sponge": ["马卡龙海绵", "Губка-макарон"],
  "Metal Farm": ["金属农场", "Металлическая ферма"],
  "Necrolei Bud": ["尼克罗蕾花苞", "Бутон некролеи"],
  Pent: ["五角舱", "Пятиугольный модуль"],
  "Plasteel Ingot": ["塑钢锭", "Слиток пластали"],
  Rubber: ["橡胶", "Резина"],
  "Tadpole Scout Ray Chassis": ["蝌蚪号侦察鳐底盘", "Шасси «Скат» для «Головастика»"],
  Troilite: ["磁黄铁矿", "Троилит"],
  "Urchin Pudding": ["海胆布丁", "Пудинг из морского ежа"],
  "Vehicle Fabricator": ["载具制造台", "Изготовитель транспорта"],
  Window: ["窗户", "Окно"],
  "Acidic Raion Pouch": ["酸性囊巢虫囊袋", "Кислотный мешок рейона"],
  "Axum Bacterial Culture": ["阿克苏姆细菌培养物", "Бактериальная культура аксумов"],
  "Dolerite Spires": ["辉绿岩尖塔", "Долеритовые шпили"],
  "Elusive Leviathan": ["隐匿利维坦", "Неуловимый левиафан"],
  Fluttertail: ["飘尾鱼", "Парохвост"],
  "Karakorum Metal Farms": ["喀喇昆仑金属农场", "Металлические фермы Каракорума"],
  "Karakorum Power Plant": ["喀喇昆仑发电站", "Электростанция Каракорума"],
  "Lead Zone": ["铅区", "Свинцовая зона"],
  "Medical Gel Sac": ["医疗凝胶囊", "Мешок медицинского геля"],
  Microshrimp: ["微型虾", "Микрокреветка"],
  "Mirror Halfmoon": ["镜月鱼", "Зеркальный полумесяц"],
  "Necrolei Hills": ["尼克罗蕾丘陵", "Холмы Некролеи"],
  "North Raceway": ["北部赛道", "Северная трасса"],
  "Pelagic Ghost": ["远洋幽灵", "Пелагический призрак"],
  "Ringbearer Krill": ["承环磷虾", "Кольценосный криль"],
  "Root Canyon": ["根系峡谷", "Корневой каньон"],
  "Sandspear Juvenile": ["潜沙矛幼体", "Молодой копейник"],
  "South Raceway": ["南部赛道", "Южная трасса"],
  "Tar Eel": ["焦油鳗", "Смоляной угорь"],
  "Vep Defender": ["Vep 防御者", "Защитник Vep"],
  "Vep Sensor": ["Vep 传感者", "Сенсор Vep"],
  "Vep Worker": ["Vep 工作者", "Рабочий Vep"],
  Void: ["虚空", "Пустота"],
  "World Tree": ["世界树", "Мировое древо"],
  "Pudding Urchin": ["布丁海胆", "Пудинговый морской ёж"],
  "Titanium node": ["钛矿脉", "Титановая жила"],
  "Titanium deposit": ["钛矿床", "Месторождение титана"],
  "Quartz node": ["石英矿脉", "Кварцевая жила"],
  "Quartz deposit": ["石英矿床", "Месторождение кварца"],
  "Silver node": ["银矿脉", "Серебряная жила"],
  "Silver deposit": ["银矿床", "Месторождение серебра"],
  "Sulfur node": ["硫矿脉", "Серная жила"],
  "Copper node": ["铜矿脉", "Медная жила"],
  "Copper deposit": ["铜矿床", "Месторождение меди"],
  "Celestine deposit": ["天青石矿床", "Месторождение целестина"],
  "Gold node": ["金矿脉", "Золотая жила"],
  "Gold deposit": ["金矿床", "Месторождение золота"],
  "Lithium deposit": ["锂矿床", "Месторождение лития"],
  "Salt node": ["盐矿脉", "Соляная жила"],
  "Salt deposit": ["盐矿床", "Месторождение соли"],
  "Lead node": ["铅矿脉", "Свинцовая жила"],
  "Lead deposit": ["铅矿床", "Месторождение свинца"],
  "Atacamite deposit": ["氯铜矿矿床", "Месторождение атакамита"],
};

const decode = (value) => value
  .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
  .replace(/\\"/g, '"')
  .replace(/\\n/g, "\n")
  .replace(/\\\\/g, "\\");

function parseRows(html) {
  return [...html.matchAll(/slug:"((?:\\.|[^"])*)",[^{}]{0,300}?display_name:"((?:\\.|[^"])*)"/g)]
    .map((match) => ({ slug: decode(match[1]), name: decode(match[2]) }));
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "subnautica-2-guide-localization-import/1.0" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message}`);
}

const [items, entities] = await Promise.all([
  readFile(path.join(root, "data", "wiki-items.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data", "wiki-entities.json"), "utf8").then(JSON.parse),
]);
const wanted = [...new Set([
  ...items.items.filter((item) => item.status === "wiki-backed").map((item) => item.title),
  ...entities.entities.filter((entity) => entity.status === "wiki-backed").map((entity) => entity.title),
])].sort((a, b) => a.localeCompare(b));

const localizedRows = { en: new Map(), zh: new Map(), ru: new Map() };
for (const locale of Object.keys(localizedRows)) {
  for (const page of pages) {
    const url = `${origin}/${locale}/${page}`;
    for (const row of parseRows(await fetchText(url))) localizedRows[locale].set(`${page}/${row.slug}`, row.name);
  }
}

const imported = new Map();
for (const [key, english] of localizedRows.en) {
  const chinese = localizedRows.zh.get(key);
  const russian = localizedRows.ru.get(key);
  if (chinese && russian && !imported.has(english)) imported.set(english, {
    "zh-cn": chinese,
    ru: russian,
    provenance: "game-language-data",
    sourceUrl: `${origin}/en/${key}`,
  });
}

const names = Object.fromEntries([...imported.entries()].filter(([english, entry]) => entry["zh-cn"] !== english && entry.ru !== english));
for (const [english, [chinese, russian]] of Object.entries(community)) {
  names[english] = {
    "zh-cn": chinese,
    ru: russian,
    provenance: "community-translation",
    sourceUrl: null,
  };
}
for (const english of wanted) {
  const importedName = imported.get(english);
  if (community[english]) names[english] = {
    "zh-cn": community[english][0],
    ru: community[english][1],
    provenance: "community-translation",
    sourceUrl: null,
  };
  else if (importedName && importedName["zh-cn"] !== english && importedName.ru !== english) names[english] = importedName;
}

const missing = wanted.filter((name) => !names[name]?.["zh-cn"] || !names[name]?.ru);
if (missing.length) throw new Error(`Missing localized names: ${missing.join(", ")}`);

const output = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  source: {
    name: "Subnautica 2 Wiki localized game-data index",
    url: `${origin}/en/items`,
    note: "Imported names use the site's localized game-data index. Explicit community translations fill records absent from that index.",
  },
  counts: {
    recordNames: wanted.length,
    total: Object.keys(names).length,
    imported: Object.values(names).filter((entry) => entry.provenance === "game-language-data").length,
    community: Object.values(names).filter((entry) => entry.provenance === "community-translation").length,
  },
  names,
};

await writeFile(path.join(root, "data", "localized-names.json"), `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`Imported ${output.counts.imported} localized names; added ${output.counts.community} explicit community translations.\n`);
