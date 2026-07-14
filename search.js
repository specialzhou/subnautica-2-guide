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
  const localizedTitle = (entry) => entry.localizedTitles?.[locale] ?? "";
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
    const found = pool.filter((entry) => tokens.every((token) => `${entry.title} ${entry.type} ${entry.terms} ${localizedTitle(entry)} ${entry.localizedTerms?.[locale] ?? ""}`.toLocaleLowerCase().includes(token))).sort((a, b) => {
      const titleA = `${localizedTitle(a)} ${a.title}`.trim().toLocaleLowerCase(), titleB = `${localizedTitle(b)} ${b.title}`.trim().toLocaleLowerCase();
      const score = (title) => title === q ? 0 : title.startsWith(q) ? 1 : title.includes(q) ? 2 : 3;
      return score(titleA) - score(titleB) || titleA.localeCompare(titleB);
    }).slice(0, 24);
    if (!found.length) { results.innerHTML = `<li class="search-empty">${copy.empty}</li>`; return; }
    results.innerHTML = found.map((entry) => {
      const translated = localizedTitle(entry), title = translated || entry.title;
      return `<li class="search-result"><a href="${route(entry.href)}">${entry.image ? `<img src="${entry.image}" width="52" height="52" loading="lazy" alt="">` : `<span class="search-result__blank" aria-hidden="true">${typeName(entry.type).slice(0, 1)}</span>`}<span><strong>${title}</strong><span class="search-result__meta"><small>${typeName(entry.type)}</small></span></span><span class="search-result__arrow" aria-hidden="true">→</span></a></li>`;
    }).join("");
  };
  const open = async (seed = "") => {
    if (!entries.length) entries = (await fetch(`${base}data/search-index.json?v=3`).then((response) => response.json())).entries;
    input.value = seed; render(); dialog.showModal(); input.focus();
  };
  document.querySelectorAll(".global-search-trigger").forEach((button) => button.addEventListener("click", () => open()));
  document.querySelectorAll("[data-global-search]").forEach((field) => { field.addEventListener("focus", () => { field.blur(); open(field.value); }); field.addEventListener("click", () => open(field.value)); });
  input.addEventListener("input", render);
  dialog.querySelector(".search-dialog__close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName)) { event.preventDefault(); open(); } });
})();
