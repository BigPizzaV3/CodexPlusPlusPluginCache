"""Offline review UI. Exported selection is explicitly NOT execution approval."""
from guard import canonical, write_new
from discovery import export_csv


def save_plan(folder, plan):
    write_new(folder / "plan.json", canonical(plan) + "\n")
    export_csv(folder / "candidates.csv", plan["operations"], ["id", "action", "src", "dest", "keep", "reason"])
    count = len(plan["operations"])
    write_new(folder / "receipt.md", f"# Candidate plan\n\n{count} proposed operations. Source files unchanged.\n\nPlan SHA-256: `{plan['plan_hash']}`\n\nOpen review.html, export selection.json, then dry-run apply-plan. CSV is for human viewing only. Approval happens separately in your terminal.\n")
    data = canonical(plan).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>TidyGuardian | Review, don't delete</title>
<style>
body{font:16px system-ui;margin:0;background:#f4f5f2;color:#202724}main{max-width:1200px;margin:auto;padding:28px}h1{font-size:30px}p{line-height:1.6}.notice{border-left:5px solid #a8680e;padding:12px 18px;background:#fff6df}.tools{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}input,button,select{font:inherit;padding:10px}button{cursor:pointer}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:left;padding:12px;border-bottom:1px solid #ddd;vertical-align:top}code{overflow-wrap:anywhere;font-size:12px}td small{display:block;margin-top:8px}#summary{font-weight:600}input[type=checkbox]{min-width:24px;min-height:24px}
</style></head><body><main><h1>TidyGuardian review</h1>
<p class="notice">Nothing here changes your source files. Exporting a selection is NOT permission to execute. Moving and quarantining require separate terminal confirmation. Permanent deletion is disabled. Quarantine does not free disk space.</p>
<p id="root"></p><p id="hash"></p><div class="tools"><input id="search" aria-label="Search paths" placeholder="Search paths or reasons"><select id="action" aria-label="Action filter"><option value="">All actions</option><option>MOVE</option><option>QUARANTINE</option><option>METADATA</option><option>RESTORE</option></select><button id="select">Select visible</button><button id="clear">Clear selection</button><button id="export">Export selection.json</button></div><p id="summary" role="status"></p>
<div class="scroll"><table><thead><tr><th>Select</th><th>Action</th><th>Source / retained copy</th><th>Exact destination / reason</th></tr></thead><tbody id="rows"></tbody></table></div>
<p>Changing paths or classifications requires a new plan. No network service, upload or background execution is used.</p>
<script id="plan" type="application/json">__PLAN__</script><script>
'use strict';
const plan=JSON.parse(document.getElementById('plan').textContent), selected=new Set();
const el=id=>document.getElementById(id);
el('root').textContent='Root: '+plan.root;el('hash').textContent='Plan SHA-256: '+plan.plan_hash;
function visible(){const q=el('search').value.toLowerCase(), action=el('action').value;return plan.operations.filter(o=>(!action||o.action===action)&&[o.src,o.dest,o.keep||'',o.reason].join(' ').toLowerCase().includes(q));}
function render(){el('rows').replaceChildren();for(const o of visible()){const tr=document.createElement('tr'), box=document.createElement('input');box.type='checkbox';box.checked=selected.has(o.id);box.setAttribute('aria-label','Select '+o.id+' '+o.src);box.onchange=()=>{box.checked?selected.add(o.id):selected.delete(o.id);summary();};const cells=Array.from({length:4},()=>document.createElement('td'));cells[0].append(box);cells[1].textContent=o.action;const src=document.createElement('code');src.textContent=o.src;cells[2].append(src);if(o.keep){const keep=document.createElement('small');keep.textContent='RETAIN: '+o.keep;cells[2].append(keep);}const dest=document.createElement('code');dest.textContent=o.dest;const reason=document.createElement('small');reason.textContent=o.reason;cells[3].append(dest,reason);tr.append(...cells);el('rows').append(tr);}summary();}
function summary(){el('summary').textContent=selected.size+' selected / '+plan.operations.length+' proposed. '+visible().length+' visible.';el('export').disabled=selected.size===0;}
el('search').oninput=render;el('action').onchange=render;el('select').onclick=()=>{visible().forEach(o=>selected.add(o.id));render();};el('clear').onclick=()=>{selected.clear();render();};
el('export').onclick=()=>{const data={plan_hash:plan.plan_hash,ids:plan.operations.filter(o=>selected.has(o.id)).map(o=>o.id)};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};render();
</script></main></body></html>'''
    write_new(folder / "review.html", page.replace("__PLAN__", data))
