(() => {
  "use strict";
  const measurementId = "G-7R7JWG7M2S";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.append(script);
  }

  const track = (name, parameters = {}) => window.gtag("event", name, {
    page_language: document.documentElement.lang || "en",
    ...parameters,
  });
  window.guideAnalytics = { track };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const href = link.href;
    if (link.closest(".language-switcher")) {
      track("language_switch", { link_url: href, link_text: link.textContent.trim() });
    } else if (link.dataset.track === "question-card" || link.closest(".pain-feature,.pain-row,.quick-links")) {
      track("question_card_click", { link_url: href, question_id: link.dataset.questionId || href.match(/questions\/([^/.]+)\.html/)?.[1] || "unknown" });
    } else if (link.dataset.track === "reddit-source" || /reddit\.com\//.test(href)) {
      track("outbound_source_click", { link_url: href, source_type: "reddit" });
    } else if (link.origin !== location.origin) {
      track("outbound_source_click", { link_url: href, source_type: "external" });
    }
  });
})();
