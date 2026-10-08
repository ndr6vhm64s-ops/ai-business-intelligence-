import { z } from "zod";

export class AgentError extends Error {}
export const llmLive = () => Boolean(process.env.GEMINI_API_KEY);

export const RU_RULES = "Отвечай только на русском языке. Используй простой, профессиональный русский язык. Не используй английские термины без необходимости. Названия компаний, брендов, URL и источников не переводи. Никогда не выдумывай данные: если данных нет, пиши «Не найдено» или «Недостаточно публичных данных».";

type Turn = { role: "user" | "model"; parts: { text: string }[] };

// Порядок перебора: модель из GEMINI_MODEL, затем запасные.
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

async function generate(system: string, contents: Turn[]): Promise<string> {
  const models = [process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter((m): m is string => Boolean(m));
  let lastDetail = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0.3 };
    if (model.startsWith("gemini-2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig }),
    });
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    }
    const body = (await res.text()).slice(0, 200);
    lastDetail = `${model}, код ${res.status}: ${body}`;
    if (res.status === 429) throw new AgentError("Лимит бесплатных запросов исчерпан. Подождите минуту и повторите.");
    if (res.status === 404 || res.status >= 500) continue; // пробуем следующую модель
    throw new AgentError(`Запрос к Gemini отклонён (${lastDetail})`);
  }
  throw new AgentError(`Модель недоступна (${lastDetail})`);
}

/** Вызов модели со структурированным ответом. Сырой вывод никогда не используется без валидации Zod. */
export async function callJson<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  const sys = `${system}\n\n${RU_RULES}\n\nВерни ТОЛЬКО валидный JSON по этой JSON-схеме, без пояснений:\n${JSON.stringify(z.toJSONSchema(schema))}`;
  let contents: Turn[] = [{ role: "user", parts: [{ text: user }] }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await generate(sys, contents);
    let err = "JSON не разобран";
    try {
      const parsed = schema.safeParse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
      if (parsed.success) return parsed.data;
      err = parsed.error.message;
    } catch { /* повторная попытка */ }
    contents = [...contents, { role: "model", parts: [{ text }] }, { role: "user", parts: [{ text: `Ответ невалиден: ${err}. Исправь и верни только JSON.` }] }];
  }
  throw new AgentError("Модель вернула невалидный ответ. Попробуйте ещё раз.");
}
