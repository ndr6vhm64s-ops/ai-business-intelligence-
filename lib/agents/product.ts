import { callJson, llmLive } from "../llm";
import { CompanyResearchSchema, OpportunitySchema, PrdBundleSchema, type CompanyResearch, type Opportunity, type PrdBundle } from "../schemas";

export async function productAgent(input: { research: CompanyResearch; opportunity: Opportunity }): Promise<PrdBundle> {
  const research = CompanyResearchSchema.parse(input.research);
  const o = OpportunitySchema.parse(input.opportunity);
  if (research.mode === "live" && llmLive()) {
    return callJson(PrdBundleSchema,
      "Ты — продакт-менеджер. Составь PRD (документ с требованиями к продукту) и план реализации для выбранной возможности. Если используется ИИ, в aiRequirements обязательно опиши вход, выход, структурированный вывод, порог уверенности (например, при уверенности < 0.75 — на ручную проверку), запасной сценарий, ручную проверку, защиту от галлюцинаций, оценку качества и логирование. В плане: задачи TASK-001…, зависимости, критерии приёмки, сложность (low/medium/high).",
      JSON.stringify({ company: research.company, opportunity: o }));
  }
  const t = o.title;
  return PrdBundleSchema.parse({
    prd: {
      title: `PRD: ${t}`, problem: o.problem, businessGoal: `Сократить ручной труд и время реакции: ${o.proposedSolution}`,
      user: "Менеджеры по продажам и руководитель отдела.", currentProcess: "Сотрудники обрабатывают входящие данные вручную.", proposedProcess: o.proposedSolution,
      functionalRequirements: ["Приём входящих данных через API", "ИИ-обработка со структурированным результатом", "Очередь ручной проверки", "Журнал решений"],
      nonFunctionalRequirements: ["Время ответа до 5 секунд", "Хранение персональных данных по 152-ФЗ", "Доступность 99%"],
      aiRequirements: { modelInput: "Текст обращения и контекст клиента.", modelOutput: "Категория, приоритет, уверенность.", structuredOutput: "JSON по Zod-схеме; невалидный ответ отклоняется.", confidencePolicy: "Если уверенность < 0.75 — отправить на ручную проверку.", fallback: "При ошибке модели обращение уходит в общую очередь.", humanReview: "Сотрудник подтверждает или исправляет категорию.", hallucinationPrevention: "Фиксированный список категорий, запрет на выдуманные значения.", evaluation: "Регулярный прогон на размеченной выборке, порог точности 90%.", logging: "Логируются вход, выход, уверенность и итоговое решение человека." },
      inputOutput: "Вход: текст обращения. Выход: JSON {категория, приоритет, уверенность}.",
      edgeCases: ["Пустое обращение", "Обращение на другом языке", "Несколько тем в одном обращении"],
      humanInTheLoop: "Решения с низкой уверенностью и спорные случаи проверяет человек.",
      acceptanceCriteria: ["Точность на тестовой выборке не ниже 90%", "100% ответов проходят валидацию схемы", "Низкая уверенность всегда попадает в ручную проверку"],
      evaluationCriteria: ["Точность и полнота по категориям", "Доля ручных проверок", "Доля невалидных ответов"],
      risks: ["Ошибки классификации", "Дрейф данных", "Утечка персональных данных"],
      metrics: ["Среднее время обработки", "Доля автоматически обработанных обращений", "Удовлетворённость сотрудников"],
    },
    plan: {
      epic: t,
      tasks: [
        { id: "TASK-001", title: "Серверный API", description: "Эндпоинт приёма данных и сохранения результата.", dependencies: [], acceptanceCriteria: ["Эндпоинт валидирует вход"], complexity: "low" },
        { id: "TASK-002", title: "Сервис ИИ-обработки", description: "Вызов модели и разбор ответа.", dependencies: ["TASK-001"], acceptanceCriteria: ["Невалидный ответ обрабатывается ошибкой"], complexity: "medium" },
        { id: "TASK-003", title: "Промпт и схема структурированного вывода", description: "Промпт на русском и Zod-схема.", dependencies: ["TASK-002"], acceptanceCriteria: ["Ответы проходят схему"], complexity: "medium" },
        { id: "TASK-004", title: "Интерфейс", description: "Экран очереди и результатов.", dependencies: ["TASK-001"], acceptanceCriteria: ["Видны категория и уверенность"], complexity: "medium" },
        { id: "TASK-005", title: "Поток ручной проверки", description: "Очередь для решений с уверенностью < 0.75.", dependencies: ["TASK-002", "TASK-004"], acceptanceCriteria: ["Низкая уверенность попадает в очередь"], complexity: "medium" },
        { id: "TASK-006", title: "Модульные тесты", description: "Тесты API и сервиса.", dependencies: ["TASK-002"], acceptanceCriteria: ["Покрыты основные сценарии"], complexity: "low" },
        { id: "TASK-007", title: "Тесты оценки качества ИИ", description: "Размеченная выборка и порог точности.", dependencies: ["TASK-003"], acceptanceCriteria: ["Точность не ниже 90%"], complexity: "medium" },
      ],
    },
  });
}
