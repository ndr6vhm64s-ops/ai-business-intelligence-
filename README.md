# AI Business Intelligence

This project demonstrates an agentic workflow that transforms public company information into business opportunities and production-oriented product requirements.

## Что это
Пользователь вводит название компании или ИНН. Система исследует публичные данные, структурирует их с указанием источников, анализирует бизнес, находит возможности для автоматизации с помощью ИИ, формирует PRD и план реализации.

## Зачем
Демонстрация сквозного ИИ-продукта: структурированные ответы, происхождение данных, разделение факт / вывод / гипотеза, оценка качества. Не чат с LLM.

## Архитектура
```
Ввод → researchAgent → SearchProvider → CompanyResearch → валидация Zod + проверка источников
     → businessAnalystAgent → возможности (скор) → productAgent → PRD + план реализации → evals
```
| Агент | Вход | Выход |
|---|---|---|
| researchAgent | `{companyName?, inn?}` | `CompanyResearch` (с источниками) |
| businessAnalystAgent | только валидный `CompanyResearch` | `Analysis` (находки + возможности) |
| productAgent | исследование + выбранная возможность | `PrdBundle` (PRD + план) |

Код: `lib/schemas.ts` (контракты), `lib/agents/*`, `lib/search/provider.ts`, `lib/llm.ts` (вызов Gemini + валидация + повтор), `app/api/[step]/route.ts`, `app/page.tsx`, `evals/`.

## Запуск
```bash
npm install
cp .env.example .env.local   # вписать ключи
npm run dev                  # http://localhost:3000
npm run lint                 # tsc --noEmit
npm run evals                # он же npm test
```
Переменные: `GEMINI_API_KEY`, `GEMINI_MODEL` (необязательно), `SEARCH_API_KEY` (Tavily).

## Режимы
- **Демо** (нет `GEMINI_API_KEY` или `SEARCH_API_KEY`): `MockSearchProvider` + детерминированные агенты. Помечено в UI и в коде (`DEMO`, `MOCK`).
- **Реальный**: нужны оба ключа. Поиск → Gemini → валидация схемой. Код реального пути написан, но без ключей не запускался.

## Оценка качества (evals)
`evals/run.ts`: 6 кейсов (схема, происхождение данных, факт/вывод/гипотеза, пустой ввод, отсутствие финансов, попытка галлюцинации, полнота PRD). Новый кейс — добавить объект в массив `cases`.

## Дорожная карта
Реальные источники (ЕГРЮЛ/ФНС, hh.ru API) · evals для живого режима · конфликтующие источники и неоднозначные компании · кэш и история · экспорт PRD.
