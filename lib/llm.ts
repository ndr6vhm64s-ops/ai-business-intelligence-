import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export class AgentError extends Error {}
export const llmLive = () => Boolean(process.env.ANTHROPIC_API_KEY);

export const RU_RULES = "Отвечай только на русском языке. Используй простой, профессиональный русский язык. Не используй английские термины без необходимости. Названия компаний, брендов, URL и источников не переводи. Никогда не выдумывай данные: если данных нет, пиши «Не найдено» или «Недостаточно публичных данных».";

/** Вызов модели со структурированным ответом. Сырой вывод никогда не используется без валидации Zod. */
export async function callJson<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  const client = new Anthropic();
  const sys = `${system}\n\n${RU_RULES}\n\nВерни ТОЛЬКО валидный JSON по этой JSON-схеме, без пояснений:\n${JSON.stringify(z.toJSONSchema(schema))}`;
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 8000, system: sys, messages });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    let err = "JSON не разобран";
    try {
      const parsed = schema.safeParse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
      if (parsed.success) return parsed.data;
      err = parsed.error.message;
    } catch { /* повторная попытка */ }
    messages = [...messages, { role: "assistant", content: text }, { role: "user", content: `Ответ невалиден: ${err}. Исправь и верни только JSON.` }];
  }
  throw new AgentError("Модель вернула невалидный ответ. Попробуйте ещё раз.");
}
