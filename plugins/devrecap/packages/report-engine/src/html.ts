import type { ActivitySummary, ReportInput } from "@devrecap/shared";
import type { AnalysisItem, ReportAnalysis } from "./analysis.ts";

export interface HtmlReportOptions { locale?: "en" | "pt-BR"; title?: string; }

export function renderHtmlReport(input: ReportInput, analysis: ReportAnalysis, options: HtmlReportOptions = {}): string {
  const pt = input.language === "pt" || (input.language === "auto" && (input.resolvedLanguage === "pt" || options.locale === "pt-BR"));
  const activities = input.projects.flatMap((p) => p.activities);
  const byId = new Map(activities.map((a) => [a.id, a]));
  const done = activities.filter((a) => a.status === "completed").length;
  const evidence = activities.reduce((n, a) => n + a.evidenceCount, 0);
  const labels = pt
    ? { summary:"Resumo executivo", focus:"Frente principal", highlights:"Entregas confirmadas", investigations:"Investigações", progress:"Em andamento", blockers:"Bloqueios", next:"Próximos passos", projects:"Projetos", activities:"Atividades", completed:"Concluídas", evidence:"Evidências", refs:"Ver evidências" }
    : { summary:"Executive summary", focus:"Main workstream", highlights:"Confirmed deliveries", investigations:"Investigations", progress:"In progress", blockers:"Blockers", next:"Next steps", projects:"Projects", activities:"Activities", completed:"Completed", evidence:"Evidence", refs:"View evidence" };

  let sectionNumber = 1;
  const nextNumber = () => String(sectionNumber++).padStart(2, "0");
  const section = (title: string, items: AnalysisItem[], tone: string) => items.length
    ? `<section class="report-section tone-${tone}"><div class="section-head"><span class="section-no">${nextNumber()}</span><h2>${esc(title)}</h2></div><div class="stack">${items.map((item) => card(item, byId, labels.refs)).join("")}</div></section>`
    : "";

  const headline = cleanHeadline(analysis.headline);
  const summary = analysis.executiveSummary
    ? `<section class="summary"><div class="summary-kicker"><span></span>${esc(labels.summary)}</div>${prose(analysis.executiveSummary)}</section>`
    : "";
  const focus = analysis.mainFocus
    ? `<section class="focus"><div class="section-head"><span class="section-no">${nextNumber()}</span><div><small>${esc(labels.focus)}</small><h2>${esc(analysis.mainFocus.title)}</h2></div></div>${prose(analysis.mainFocus.narrative)}${evidenceDetails(analysis.mainFocus, byId, labels.refs)}</section>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(options.title ?? `derecap — ${headline}`)}</title><style>
:root{color-scheme:light;--ink:#18211d;--muted:#65706a;--paper:#fffdf8;--sand:#f3efe6;--line:#e7e0d4;--forest:#19372f;--mint:#baf2ad;--lime:#dfff79;--lav:#e7ddff;--peach:#ffd9c8;--rose:#ffd5d9;--amber:#ffe3a5}*{box-sizing:border-box}body{margin:0;background:var(--sand);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.page{max-width:960px;margin:30px auto 54px;background:var(--paper);border:1px solid #e9e1d4;border-radius:28px;overflow:hidden;box-shadow:0 24px 70px #3b31261a}.hero{position:relative;padding:46px 54px 36px;background:var(--forest);color:#fff;overflow:hidden}.hero:after{content:"";position:absolute;width:280px;height:280px;border-radius:50%;right:-110px;top:-130px;background:var(--lime);opacity:.14}.brand-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:34px;position:relative;z-index:1}.brand{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:850;letter-spacing:.16em;text-transform:lowercase}.brand-mark{width:11px;height:11px;border-radius:4px;background:var(--lime);box-shadow:0 0 0 5px #dfff7918}.period{font-size:12px;color:#d9e4df;border:1px solid #ffffff24;background:#ffffff0d;padding:8px 12px;border-radius:999px}.hero h1{font-size:44px;line-height:1.04;letter-spacing:-.04em;margin:0;max-width:780px;position:relative;z-index:1}.signal{display:inline-flex;align-items:center;gap:8px;margin-top:24px;color:#dce9e4;font-size:13px}.signal:before{content:"";width:22px;height:2px;background:var(--mint)}.metrics{display:flex;gap:0;padding:0 54px;background:#fff;border-bottom:1px solid var(--line)}.metric{flex:1;min-width:0;padding:19px 20px 18px 0;margin-right:20px;border-right:1px solid var(--line)}.metric:last-child{border-right:0;margin-right:0}.metric b{display:block;font-size:24px;letter-spacing:-.03em}.metric span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}main{padding:8px 54px 54px}.summary{margin:34px 0 10px;padding:26px 28px;background:#eef7eb;border:1px solid #d6e9d0;border-radius:18px}.summary-kicker{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#466044;margin-bottom:10px}.summary-kicker span{width:8px;height:8px;border-radius:50%;background:#74b95f}.summary p{font-size:17px;line-height:1.74;color:#33443a;margin:0 0 12px}.summary p:last-child{margin-bottom:0}.focus,.report-section{padding:34px 0;border-bottom:1px solid var(--line)}.focus{margin-top:8px}.section-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:16px}.section-no{flex:0 0 auto;display:inline-grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--ink);color:white;font-size:11px;font-weight:800;letter-spacing:.06em}.focus small{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7a837e;margin:2px 0 4px}.focus h2,.report-section h2{font-size:26px;line-height:1.18;letter-spacing:-.025em;margin:0}.focus>p{font-size:16px;line-height:1.78;color:#47514c;margin:0 0 12px;padding-left:50px}.stack{display:flex;flex-direction:column;gap:12px;margin-left:50px}.card{position:relative;border:1px solid var(--line);border-radius:17px;padding:21px 22px 20px;background:#fff}.card:before{content:"";position:absolute;left:0;top:18px;bottom:18px;width:4px;border-radius:0 4px 4px 0;background:#c5cec8}.tone-highlights .card:before{background:#79c76a}.tone-investigations .card:before{background:#a88be8}.tone-progress .card:before{background:#eea66f}.tone-blockers .card:before{background:#dd7d86}.tone-next .card:before{background:#d6ab48}.tone-highlights .section-no{background:#397a3e}.tone-investigations .section-no{background:#6e56a4}.tone-progress .section-no{background:#a55d2f}.tone-blockers .section-no{background:#9d4752}.tone-next .section-no{background:#8c6a22}.card h3{font-size:19px;line-height:1.32;margin:0 0 9px;letter-spacing:-.015em}.card p{font-size:15px;line-height:1.74;color:#505a55;margin:0 0 12px}.card p:last-of-type{margin-bottom:0}.refs{margin-top:14px;border-top:1px dashed #e4ddd2;padding-top:10px}.refs summary{cursor:pointer;list-style:none;color:#7a817d;font-size:11px;font-weight:700}.refs summary::-webkit-details-marker{display:none}.refs summary:after{content:" +";color:#999}.refs[open] summary:after{content:" −"}.refs div{margin-top:8px;color:#8b918d;font-size:11px;line-height:1.55}.footer-note{margin-top:28px;color:#8a918d;font-size:11px;display:flex;justify-content:space-between;gap:12px}.footer-note span:last-child{text-align:right}@media(max-width:700px){.page{margin:0;border-radius:0}.hero,main,.metrics{padding-left:22px;padding-right:22px}.hero h1{font-size:34px}.brand-row{align-items:flex-start;flex-direction:column;margin-bottom:26px}.metrics{display:grid;grid-template-columns:1fr 1fr}.metric{border-right:0;border-bottom:1px solid var(--line);margin-right:0;padding-right:12px}.metric:nth-last-child(-n+2){border-bottom:0}.summary{padding:22px}.focus>p,.stack{margin-left:0;padding-left:0}.section-head{gap:12px}.focus h2,.report-section h2{font-size:23px}}@media print{@page{size:A4;margin:12mm}body{background:white}.page{margin:0;box-shadow:none;border:0}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}.card,.focus,.summary{break-inside:avoid}.refs{display:none}}
</style></head><body><article class="page"><header class="hero"><div class="brand-row"><div class="brand"><span class="brand-mark"></span>derecap</div><span class="period">${esc(formatPeriod(input, pt))}</span></div><h1>${esc(headline)}</h1><div class="signal">${pt ? "relatório de trabalho reconstruído por evidências" : "evidence-backed work reconstruction"}</div></header><div class="metrics">${metric(input.projects.length,labels.projects)}${metric(activities.length,labels.activities)}${metric(done,labels.completed)}${metric(evidence,labels.evidence)}</div><main>${summary}${focus}${section(labels.highlights,analysis.highlights,"highlights")}${section(labels.investigations,analysis.investigations,"investigations")}${section(labels.progress,analysis.inProgress,"progress")}${section(labels.blockers,analysis.blockers,"blockers")}${section(labels.next,analysis.nextSteps,"next")}<div class="footer-note"><span>${pt ? "Gerado a partir de fontes locais autorizadas." : "Generated from authorized local sources."}</span><span>${esc(input.range.end.slice(0,10))}</span></div></main></article></body></html>`;
}

