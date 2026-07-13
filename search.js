(() => {
  "use strict";
  const base = "/subnautica-2-guide/";
  const locale = location.pathname.match(/\/subnautica-2-guide\/(en|zh-cn|ru)(?:\/|$)/)?.[1] ?? "";
  const copies = {
    en: { placeholder: "Search guides, items, creatures, biomes…", hint: "Search game names, ingredients, crafting stations, and guide topics", empty: "No matching records", search: "Search", close: "Close search", types: {} },
    "zh-cn": { placeholder: "搜索攻略、物品、生物、生态区…", hint: "支持中文与英文游戏名、材料、制作站和攻略主题", empty: "没有匹配结果", search: "搜索", close: "关闭搜索", types: { Guide: "攻略", Item: "物品", Resource: "资源", Creature: "生物", Vehicle: "载具", Biome: "生态区" } },
    ru: { placeholder: "Поиск по гайдам, предметам, биомам…", hint: "Ищите названия, материалы, станции и темы", empty: "Ничего не найдено", search: "Поиск", close: "Закрыть поиск", types: { Guide: "Гайд", Item: "Предмет", Resource: "Ресурс", Creature: "Существо", Vehicle: "Транспорт", Biome: "Биом" } },
  };
  const copy = copies[locale || "en"];
  const zhNames = {
    "Start here": "开局攻略", "Find starter materials": "寻找开局材料", "Blueprint checklist": "蓝图清单", "Equipment upgrades": "装备升级", "Tadpole vehicle planner": "Tadpole 载具规划", "Key locations": "关键地点", "Base building": "基地建造", "Co-op reference": "联机参考",
    Scanner: "扫描仪", "Habitat Builder": "建造工具", "Repair Tool": "维修工具", "Standard Air Tank": "标准氧气瓶", "High Capacity Air Tank": "大容量氧气瓶", "Ultra High Capacity Air Tank": "超大容量氧气瓶", "Basic Fins": "基础脚蹬", "Improved Fins": "改良脚蹬", Rebreather: "循环呼吸器", "Air Bladder": "浮力气囊", Flashlight: "手电筒", Beacon: "信标", "Basic Battery": "基础电池", "Advanced Battery": "高级电池", "Power Cell": "动力电池", "Wiring Kit": "接线盒", "Advanced Wiring Kit": "高级接线盒", "Fiber Mesh": "纤维网", "Copper Wire": "铜线", Glass: "玻璃", Rubber: "橡胶", Titanium: "钛", Copper: "铜", Quartz: "石英", Silver: "银", Gold: "金", Lead: "铅", Lithium: "锂", Sulfur: "硫", Salt: "盐", Water: "水", "Titanium Ingot": "钛锭", "Copper Ingot": "铜锭", "Silver Ingot": "银锭", "Gold Ingot": "金锭", "Plasteel Ingot": "塑钢锭", Fabricator: "制造台", "Modification Station": "改装台", "Vehicle Fabricator": "载具制造台", Moonpool: "月池", Shallows: "浅水区", Tadpole: "蝌蚪号",
  };
  const ruNames = {
    "Start here": "Начало игры", "Find starter materials": "Поиск начальных материалов", "Blueprint checklist": "Список чертежей", "Equipment upgrades": "Улучшения снаряжения", "Tadpole vehicle planner": "План транспорта Tadpole", "Key locations": "Ключевые места", "Base building": "Строительство базы", "Co-op reference": "Кооператив",
    Scanner: "Сканер", "Habitat Builder": "Строитель", "Repair Tool": "Ремонтный инструмент", "Standard Air Tank": "Стандартный кислородный баллон", "High Capacity Air Tank": "Кислородный баллон большой ёмкости", "Basic Fins": "Ласты", Rebreather: "Ребризер", Flashlight: "Фонарь", Beacon: "Маяк", "Basic Battery": "Батарея", "Power Cell": "Энергоячейка", "Copper Wire": "Медная проволока", Glass: "Стекло", Rubber: "Резина", Titanium: "Титан", Copper: "Медь", Quartz: "Кварц", Silver: "Серебро", Gold: "Золото", Lead: "Свинец", Lithium: "Литий", Sulfur: "Сера", Salt: "Соль", Water: "Вода", Fabricator: "Изготовитель", Moonpool: "Стыковочная шахта", Shallows: "Мелководье", Tadpole: "Tadpole",
  };
  const localizedTitle = (entry) => locale === "zh-cn" ? (zhNames[entry.title] ?? "") : locale === "ru" ? (ruNames[entry.title] ?? "") : "";
  const typeName = (type) => copy.types[type] || type;
  document.querySelectorAll(".global-search-trigger span:nth-child(2)").forEach((node) => { node.textContent = copy.search; });
  document.querySelectorAll(".global-search-trigger").forEach((node) => { node.setAttribute("aria-label", copy.search); });
  const dialog = document.createElement("dialog");
  dialog.className = "search-dialog";
  dialog.innerHTML = `<div class="search-dialog__head"><input type="search" autocomplete="off" aria-label="${copy.search}" placeholder="${copy.placeholder}"><button class="search-dialog__close" type="button" aria-label="${copy.close}">×</button></div><p class="search-dialog__hint">${copy.hint}</p><ul class="search-results"></ul>`;
  document.body.append(dialog);
  const input = dialog.querySelector("input"), results = dialog.querySelector(".search-results");
  let entries = [];
  const route = (href) => `${base}${locale ? `${locale}/` : ""}${href}`;
  const render = () => {
    const q = input.value.trim().toLocaleLowerCase(), tokens = q.split(/\s+/).filter(Boolean);
    const pool = q ? entries : entries.filter((entry) => entry.type === "Guide");
    const found = pool.filter((entry) => tokens.every((token) => `${entry.title} ${entry.type} ${entry.terms} ${localizedTitle(entry)}`.toLocaleLowerCase().includes(token))).sort((a, b) => {
      const titleA = `${localizedTitle(a)} ${a.title}`.trim().toLocaleLowerCase(), titleB = `${localizedTitle(b)} ${b.title}`.trim().toLocaleLowerCase();
      const score = (title) => title === q ? 0 : title.startsWith(q) ? 1 : title.includes(q) ? 2 : 3;
      return score(titleA) - score(titleB) || titleA.localeCompare(titleB);
    }).slice(0, 24);
    if (!found.length) { results.innerHTML = `<li class="search-empty">${copy.empty}</li>`; return; }
    results.innerHTML = found.map((entry) => {
      const translated = localizedTitle(entry), title = translated || entry.title;
      const original = translated && translated !== entry.title ? `<small lang="en">${entry.title}</small>` : "";
      return `<li class="search-result"><a href="${route(entry.href)}">${entry.image ? `<img src="${entry.image}" width="52" height="52" loading="lazy" alt="">` : `<span class="search-result__blank" aria-hidden="true">${typeName(entry.type).slice(0, 1)}</span>`}<span><strong>${title}</strong><span class="search-result__meta"><small>${typeName(entry.type)}</small>${original}</span></span><span class="search-result__arrow" aria-hidden="true">→</span></a></li>`;
    }).join("");
  };
  const open = async (seed = "") => {
    if (!entries.length) entries = (await fetch(`${base}data/search-index.json`).then((response) => response.json())).entries;
    input.value = seed; render(); dialog.showModal(); input.focus();
  };
  document.querySelectorAll(".global-search-trigger").forEach((button) => button.addEventListener("click", () => open()));
  document.querySelectorAll("[data-global-search]").forEach((field) => { field.addEventListener("focus", () => { field.blur(); open(field.value); }); field.addEventListener("click", () => open(field.value)); });
  input.addEventListener("input", render);
  dialog.querySelector(".search-dialog__close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName)) { event.preventDefault(); open(); } });
})();
