// Запуск: npm run evals. Всегда в демо-режиме (без внешних вызовов).
delete process.env.ANTHROPIC_API_KEY; delete process.env.SEARCH_API_KEY;
import { researchAgent } from "../lib/agents/research";
import { businessAnalystAgent } from "../lib/agents/analyst";
import { productAgent } from "../lib/agents/product";
import { CompanyResearchSchema, PrdBundleSchema, checkProvenance, scoreOf } from "../lib/schemas";
import { AgentError } from "../lib/llm";

type Case = { name: string; run: () => Promise<string | void> };
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };

const cases: Case[] = [
  { name: "Обычная компания: схема, источники, разделение факт/вывод/гипотеза", run: async () => {
    const r = await researchAgent({ companyName: "ООО «Тест»" });
    CompanyResearchSchema.parse(r);
    assert(checkProvenance(r).length === 0, "нарушено происхождение");
    const kinds = new Set(r.signals.map((s) => s.kind));
    assert(["FACT", "INFERENCE", "HYPOTHESIS"].every((k) => kinds.has(k as never)), "нет разделения типов");
  } },
  { name: "Только ИНН", run: async () => { const r = await researchAgent({ inn: "7707083893" }); assert(r.company.inn === "7707083893", "ИНН потерян"); } },
  { name: "Пустой ввод отклоняется понятной ошибкой", run: async () => { try { await researchAgent({}); } catch (e) { assert(e instanceof AgentError, "ожидалась AgentError"); return; } throw new Error("ошибка не выброшена"); } },
  { name: "Нет финансовых данных: ничего не выдумано", run: async () => { const r = await researchAgent({ companyName: "Тест" }); assert(r.financials.every((f) => r.sources.some((s) => s.id === f.sourceId)), "финпоказатель без источника"); } },
  { name: "Попытка галлюцинации: сигнал с несуществующим источником ловится", run: async () => {
    const r = await researchAgent({ companyName: "Тест" });
    r.signals[0] = { ...r.signals[0], sourceId: "s99" };
    assert(checkProvenance(r).length > 0, "галлюцинация не обнаружена");
  } },
  { name: "Полная цепочка: анализ, скоринг, полнота PRD и плана", run: async () => {
    const r = await researchAgent({ companyName: "Тест" });
    const a = await businessAnalystAgent(r);
    assert(a.opportunities.every((o) => r.sources.some((s) => s.id === o.sourceId) && scoreOf(o) > 0), "возможность без источника или скора");
    const b = PrdBundleSchema.parse(await productAgent({ research: r, opportunity: a.opportunities[0] }));
    assert(b.prd.aiRequirements.confidencePolicy.includes("0.75"), "нет политики уверенности");
    assert(b.prd.acceptanceCriteria.length > 0 && b.plan.tasks.length >= 5, "PRD/план неполные");
  } },
];

(async () => {
  let failed = 0;
  for (const c of cases) {
    try { await c.run(); console.log(`✓ ${c.name}`); } catch (e) { failed++; console.log(`✗ ${c.name}: ${(e as Error).message}`); }
  }
  console.log(`\n${cases.length - failed}/${cases.length} пройдено`);
  process.exit(failed ? 1 : 0);
})();
