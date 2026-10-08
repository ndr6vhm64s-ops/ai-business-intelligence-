"use client";
import { useState, type ReactNode } from "react";
import { scoreOf, type Analysis, type CompanyResearch, type Opportunity, type PrdBundle } from "../lib/schemas";

const STAGES = ["Определяем компанию", "Ищем публичные данные", "Анализируем бизнес", "Ищем возможности"];
const KIND = { FACT: ["Факт", "bg-emerald-500/15 text-emerald-300"], INFERENCE: ["Вывод", "bg-sky-500/15 text-sky-300"], HYPOTHESIS: ["Гипотеза", "bg-amber-500/15 text-amber-300"] } as const;
const SIGNAL = { hiring: "Найм", event: "События", expansion: "Расширение", partnership: "Партнёрства", product: "Продукт", risk: "Риски" } as const;
const SRC = { gov: "Госисточник", official_site: "Официальный сайт", vacancy: "Вакансии", press_release: "Пресс-релиз", media: "СМИ", other: "Другое" } as const;
const CX = { low: "Низкая", medium: "Средняя", high: "Высокая" } as const;
const FIND = { problem: "Проблема", risk: "Риск", growth: "Рост", cx: "Клиентский опыт" } as const;
const lvl = (n: number) => (n >= 4 ? "Высокий" : n === 3 ? "Средний" : "Низкий");

async function api<T>(step: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${step}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Не удалось выполнить запрос. Попробуйте ещё раз.");
  return data as T;
}

