import { AgentError, callJson, llmLive } from "../llm";
import { CompanyCoreSchema, CompanyResearchSchema, checkProvenance, NOT_FOUND, type CompanyCore, type CompanyResearch, type Source } from "../schemas";
import { getSearchProvider, type SearchProvider } from "../search/provider";

export type ResearchInput = { companyName?: string; inn?: string };

/** DEMO: детерминированные синтетические данные, привязанные к mock-источникам. Используется без ANTHROPIC_API_KEY. */
function demoCore(input: ResearchInput, s: Source[]): CompanyCore {
  const by = (t: Source["sourceType"]) => (s.find((x) => x.sourceType === t) ?? s[0]).id;
  const [site, hh, press, gov] = [by("official_site"), by("vacancy"), by("press_release"), by("gov")];
  return {
    company: { name: input.companyName ?? `Компания (ИНН ${input.inn})`, inn: input.inn ?? NOT_FOUND, industry: "Розничная торговля (демо-данные)", description: "Демо-описание: компания продаёт товары B2B и B2C через сайт и офлайн-точки.", website: "https://demo.invalid/site", location: NOT_FOUND, status: "Действующая (демо-данные)" },
    financials: [],
    signals: [
      { type: "hiring", kind: "FACT", claim: "Компания опубликовала 12 вакансий менеджеров по продажам за последние 30 дней.", evidence: "12 вакансий в категории продаж на hh.ru.", sourceId: hh, date: "2026-10-08", confidence: 0.9 },
      { type: "expansion", kind: "INFERENCE", claim: "Компания, вероятно, расширяет отдел продаж.", evidence: "Массовый набор менеджеров по продажам.", sourceId: hh, date: "2026-10-08", confidence: 0.75 },
      { type: "expansion", kind: "HYPOTHESIS", claim: "Рост отдела продаж может увеличить нагрузку на адаптацию сотрудников и контроль качества переговоров.", evidence: "Следствие предполагаемого расширения; прямых подтверждений нет.", sourceId: hh, date: null, confidence: 0.5 },
      { type: "partnership", kind: "FACT", claim: "Опубликовано сообщение о новом партнёрском соглашении.", evidence: "Пресс-релиз на официальной странице.", sourceId: press, date: "2026-09-20", confidence: 0.8 },
      { type: "product", kind: "FACT", claim: "На сайте описан продуктовый каталог для клиентов B2B.", evidence: "Раздел каталога на официальном сайте.", sourceId: site, date: null, confidence: 0.7 },
      { type: "risk", kind: "FACT", claim: "В выписке ЕГРЮЛ компания значится действующей.", evidence: "Статус «действующая» в выписке.", sourceId: gov, date: null, confidence: 0.85 },
    ],
    events: [{ date: "2026-09-20", event: "Партнёрское соглашение", sourceId: press }],
  };
}

export async function researchAgent(input: ResearchInput, search: SearchProvider = getSearchProvider()): Promise<CompanyResearch> {
  const companyName = input.companyName?.trim() || undefined;
  const inn = input.inn?.trim() || undefined;
  if (!companyName && !inn) throw new AgentError("Укажите название компании или ИНН.");
  if (inn && !/^\d{10}(\d{2})?$/.test(inn)) throw new AgentError("ИНН должен содержать 10 или 12 цифр.");

  const q = inn ?? companyName!;
  const settled = await Promise.allSettled([`${q} официальный сайт`, `${q} вакансии hh.ru`, `${q} новости`, `${q} ЕГРЮЛ ФНС`].map((x) => search.search(x)));
  const seen = new Set<string>();
  const results = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((r) => !seen.has(r.url) && seen.add(r.url));
  if (!results.length) throw new AgentError(settled.every((r) => r.status === "rejected") ? "Источник недоступен." : "Недостаточно публичных данных.");

  const now = new Date().toISOString().slice(0, 10);
  const sources: Source[] = results.map((r, i) => ({ id: `s${i + 1}`, title: r.title, url: r.url, sourceType: r.sourceType, retrievedAt: now }));
  const live = llmLive() && search.name !== "mock";
  const core = live
    ? await callJson(CompanyCoreSchema, "Ты — исследователь компаний. Используй ТОЛЬКО переданные результаты поиска. Каждый сигнал относится к типу FACT (прямо следует из источника), INFERENCE (вывод) или HYPOTHESIS (предположение) и ссылается на sourceId из списка. Нет данных — «Не найдено».",
        `Компания: ${companyName ?? ""} ИНН: ${inn ?? ""}\nДата: ${now}\nРезультаты поиска:\n${JSON.stringify(results.map((r, i) => ({ sourceId: `s${i + 1}`, title: r.title, url: r.url, text: r.snippet })))}`)
    : demoCore({ companyName, inn }, sources);

  const research = CompanyResearchSchema.parse({ ...core, sources, mode: live ? "live" : "demo" });
  const problems = checkProvenance(research);
  if (problems.length) throw new AgentError(`Нарушено происхождение данных: ${problems.join("; ")}`);
  return research;
}
