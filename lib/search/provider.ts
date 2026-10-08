import type { Source } from "../schemas";

export interface SearchResult { title: string; url: string; snippet: string; sourceType: Source["sourceType"] }
export interface SearchProvider { name: string; search(query: string): Promise<SearchResult[]> }

/** MOCK: синтетические результаты для демо-режима. Не содержит реальных данных. */
export class MockSearchProvider implements SearchProvider {
  name = "mock";
  async search(query: string): Promise<SearchResult[]> {
    const q = query.toLowerCase();
    const all: SearchResult[] = [
      { title: "Официальный сайт (демо)", url: "https://demo.invalid/site", snippet: "Описание деятельности компании (демо-данные).", sourceType: "official_site" },
      { title: "Вакансии на hh.ru (демо)", url: "https://demo.invalid/hh", snippet: "12 открытых вакансий менеджеров по продажам за 30 дней (демо-данные).", sourceType: "vacancy" },
      { title: "Пресс-релиз (демо)", url: "https://demo.invalid/press", snippet: "Заключено партнёрское соглашение (демо-данные).", sourceType: "press_release" },
      { title: "ФНС России: выписка из ЕГРЮЛ (демо)", url: "https://demo.invalid/egrul", snippet: "Компания действующая (демо-данные).", sourceType: "gov" },
    ];
    if (q.includes("вакан")) return [all[1]];
    if (q.includes("новост")) return [all[2]];
    if (q.includes("егрюл")) return [all[3]];
    return [all[0]];
  }
}

/** Реальный провайдер на Tavily (не проверен без ключа). Заменяется любым другим, реализующим SearchProvider. */
export class TavilySearchProvider implements SearchProvider {
  name = "tavily";
  constructor(private apiKey: string) {}
  async search(query: string): Promise<SearchResult[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: this.apiKey, query, max_results: 5 }),
    });
    if (!res.ok) throw new Error("Источник недоступен");
    const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
    return (data.results ?? []).map((r) => {
      const h = new URL(r.url).hostname;
      const sourceType: SearchResult["sourceType"] = h.includes("hh.ru") ? "vacancy" : /nalog\.gov|egrul|gov\.ru/.test(h) ? "gov" : "media";
      return { title: r.title, url: r.url, snippet: r.content, sourceType };
    });
  }
}

export function getSearchProvider(): SearchProvider {
  const key = process.env.SEARCH_API_KEY;
  return key ? new TavilySearchProvider(key) : new MockSearchProvider();
}
