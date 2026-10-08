# CLAUDE.md

## Архитектура
Next.js (App Router) + TypeScript + Tailwind + Zod + Gemini API. Пайплайн: researchAgent → businessAnalystAgent → productAgent. Контракты в `lib/schemas.ts`. Поиск — через интерфейс `SearchProvider`.

## Правила (обязательные)
- NEVER trust raw LLM output. Every AI output must be schema validated (`callJson` в `lib/llm.ts`).
- Every factual claim from research must have provenance: `sourceId` из `sources`, проверка `checkProvenance`.
- Never invent missing business data: «Не найдено» / «Недостаточно публичных данных».
- Business logic must not live inside UI components. UI только отображает; логика в `lib/`.
- Каждый сигнал помечается FACT / INFERENCE / HYPOTHESIS.
- Аналитик и продакт-агент не ищут данные: получают только провалидированный вход.
- Скоринг объяснимый: `scoreOf` = (влияние × частота × автоматизация) ÷ сложность.

## Соглашения
- Код, имена, комментарии — по-английски (или по-русски в комментариях); всё, что видит пользователь, — только по-русски, без смешения.
- Промпты для пользовательских ИИ-функций обязаны включать `RU_RULES`.
- Mock/demo-код явно помечен.

## Безопасность
Ключи только в `.env.local`; `.env.example` без секретов; секреты не логировать.

## Запуск и проверки
`npm run dev` · `npm run lint` · `npm run evals` (обязательно перед коммитом).

## Как добавить агента
1. Описать вход/выход Zod-схемами в `lib/schemas.ts`. 2. Создать `lib/agents/<name>.ts` с функцией `xAgent(input)`: парсить вход, вызывать `callJson`, возвращать валидный результат; предусмотреть демо-ветку. 3. Подключить шаг в `app/api/[step]/route.ts`. 4. Добавить кейсы в `evals/run.ts`.

## Как добавить eval-кейс
Добавить `{ name, run }` в массив `cases` в `evals/run.ts`; `run` бросает ошибку при нарушении. Evals работают в демо-режиме без внешних вызовов.
