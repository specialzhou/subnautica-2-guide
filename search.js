(() => {
  "use strict";
  const base = "/subnautica-2-guide/";
  const locale = location.pathname.match(/\/subnautica-2-guide\/(en|zh-cn|ru)(?:\/|$)/)?.[1] ?? "";
  const copy = locale === "zh-cn" ? { placeholder: "搜索攻略、物品、生物、生态区…", hint: "可搜索英文游戏名、材料、制作站和攻略主题", empty: "没有匹配结果", search: "搜索" } : locale === "ru" ? { placeholder: "Поиск по гайдам, предметам, биомам…", hint: "Ищите названия, материалы, станции и темы", empty: "Ничего не найдено", search: "Поиск" } : { placeholder: "Search guides, items, creatures, biomes…", hint: "Search game names, ingredients, crafting stations, and guide topics", empty: "No matching records", search: "Search" };
  document.querySelectorAll(".global-search-trigger span:nth-child(2)").forEach((node) => { node.textContent = copy.search; });
  const dialog = document.createElement("dialog");
  dialog.className = "search-dialog";
  dialog.innerHTML = `<div class="search-dialog__head"><input type="search" autocomplete="off" aria-label="${copy.search}" placeholder="${copy.placeholder}"><button class="search-dialog__close" type="button" aria-label="Close">×</button></div><p class="search-dialog__hint">${copy.hint}</p><ul class="search-results"></ul>`;
  document.body.append(dialog);
  const input = dialog.querySelector("input");
  const results = dialog.querySelector(".search-results");
  let entries = [];
  const route = (href) => `${base}${locale ? `${locale}/` : ""}${href}`;
  const render = () => {
    const q = input.value.trim().toLocaleLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const found = entries.filter((entry) => tokens.every((token) => `${entry.title} ${entry.type} ${entry.terms}`.toLocaleLowerCase().includes(token))).sort((a, b) => {
      const titleA = a.title.toLocaleLowerCase(), titleB = b.title.toLocaleLowerCase();
      const score = (title) => title === q ? 0 : title.startsWith(q) ? 1 : title.includes(q) ? 2 : 3;
      return score(titleA) - score(titleB) || titleA.localeCompare(titleB);
    }).slice(0, 24);
    if (!found.length) { results.innerHTML = `<li class="search-empty">${copy.empty}</li>`; return; }
    results.innerHTML = found.map((entry) => `<li class="search-result"><a href="${route(entry.href)}">${entry.image ? `<img src="${entry.image}" width="52" height="52" loading="lazy" alt="">` : `<span class="search-result__blank" aria-hidden="true">${entry.type.slice(0, 1)}</span>`}<span><strong>${entry.title}</strong><small>${entry.type}</small></span><span class="search-result__arrow" aria-hidden="true">→</span></a></li>`).join("");
  };
  const open = async (seed = "") => {
    if (!entries.length) entries = (await fetch(`${base}data/search-index.json`).then((response) => response.json())).entries;
    input.value = seed;
    render();
    dialog.showModal();
    input.focus();
  };
  document.querySelectorAll(".global-search-trigger").forEach((button) => button.addEventListener("click", () => open()));
  document.querySelectorAll("[data-global-search]").forEach((field) => { field.addEventListener("focus", () => { field.blur(); open(field.value); }); field.addEventListener("click", () => open(field.value)); });
  input.addEventListener("input", render);
  dialog.querySelector(".search-dialog__close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName)) { event.preventDefault(); open(); } });
})();
