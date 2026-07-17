(() => {
  "use strict";
  const base = "/subnautica-2-guide/";
  const locale = location.pathname.match(/\/subnautica-2-guide\/(en|zh-cn|ru)(?:\/|$)/)?.[1] ?? "";
  const copies = {
    en: { placeholder: "Search a player problem, item, creature, or biome…", hint: "Ask naturally: where is it, why is it stuck, or how do I craft it?", empty: "No matching answers", loadingError: "The search index could not be loaded. Close and try again.", results: "results", search: "Search", close: "Close search", status: { solved: "Solved", partial: "Partial", open: "Open" }, comments: "comments", types: { Question: "Player question" } },
    "zh-cn": { placeholder: "搜索玩家问题、物品、生物或生态区…", hint: "可以直接问：在哪里、为什么卡住、怎么制作？", empty: "没有匹配答案", loadingError: "搜索数据加载失败，请关闭后重试。", results: "条结果", search: "搜索", close: "关闭搜索", status: { solved: "已解决", partial: "部分解决", open: "仍待解决" }, comments: "条评论", types: { Guide: "攻略", Question: "玩家问题", Item: "物品", Resource: "资源", Creature: "生物", Vehicle: "载具", Biome: "生态区" } },
    ru: { placeholder: "Поиск проблемы, предмета, существа или биома…", hint: "Спросите: где найти, почему застряло или как создать?", empty: "Подходящих ответов нет", loadingError: "Не удалось загрузить поиск. Закройте окно и попробуйте снова.", results: "результатов", search: "Поиск", close: "Закрыть поиск", status: { solved: "Решено", partial: "Частично", open: "Открыто" }, comments: "комментариев", types: { Guide: "Гайд", Question: "Вопрос игрока", Item: "Предмет", Resource: "Ресурс", Creature: "Существо", Vehicle: "Транспорт", Biome: "Биом" } },
  };
  const copy = copies[locale || "en"];
  const localizedTitle = (entry) => entry.localizedTitles?.[locale] ?? "";
  const localizedAnswer = (entry) => entry.localizedAnswers?.[locale] ?? entry.answer ?? "";
  const typeName = (type) => copy.types[type] || type;
  const escapeAttribute = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  document.querySelectorAll(".global-search-trigger span:nth-child(2)").forEach((node) => { node.textContent = copy.search; });
  document.querySelectorAll(".global-search-trigger").forEach((node) => { node.setAttribute("aria-label", copy.search); });
  const dialog = document.createElement("dialog");
  dialog.className = "search-dialog";
  dialog.innerHTML = `<div class="search-dialog__head"><input type="search" autocomplete="off" aria-label="${copy.search}" placeholder="${copy.placeholder}"><button class="search-dialog__close" type="button" aria-label="${copy.close}">×</button></div><p class="search-dialog__hint">${copy.hint}</p><p class="search-dialog__status sr-only" aria-live="polite"></p><ul class="search-results"></ul>`;
  document.body.append(dialog);
  const input = dialog.querySelector("input"), results = dialog.querySelector(".search-results"), liveStatus = dialog.querySelector(".search-dialog__status");
  let entries = [];
  let opener = null;
  const route = (href) => `${base}${locale ? `${locale}/` : ""}${href}`;
  let searchEventTimer = 0;
  const render = () => {
    const q = input.value.trim().toLocaleLowerCase(), tokens = q.split(/\s+/).filter(Boolean);
    const pool = q ? entries : entries.filter((entry) => entry.type === "Guide" || (entry.type === "Question" && entry.featuredRank));
    const found = pool.filter((entry) => {
      const haystack = `${entry.title} ${entry.type} ${entry.terms} ${localizedTitle(entry)} ${entry.localizedTerms?.[locale] ?? ""}`.toLocaleLowerCase();
      if (tokens.every((token) => haystack.includes(token))) return true;
      if (!/[\u3400-\u9fff]/.test(q)) return false;
      const compact = q.replace(/\s+/g, ""), compactHaystack = haystack.replace(/\s+/g, "");
      const pairs = [...compact].slice(0, -1).map((character, index) => `${character}${[...compact][index + 1]}`);
      return pairs.length > 0 && pairs.filter((pair) => compactHaystack.includes(pair)).length >= Math.ceil(pairs.length / 2);
    }).sort((a, b) => {
      const titleA = `${localizedTitle(a)} ${a.title}`.trim().toLocaleLowerCase(), titleB = `${localizedTitle(b)} ${b.title}`.trim().toLocaleLowerCase();
      const score = (title) => title === q ? 0 : title.startsWith(q) ? 1 : title.includes(q) ? 2 : 3;
      const typeScore = (entry) => entry.type === "Question" ? 0 : entry.type === "Guide" ? 1 : 2;
      return score(titleA) - score(titleB) || typeScore(a) - typeScore(b) || (a.featuredRank ?? 99) - (b.featuredRank ?? 99) || titleA.localeCompare(titleB);
    }).slice(0, 24);
    liveStatus.textContent = `${found.length} ${copy.results}`;
    clearTimeout(searchEventTimer);
    if (q.length >= 2) searchEventTimer = setTimeout(() => window.guideAnalytics?.track("view_search_results", { search_term: q, result_count: found.length }), 700);
    if (!found.length) { results.innerHTML = `<li class="search-empty">${copy.empty}</li>`; return; }
    results.innerHTML = found.map((entry) => {
      const translated = localizedTitle(entry), title = translated || entry.title;
      const answer = entry.type === "Question" ? `<span class="search-result__answer">${localizedAnswer(entry)}</span>` : "";
      const questionMeta = entry.type === "Question" ? `<small class="search-result__status search-result__status--${entry.resolution}">${copy.status[entry.resolution]}</small><small>↑ ${entry.attention.upvotes} · ${entry.attention.comments} ${copy.comments}</small>` : "";
      return `<li class="search-result search-result--${entry.type.toLocaleLowerCase()}"><a href="${route(entry.href)}" data-search-title="${escapeAttribute(title)}" data-search-type="${entry.type}">${entry.image ? `<img src="${entry.image}" width="52" height="52" loading="lazy" alt="">` : `<span class="search-result__blank" aria-hidden="true">${typeName(entry.type).slice(0, 1)}</span>`}<span><strong>${title}</strong>${answer}<span class="search-result__meta"><small>${typeName(entry.type)}</small>${questionMeta}</span></span><span class="search-result__arrow" aria-hidden="true">→</span></a></li>`;
    }).join("");
  };
  const open = async (seed = "") => {
    opener = document.activeElement;
    try {
      if (!entries.length) entries = (await fetch(`${base}data/search-index.json?v=4`).then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })).entries;
      input.value = seed; render(); dialog.showModal(); input.focus(); window.guideAnalytics?.track("search_open", { search_term: seed || undefined });
    } catch {
      dialog.showModal(); results.innerHTML = `<li class="search-empty">${copy.loadingError}</li>`;
    }
  };
  document.querySelectorAll(".global-search-trigger").forEach((button) => button.addEventListener("click", () => open()));
  document.querySelectorAll("[data-global-search]").forEach((field) => { field.addEventListener("focus", () => { field.blur(); open(field.value); }); field.addEventListener("click", () => open(field.value)); });
  input.addEventListener("input", render);
  results.addEventListener("click", (event) => { const link = event.target.closest("a[data-search-title]"); if (link) window.guideAnalytics?.track("select_content", { content_type: link.dataset.searchType, item_id: link.dataset.searchTitle, search_term: input.value.trim() }); });
  dialog.querySelector(".search-dialog__close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { if (opener instanceof HTMLElement) opener.focus(); });
  document.addEventListener("keydown", (event) => { if (event.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName)) { event.preventDefault(); open(); } });
})();