const Card = ({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) => (
  <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>{right}</div>{children}
  </section>
);
const Json = ({ data }: { data: unknown }) => {
  const [open, setOpen] = useState(false);
  return <div><button onClick={() => setOpen(!open)} className="text-xs text-slate-400 underline">{open ? "Скрыть структурированные данные" : "Показать структурированные данные"}</button>{open && <pre className="mt-2 max-h-80 overflow-auto rounded bg-black/40 p-3 text-xs text-slate-300">{JSON.stringify(data, null, 2)}</pre>}</div>;
};
const L = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
const P = ({ t, children }: { t: string; children: ReactNode }) => <div className="mb-3"><div className="text-xs font-semibold text-slate-400">{t}</div><div className="text-sm text-slate-200">{children}</div></div>;

export default function Home() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState("");
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [bundle, setBundle] = useState<PrdBundle | null>(null);
  const [prdLoading, setPrdLoading] = useState<string | null>(null);

  async function run() {
    const q = query.trim();
    if (!q) return setError("Введите название компании или ИНН.");
    setError(""); setResearch(null); setAnalysis(null); setBundle(null); setStage(0);
    const t = setTimeout(() => setStage(1), 600);
    try {
      const r = await api<CompanyResearch>("research", /^\d{10,12}$/.test(q) ? { inn: q } : { companyName: q });
      setResearch(r); setStage(2);
      const a = await api<Analysis>("analyze", { research: r });
      setStage(3); setAnalysis(a);
    } catch (e) { setError((e as Error).message); }
    finally { clearTimeout(t); setStage(-1); }
  }
  async function genPrd(o: Opportunity) {
    if (!research) return;
    setPrdLoading(o.id); setBundle(null); setError("");
    try { setBundle(await api<PrdBundle>("prd", { research, opportunity: o })); } catch (e) { setError((e as Error).message); } finally { setPrdLoading(null); }
  }
  const src = (id: string) => research?.sources.find((s) => s.id === id);
  const SrcLink = ({ id }: { id: string }) => { const s = src(id); return s ? <a href={s.url} target="_blank" className="text-xs text-sky-400 hover:underline">Источник: {s.title}</a> : <span className="text-xs text-slate-500">Источник недоступен</span>; };
  const busy = stage >= 0;

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <header><h1 className="text-xl font-semibold">AI Business Intelligence</h1><p className="text-sm text-slate-400">Исследование компании → бизнес-анализ → возможности для автоматизации → PRD → план реализации</p></header>
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && run()} placeholder="Название компании или ИНН" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        <button onClick={run} disabled={busy} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400 disabled:opacity-50">Исследовать компанию</button>
      </div>
      {busy && <ol className="flex flex-wrap gap-3 text-xs">{STAGES.map((s, i) => <li key={s} className={i < stage ? "text-emerald-400" : i === stage ? "animate-pulse text-indigo-300" : "text-slate-600"}>{i < stage ? "✓" : "•"} {s}</li>)}</ol>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      {research && <>
        {research.mode === "demo" && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Демо-режим: данные синтетические. Укажите ключи в .env.local для реального исследования.</div>}
        <Card title="О компании" right={<Json data={research} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <P t="Название">{research.company.name}</P><P t="ИНН">{research.company.inn}</P>
            <P t="Отрасль">{research.company.industry}</P><P t="Статус">{research.company.status}</P>
            <P t="Сайт">{research.company.website}</P><P t="Расположение">{research.company.location}</P>
          </div>
          <P t="Описание">{research.company.description}</P>
          <P t="Финансовые показатели">{research.financials.length ? <ul className="space-y-1">{research.financials.map((f, i) => <li key={i}>{f.metric}: {f.value} ({f.period}) · уверенность {f.confidence} · <SrcLink id={f.sourceId} /></li>)}</ul> : "Недостаточно публичных данных"}</P>
        </Card>
        <Card title="Бизнес-сигналы">
          <div className="grid gap-3 sm:grid-cols-2">{research.signals.map((s, i) => (
            <div key={i} className="rounded-lg border border-white/10 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs"><span className={`rounded px-1.5 py-0.5 ${KIND[s.kind][1]}`}>{KIND[s.kind][0]}</span><span className="text-slate-400">{SIGNAL[s.type]}</span><span className="ml-auto text-slate-400">Уверенность: {s.confidence}</span></div>
              <p className="text-sm">{s.claim}</p><p className="mt-1 text-xs text-slate-400">Подтверждение: {s.evidence}</p>
              <div className="mt-1 flex justify-between"><SrcLink id={s.sourceId} /><span className="text-xs text-slate-500">{s.date ?? "дата не указана"}</span></div>
            </div>))}</div>
        </Card>
        <Card title="События">{research.events.length ? <ul className="space-y-1 text-sm">{research.events.map((e, i) => <li key={i}>{e.date} — {e.event} · <SrcLink id={e.sourceId} /></li>)}</ul> : <span className="text-sm text-slate-400">Недостаточно публичных данных</span>}</Card>
        <Card title="Источники"><ul className="space-y-1 text-sm">{research.sources.map((s) => <li key={s.id}><a href={s.url} target="_blank" className="text-sky-400 hover:underline">{s.title}</a> <span className="text-xs text-slate-500">· {SRC[s.sourceType]} · получено {s.retrievedAt}</span></li>)}</ul></Card>
      </>}

      {analysis && <>
        <Card title="Бизнес-анализ" right={<Json data={analysis} />}>
          <p className="mb-3 text-sm text-slate-300">{analysis.summary}</p>
          <ul className="space-y-1 text-sm">{analysis.findings.map((f, i) => <li key={i}><span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${KIND[f.kind][1]}`}>{KIND[f.kind][0]}</span><b className="text-slate-400">{FIND[f.category]}:</b> {f.text}</li>)}</ul>
        </Card>
        <Card title="Возможности для автоматизации">
          <div className="grid gap-3 sm:grid-cols-2">{[...analysis.opportunities].sort((a, b) => scoreOf(b) - scoreOf(a)).map((o) => (
            <div key={o.id} className="flex flex-col rounded-lg border border-white/10 p-3">
              <h3 className="mb-2 text-sm font-semibold">{o.title}</h3>
              <P t="Проблема">{o.problem}</P><P t="Обоснование">{o.evidence} <SrcLink id={o.sourceId} /></P><P t="Предлагаемое решение">{o.proposedSolution}</P>
              <div className="mb-2 grid grid-cols-2 gap-1 text-xs text-slate-400"><span>Влияние: {lvl(o.expectedImpact)}</span><span>Сложность: {lvl(o.implementationComplexity)}</span><span>Потенциал автоматизации: {lvl(o.automationPotential)}</span><span>Уверенность: {o.confidence}</span></div>
              <div className="mb-3 rounded bg-white/5 p-2 text-xs text-slate-300">Оценка: <b>{scoreOf(o)}</b> = (влияние {o.expectedImpact} × частота {o.frequency} × автоматизация {o.automationPotential}) ÷ сложность {o.implementationComplexity}</div>
              <button onClick={() => genPrd(o)} disabled={!!prdLoading} className="mt-auto rounded-lg bg-indigo-500 px-3 py-1.5 text-sm hover:bg-indigo-400 disabled:opacity-50">{prdLoading === o.id ? "Формируем PRD…" : "Сформировать PRD"}</button>
            </div>))}</div>
        </Card>
      </>}

      {bundle && <>
        <Card title="PRD (документ с требованиями к продукту)" right={<Json data={bundle.prd} />}>
          <h3 className="mb-3 text-base font-semibold">{bundle.prd.title}</h3>
          <P t="Проблема">{bundle.prd.problem}</P><P t="Бизнес-цель">{bundle.prd.businessGoal}</P><P t="Пользователь">{bundle.prd.user}</P>
          <P t="Текущий процесс">{bundle.prd.currentProcess}</P><P t="Предлагаемый процесс">{bundle.prd.proposedProcess}</P>
          <P t="Функциональные требования"><L items={bundle.prd.functionalRequirements} /></P><P t="Нефункциональные требования"><L items={bundle.prd.nonFunctionalRequirements} /></P>
          <P t="Требования к ИИ"><dl className="space-y-1 text-sm">{([["Вход модели", "modelInput"], ["Выход модели", "modelOutput"], ["Структурированный вывод", "structuredOutput"], ["Политика уверенности", "confidencePolicy"], ["Запасной сценарий", "fallback"], ["Ручная проверка", "humanReview"], ["Защита от галлюцинаций", "hallucinationPrevention"], ["Оценка качества", "evaluation"], ["Логирование", "logging"]] as const).map(([l, k]) => <div key={k}><dt className="inline text-slate-400">{l}: </dt><dd className="inline">{bundle.prd.aiRequirements[k]}</dd></div>)}</dl></P>
          <P t="Входные и выходные данные">{bundle.prd.inputOutput}</P><P t="Граничные случаи"><L items={bundle.prd.edgeCases} /></P><P t="Участие человека">{bundle.prd.humanInTheLoop}</P>
          <P t="Критерии приёмки"><L items={bundle.prd.acceptanceCriteria} /></P><P t="Критерии оценки качества"><L items={bundle.prd.evaluationCriteria} /></P>
          <P t="Риски"><L items={bundle.prd.risks} /></P><P t="Метрики"><L items={bundle.prd.metrics} /></P>
        </Card>
        <Card title="План реализации" right={<Json data={bundle.plan} />}>
          <p className="mb-3 text-sm">Эпик: <b>{bundle.plan.epic}</b></p>
          <div className="space-y-2">{bundle.plan.tasks.map((t) => (
            <div key={t.id} className="rounded-lg border border-white/10 p-3 text-sm">
              <div className="flex justify-between"><b>{t.id} · {t.title}</b><span className="text-xs text-slate-400">Сложность: {CX[t.complexity]}</span></div>
              <p className="text-slate-300">{t.description}</p>
              <p className="text-xs text-slate-400">Зависимости: {t.dependencies.length ? t.dependencies.join(", ") : "нет"}</p>
              <p className="text-xs text-slate-400">Критерии приёмки: {t.acceptanceCriteria.join("; ")}</p>
            </div>))}</div>
        </Card>
      </>}
    </main>
  );
}
