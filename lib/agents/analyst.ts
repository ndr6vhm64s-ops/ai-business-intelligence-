import { callJson, llmLive } from "../llm";
import { AnalysisSchema, CompanyResearchSchema, type Analysis, type CompanyResearch } from "../schemas";

/** Агент не ищет данные сам: получает только провалидированный CompanyResearch. */
export async function businessAnalystAgent(input: CompanyResearch): Promise<Analysis> {
  const research = CompanyResearchSchema.parse(input);
  if (research.mode === "live" && llmLive()) {
    return callJson(AnalysisSchema,
      "Ты — бизнес-аналитик. Найди бизнес-проблемы, операционные риски, точки роста и процессы, которые можно частично автоматизировать с помощью ИИ (повторяющиеся, ручные, документные, коммуникационные, контроль качества, классификация). Опирайся только на переданное исследование; sourceId бери из него. Оценки 1–5 (5 = максимум; для сложности 5 = очень сложно).",
      JSON.stringify(research));
  }
  const src = (research.signals.find((s) => s.type === "hiring") ?? research.signals[0]).sourceId;
  return AnalysisSchema.parse({
    summary: "Демо-анализ: компания наращивает продажи, что повышает нагрузку на обработку обращений и контроль качества.",
    findings: [
      { category: "problem", text: "Ручная обработка входящих обращений клиентов может не масштабироваться за ростом отдела продаж.", kind: "HYPOTHESIS", sourceId: src },
      { category: "risk", text: "Риск нестабильного качества переговоров при быстром найме менеджеров.", kind: "INFERENCE", sourceId: src },
    ],
    opportunities: [
      { id: "opp-1", title: "Автоматическая классификация обращений клиентов", problem: "Менеджеры вручную сортируют входящие обращения.", evidence: "Массовый набор менеджеров по продажам указывает на рост потока обращений.", sourceId: src, proposedSolution: "ИИ классифицирует обращения и направляет их нужной команде; при низкой уверенности — на ручную проверку.", expectedImpact: 4, frequency: 5, automationPotential: 4, implementationComplexity: 2, confidence: 0.8 },
      { id: "opp-2", title: "ИИ-контроль качества звонков менеджеров", problem: "Руководители не успевают выборочно прослушивать звонки новых сотрудников.", evidence: "Рост команды продаж усложняет контроль качества.", sourceId: src, proposedSolution: "Автоматическая оценка расшифровок звонков по чек-листу с выделением проблемных случаев.", expectedImpact: 4, frequency: 4, automationPotential: 3, implementationComplexity: 4, confidence: 0.6 },
      { id: "opp-3", title: "Автоматизация подготовки коммерческих предложений", problem: "Подготовка документов требует много ручной работы.", evidence: "Компания работает с B2B-клиентами (описание каталога на сайте).", sourceId: research.sources[0].id, proposedSolution: "Генерация черновика предложения по данным CRM с проверкой менеджером.", expectedImpact: 3, frequency: 4, automationPotential: 4, implementationComplexity: 3, confidence: 0.55 },
    ],
  });
}
