/* Salamandras 13F - ponto e previsoes PDF; usa dados reais RPC protegidos */
'use strict';
(function(){
const m=window.Salamandras13;if(!m)return;const old=m.rh;
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dia=s=>String(s||'').slice(0,10).split('-').reverse().join('/');
const tempo=s=>s?new Date(s).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}):'—';
const hoje=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const moeda=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const tab=(cols,rows)=>'<div class="rolagem"><table class="tabela"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="'+cols.length+'">Sem registros</td></tr>')+'</tbody></table></div>';
const card=(tit,txt)=>'<section class="card"><h2>'+esc(tit)+'</h2>'+txt+'</section>';
const toMin=s=>s?Number(s.slice(0,2))*60+Number(s.slice(3,5)):null;
const fmt=n=>n==null?'—':Math.floor(n/60)+'h'+String(n%60).padStart(2,'0');
async function render(ctx){
const root=document.createElement('section');root.id='rh13f';const c=el('conteudo');c.appendChild(root);
[...c.querySelectorAll('details.rh13-details')].filter(d=>d.querySelector('summary')?.textContent.startsWith('Gestão de ponto')).forEach(d=>d.remove());
const info=await ctx.rpc('api_13_rh_listar',{p_empresa:ctx.tenant});
const people=(info.funcionarios||[]).slice().sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
let data={pontos:[],folhas:[]},jobs=[],index=0;
root.innerHTML=card('Gestão de ponto — Hoje','<p class="muted">Somente entradas e saídas do dia. Clique para abrir cada lista.</p><div id="f-dia"></div>')+
card('Histórico completo por funcionário','<div class="formgrid"><label>Mês <input id="f-mes" type="month" value="'+hoje().slice(0,7)+'"></label><label>Pesquisar funcionário <input id="f-busca" type="search"></label></div><div class="rh13f-nav"><button type="button" id="f-prev" class="sec">‹ Anterior</button><strong id="f-nome"></strong><button type="button" id="f-next" class="sec">Próximo ›</button></div><div id="f-hist"></div>')+
card('Jornada de trabalho','<p class="muted">O intervalo é pré-assinalado; não exige ponto de almoço. Horas extras exibidas são estimativas até aprovação.</p><form id="f-jornada" class="formgrid"><label>Funcionário<select name="usuario">'+people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nome||p.email)+'</option>').join('')+'</select></label><label>Entrada prevista<input name="entrada" type="time" required></label><label>Saída prevista<input name="saida" type="time" required></label><label>Intervalo (min)<input name="intervalo" type="number" min="0" max="240" value="60"></label><button>Salvar jornada</button></form>')+
card('Baixar PDF — previsão de folha','<p class="rh13-warning">Documento preliminar, não é holerite oficial. Somente valores existentes no Supabase.</p><label><input id="f-all" type="checkbox"> Selecionar todos</label><div id="f-employees"></div><p><button type="button" id="f-pdf">Baixar PDF dos selecionados</button></p><p id="f-status" class="muted"></p>');
const visible=()=>people.filter(p=>String(p.nome||p.email).toLowerCase().includes(el('f-busca').value.toLowerCase()));
const job=id=>jobs.find(j=>j.usuario_id===id)||{};
const records=id=>{
 const groups=new Map();
 for(const p of data.pontos||[]){if(p.usuario_id!==id)continue;let d=String(p.dia).slice(0,10);if(!groups.has(d))groups.set(d,[]);groups.get(d).push(p);}
 return [...groups].sort((a,b)=>b[0].localeCompare(a[0]));
};
function extra(r,p){
const inP=r.find(x=>x.tipo==='entrada'),outP=r.find(x=>x.tipo==='saida'),j=job(p.id);
if(!inP||!outP||!j.entrada||!j.saida)return null;
const shift=(toMin(j.saida)-toMin(j.entrada)+1440)%1440;
const worked=Math.round((new Date(outP.batido_em)-new Date(inP.batido_em))/60000);
return Math.max(0,worked-shift);
}
function renderLists(){
const pts=(data.pontos||[]).filter(p=>p.dia===hoje());
el('f-dia').innerHTML=['entrada','saida'].map(type=>'<details class="card rh13-details"><summary>'+(type==='entrada'?'Entradas':'Saídas')+' ('+pts.filter(p=>p.tipo===type).length+')</summary>'+tab(['Funcionário','Horário','Localização'],pts.filter(p=>p.tipo===type).map(x=>'<tr><td>'+esc(people.find(p=>p.id===x.usuario_id)?.nome||'—')+'</td><td>'+tempo(x.batido_em)+'</td><td>'+(x.latitude==null?'Não informada':'Informada')+'</td></tr>').join(''))+'</details>').join('');
}
function renderPerson(){
const arr=visible();if(index>=arr.length)index=0;if(index<0)index=arr.length-1;
const p=arr[index];el('f-nome').textContent=p?.nome||'Nenhum funcionário';
if(!p){el('f-hist').textContent='Nenhum resultado';return;}
let sum=0;
const rows=records(p.id).map(([d,pts])=>{
const e=pts.find(x=>x.tipo==='entrada'),s=pts.find(x=>x.tipo==='saida'),x=extra(pts,p);
if(x!=null)sum+=x;
return '<tr><td>'+dia(d)+'</td><td>'+tempo(e?.batido_em)+'</td><td>'+tempo(s?.batido_em)+'</td><td>'+fmt(x)+'</td><td>'+(pts.some(v=>v.latitude!=null)?'Informada':'Não informada')+'</td></tr>';
}).join('');
el('f-hist').innerHTML='<p><b>Extras estimadas: '+fmt(sum)+'</b> · Adicional configurado: '+esc(p.percentual_extra??50)+'% · A conferir pelo RH.</p>'+tab(['Dia','Entrada','Saída','Extra estimada','Localização'],rows);
}
function renderSelection(){
el('f-employees').innerHTML=people.map(p=>'<label style="display:block;margin:8px 0"><input class="f-choice" type="checkbox" value="'+esc(p.id)+'"> '+esc(p.nome||p.email)+'</label>').join('');
el('f-all').checked=false;
}
function fill(){
const form=el('f-jornada'),j=job(form.elements.usuario.value);
form.elements.entrada.value=String(j.entrada||'').slice(0,5);
form.elements.saida.value=String(j.saida||'').slice(0,5);
form.elements.intervalo.value=j.intervalo_minutos??60;
}
async function load(){
const comp=el('f-mes').value+'-01';
const r=await Promise.all([ctx.rpc('api_13f_rh_historico',{p_empresa:ctx.tenant,p_competencia:comp}),ctx.rpc('api_13f_jornadas',{p_empresa:ctx.tenant})]);
data=r[0]||data;jobs=r[1]||[];renderLists();renderPerson();renderSelection();fill();
}
el('f-mes').onchange=()=>load().catch(e=>ctx.falha(e));
el('f-busca').oninput=()=>{index=0;renderPerson()};
el('f-prev').onclick=()=>{index--;renderPerson()};
el('f-next').onclick=()=>{index++;renderPerson()};
el('f-all').onchange=e=>root.querySelectorAll('.f-choice').forEach(c=>c.checked=e.target.checked);
el('f-jornada').elements.usuario.onchange=fill;
el('f-jornada').onsubmit=async e=>{
e.preventDefault();const f=e.currentTarget;
try{await ctx.rpc('api_13f_jornada_salvar',{p_empresa:ctx.tenant,p_usuario:f.elements.usuario.value,p_entrada:f.elements.entrada.value,p_saida:f.elements.saida.value,p_intervalo:Number(f.elements.intervalo.value)});ctx.aviso('Jornada salva');await load()}catch(err){ctx.falha(err)}
};
el('f-pdf').onclick=async()=>{
const btn=el('f-pdf');btn.disabled=true;
try{
const ids=[...root.querySelectorAll('.f-choice:checked')].map(c=>c.value);
if(!ids.length)throw Error('Selecione um ou mais funcionários.');
const sheets=ids.map(id=>({p:people.find(x=>x.id===id),f:(data.folhas||[]).find(x=>x.usuario_id===id)})).filter(x=>x.f);
if(!sheets.length)throw Error('Não há previsões de folha salvas para os selecionados nesta competência.');
if(!window.jspdf?.jsPDF)await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';s.onload=ok;s.onerror=()=>no(Error('Falha ao carregar biblioteca PDF'));document.head.appendChild(s)});
if(!window.jspdf?.jsPDF)throw Error('Biblioteca PDF indisponível.');
const pdf=new window.jspdf.jsPDF();
sheets.forEach(({p,f},i)=>{
if(i)pdf.addPage();pdf.setFontSize(15);pdf.text('Salamandras - Previsao de folha',16,22);
pdf.setFontSize(9);pdf.text('PRELIMINAR - NAO E HOLERITE OFICIAL',16,30);
const values=[['Funcionario',p.nome||p.email],['Competencia',el('f-mes').value],['Salario-base',moeda(f.salario_base)],['Horas extras',String(f.horas_extras||0)],['Valor extras',moeda(f.valor_extras)],['Bonus',moeda(f.bonus)],['Total bruto',moeda(f.total_bruto)],['Descontos',moeda(f.descontos)],['Liquido estimado',moeda(f.liquido_estimado)],['Situacao',f.status]];
pdf.setFontSize(11);let y=48;for(const [k,v] of values){pdf.text(k+':',16,y);pdf.text(pdf.splitTextToSize(String(v??''),95),97,y);y+=17;}
pdf.setFontSize(8);pdf.text('Confira INSS, IRRF, encargos, beneficios e convencao coletiva antes de pagar.',16,274);
});
pdf.save('Salamandras_previsoes_'+el('f-mes').value+'.pdf');
el('f-status').textContent='PDF com '+sheets.length+' previsão(ões). '+(ids.length-sheets.length)+' funcionários não tinham previsão salva.';
}catch(err){ctx.falha(err);el('f-status').textContent=err.message}finally{btn.disabled=false}
};
await load();
}
m.rh=async ctx=>{await old(ctx);try{await render(ctx)}catch(e){ctx.falha(e)}};
m.ponto=async ctx=>{
const rows=await ctx.rpc('api_13_ponto_meu',{p_empresa:ctx.tenant,p_dias:31});
const pts=(rows||[]).filter(p=>p.dia===hoje()),next=!pts.some(p=>p.tipo==='entrada')?'entrada':!pts.some(p=>p.tipo==='saida')?'saida':null;
const labels={entrada:'Entrada',saida:'Saída',intervalo_inicio:'Intervalo antigo',intervalo_fim:'Fim do intervalo antigo'};
ctx.container(card('Registro de Ponto','<p class="muted">Somente entrada e saída. Intervalo pré-assinalado pelo RH. Horário do servidor.</p><p><b>Próximo:</b> '+(next?labels[next]:'Jornada registrada')+'</p><label><input id="f-geo" type="checkbox"> Informar localização (opcional)</label><p><button id="f-bater" '+(next?'':'disabled')+'>Registrar '+(next?labels[next]:'ponto')+'</button></p>')+card('Histórico',tab(['Dia','Tipo','Hora'],(rows||[]).map(r=>'<tr><td>'+dia(r.dia)+'</td><td>'+esc(labels[r.tipo]||r.tipo)+'</td><td>'+tempo(r.batido_em)+'</td></tr>').join(''))));
if(!next)return;
el('f-bater').onclick=async()=>{el('f-bater').disabled=true;try{
let lat=null,lng=null;if(el('f-geo').checked){const p=await new Promise((ok,no)=>navigator.geolocation.getCurrentPosition(ok,no,{timeout:10000}));lat=p.coords.latitude;lng=p.coords.longitude}
await ctx.rpc('api_13_ponto_bater',{p_empresa:ctx.tenant,p_tipo:next,p_lat:lat,p_lng:lng});ctx.aviso('Ponto registrado');await m.ponto(ctx)
}catch(e){ctx.falha(e);el('f-bater').disabled=false}};
};
})();