function card(item: AnalysisItem, byId: Map<string, ActivitySummary>, refsLabel: string): string {
  return `<article class="card"><h3>${esc(item.title)}</h3>${prose(item.narrative)}${evidenceDetails(item, byId, refsLabel)}</article>`;
}

function evidenceDetails(item: AnalysisItem, byId: Map<string, ActivitySummary>, refsLabel: string): string {
  const refs = item.activityIds.map((id) => byId.get(id)?.title).filter(Boolean).join(" · ");
  return refs ? `<details class="refs"><summary>${esc(refsLabel)}</summary><div>${esc(refs)}</div></details>` : "";
}

function prose(value: string): string {
  return value
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function cleanHeadline(value: string): string {
  return value
    .replace(/^\s*(?:devrecap|derecap)\s*(?:—|–|-|:)\s*/i, "")
    .trim() || "Work recap";
}

function formatPeriod(input: ReportInput, pt: boolean): string {
  const start = input.range.start.slice(0, 10);
  const end = input.range.end.slice(0, 10);
  return pt ? `${start}  ·  ${end}` : `${start}  ·  ${end}`;
}

function metric(value:number,label:string){return `<div class="metric"><b>${value}</b><span>${esc(label)}</span></div>`}
function esc(value:string){return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c] ?? c)}
