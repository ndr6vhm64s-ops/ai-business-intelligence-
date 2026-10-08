import { z } from "zod";
import { AgentError } from "../../../lib/llm";
import { researchAgent } from "../../../lib/agents/research";
import { businessAnalystAgent } from "../../../lib/agents/analyst";
import { productAgent } from "../../../lib/agents/product";
import { CompanyResearchSchema, OpportunitySchema } from "../../../lib/schemas";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  try {
    const body = await req.json();
    if (step === "research") return Response.json(await researchAgent(z.object({ companyName: z.string().optional(), inn: z.string().optional() }).parse(body)));
    if (step === "analyze") return Response.json(await businessAnalystAgent(CompanyResearchSchema.parse(body.research)));
    if (step === "prd") return Response.json(await productAgent({ research: CompanyResearchSchema.parse(body.research), opportunity: OpportunitySchema.parse(body.opportunity) }));
    return Response.json({ error: "Неизвестный шаг." }, { status: 404 });
  } catch (e) {
    if (e instanceof AgentError) return Response.json({ error: e.message }, { status: 422 });
    console.error(e);
    return Response.json({ error: step === "research" ? "Исследование не удалось. Попробуйте ещё раз." : "Не удалось выполнить запрос. Попробуйте ещё раз." }, { status: 500 });
  }
}
