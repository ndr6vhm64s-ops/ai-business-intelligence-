import { z } from "zod";

export const NOT_FOUND = "Не найдено";
export const NO_DATA = "Недостаточно публичных данных";
const conf = z.number().min(0).max(1);
const score15 = z.number().int().min(1).max(5);

export const KindSchema = z.enum(["FACT", "INFERENCE", "HYPOTHESIS"]);
export const SourceSchema = z.object({
  id: z.string(), title: z.string(), url: z.string(),
  sourceType: z.enum(["gov", "official_site", "vacancy", "press_release", "media", "other"]),
  retrievedAt: z.string(),
});
export const SignalSchema = z.object({
  type: z.enum(["hiring", "event", "expansion", "partnership", "product", "risk"]),
  kind: KindSchema, claim: z.string(), evidence: z.string(),
  sourceId: z.string(), date: z.string().nullable(), confidence: conf,
});
// То, что генерирует модель (источники и режим добавляет код)
export const CompanyCoreSchema = z.object({
  company: z.object({ name: z.string(), inn: z.string(), industry: z.string(), description: z.string(), website: z.string(), location: z.string(), status: z.string() }),
  financials: z.array(z.object({ metric: z.string(), value: z.string(), period: z.string(), sourceId: z.string(), confidence: conf })),
  signals: z.array(SignalSchema),
  events: z.array(z.object({ date: z.string(), event: z.string(), sourceId: z.string() })),
});
export const CompanyResearchSchema = CompanyCoreSchema.extend({ sources: z.array(SourceSchema), mode: z.enum(["demo", "live"]) });

export const OpportunitySchema = z.object({
  id: z.string(), title: z.string(), problem: z.string(), evidence: z.string(), sourceId: z.string(),
  proposedSolution: z.string(),
  expectedImpact: score15, frequency: score15, automationPotential: score15, implementationComplexity: score15,
  confidence: conf,
});
export const AnalysisSchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({ category: z.enum(["problem", "risk", "growth", "cx"]), text: z.string(), kind: KindSchema, sourceId: z.string() })),
  opportunities: z.array(OpportunitySchema).min(1),
});

const list = z.array(z.string());
export const PrdSchema = z.object({
  title: z.string(), problem: z.string(), businessGoal: z.string(), user: z.string(),
  currentProcess: z.string(), proposedProcess: z.string(),
  functionalRequirements: list, nonFunctionalRequirements: list,
  aiRequirements: z.object({ modelInput: z.string(), modelOutput: z.string(), structuredOutput: z.string(), confidencePolicy: z.string(), fallback: z.string(), humanReview: z.string(), hallucinationPrevention: z.string(), evaluation: z.string(), logging: z.string() }),
  inputOutput: z.string(), edgeCases: list, humanInTheLoop: z.string(),
  acceptanceCriteria: list, evaluationCriteria: list, risks: list, metrics: list,
});
export const PlanSchema = z.object({
  epic: z.string(),
  tasks: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), dependencies: list, acceptanceCriteria: list, complexity: z.enum(["low", "medium", "high"]) })).min(1),
});
export const PrdBundleSchema = z.object({ prd: PrdSchema, plan: PlanSchema });

export type CompanyCore = z.infer<typeof CompanyCoreSchema>;
export type CompanyResearch = z.infer<typeof CompanyResearchSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type PrdBundle = z.infer<typeof PrdBundleSchema>;

/** Объяснимый скор: (Влияние × Частота × Потенциал автоматизации) ÷ Сложность. Диапазон 0.2–125. */
export function scoreOf(o: Opportunity): number {
  return Math.round(((o.expectedImpact * o.frequency * o.automationPotential) / o.implementationComplexity) * 10) / 10;
}

/** Проверка происхождения данных: каждый факт ссылается на существующий источник. Возвращает список проблем. */
export function checkProvenance(r: { sources: Source[]; signals: CompanyCore["signals"]; financials: CompanyCore["financials"]; events: CompanyCore["events"] }): string[] {
  const ids = new Set(r.sources.map((s) => s.id));
  const bad: string[] = [];
  r.signals.forEach((s, i) => { if (!ids.has(s.sourceId)) bad.push(`signals[${i}]: неизвестный источник ${s.sourceId}`); if (!s.evidence.trim()) bad.push(`signals[${i}]: нет подтверждения`); });
  r.financials.forEach((f, i) => { if (!ids.has(f.sourceId)) bad.push(`financials[${i}]: неизвестный источник ${f.sourceId}`); });
  r.events.forEach((e, i) => { if (!ids.has(e.sourceId)) bad.push(`events[${i}]: неизвестный источник ${e.sourceId}`); });
  return bad;
}
