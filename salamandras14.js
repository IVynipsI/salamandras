'use strict';
/* Salamandras 14 - multiempresa, setores e catalogo tecnico */
window.Salamandras14=(()=>{
const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const card=(title,body)=>'<section class="card"><h2>'+esc(title)+'</h2>'+body+'</section>';
const opts=(items,value,label)=>items.map(i=>'<option value="'+esc(i[value])+'">'+esc(i[label])+'</option>').join('');
const tbl=(heads,rows)=>'<div class="rolagem"><table class="tabela"><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="'+heads.length+'">Nenhum registro</td></tr>')+'</tbody></table></div>';
const when=(id,event,fn)=>{if(el(id))el(id).addEventListener(event,fn)};
async function producao(ctx){
let search='',state;
try{state=await ctx.rpc('api_14_painel',{p_empresa:ctx.tenant,p_busca:''})}
catch(err){ctx.container(card('Esteira de produção','Primeiro execute o SQL 14 no Supabase. '+esc(err.message)));return}
function draw(){
const stages=state.etapas||[],items=state.itens||[],priorities=state.prioridades||[],manager=state.gestor,staff=state.funcionarios||[];
const stageNames=Object.fromEntries(stages.map(x=>[x.id,x.nome]));
const stageOpts=opts(stages,'id','nome'),itemOpts=items.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.codigo)+'</option>').join('');
const prioritiesList=priorities.map(p=>{const i=items.find(x=>x.id===p.item_id);
return '<tr><td>'+esc(i?.codigo||'Item não carregado')+'</td><td>'+esc(p.etapa_id?stageNames[p.etapa_id]||'Setor':'Geral')+'</td><td>'+esc(p.nivel)+'</td><td>'+esc(i?.localizacao||'—')+'</td><td>'+esc(i?.etapa_id?stageNames[i.etapa_id]||'Outro setor':'—')+'</td><td>'+esc(p.motivo)+'</td></tr>'}).join('');
const byStage=stages.map(s=>{
 const group=items.filter(i=>i.etapa_id===s.id);
 const rows=group.map(i=>{
 const actions=(i.situacao==='aguardando'?'<button type="button" data-action="iniciar" data-item="'+esc(i.id)+'" class="small">Iniciar</button>':'')+
 (i.situacao==='em_andamento'?'<button type="button" data-action="concluir" data-item="'+esc(i.id)+'" class="small">Concluir</button>':'')+
 (manager&&i.situacao!=='concluido'?'<button type="button" data-action="pular" data-item="'+esc(i.id)+'" class="sec small">Pular</button>':'')+
 (manager?'<button type="button" data-action="localizar" data-item="'+esc(i.id)+'" class="sec small">Localizar</button>':'');
 return '<article class="erp14-item" style="padding:10px;border-bottom:1px solid var(--line,#ddd)"><b>'+esc(i.codigo)+'</b> '+(i.prioridade_geral||i.prioridade_setor?'<span class="tag">PRIORIDADE</span>':'')+
 '<p>'+esc(i.descricao||'')+'</p><small>Local: '+esc(i.localizacao||'Não informada')+' · '+esc(i.situacao)+'</small><div class="acoes">'+actions+'</div></article>';
 }).join('');
 return '<details class="card rh13-details" open><summary>'+esc(s.nome)+' ('+group.length+')</summary><p class="muted">'+esc(s.checklist||'Lista operacional do setor')+'</p>'+rows+'</details>';
 }).join('');
let admin='';
if(manager)admin=card('Configurar esteira e prioridades',
'<details class="rh13-details"><summary>Criar etapa</summary><form id="s14-stage" class="formgrid"><label>Nome<input required name="nome"></label><label>Checklist / conferência<input name="checklist"></label><label><input type="checkbox" name="foto"> Exigir foto (somente após ativar armazenamento seguro)</label><button>Criar etapa</button></form></details>'+
'<details class="rh13-details"><summary>Cadastrar pedido ou equipamento</summary><form id="s14-item" class="formgrid"><label>Número / código<input required name="codigo"></label><label>Descrição<input name="descricao"></label><label>Localização<input name="local"></label><button>Cadastrar</button></form></details>'+
'<details class="rh13-details"><summary>Lançar prioridade geral ou por setor</summary><form id="s14-prio" class="formgrid"><label>Item<select required name="item"><option value="">Selecione</option>'+itemOpts+'</select></label><label>Destino<select name="etapa"><option value="">Todos os setores</option>'+stageOpts+'</select></label><label>Nível<select name="nivel"><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label><label>Instrução<input name="motivo"></label><button>Lançar prioridade</button></form></details>'+
'<details class="rh13-details"><summary>Permissões da equipe</summary><form id="s14-access" class="formgrid"><label>Funcionário<select required name="usuario">'+opts(staff,'id','nome')+'</select></label><label>Setor<select name="etapa" required>'+stageOpts+'</select></label><label><input name="gestor" type="checkbox"> Autorizar gestão de todos os setores</label><button>Conceder acesso</button></form></details>');
ctx.container('<h1>Esteira de produção</h1>'+card('Pesquisar','<label>Máquina, código, pedido ou localização<input id="s14-search" type="search" placeholder="Pesquisar em sua fila" value="'+esc(search)+'"></label>')+
card('Prioridades atribuídas',tbl(['Item','Destino','Nível','Local','Etapa atual','Instrução'],prioritiesList))+admin+card('Filas por setor',byStage||'O gestor deve cadastrar as etapas.')+
card('Rastreamento','Cada etapa concluída encaminha automaticamente o item para a próxima. Só gestores podem pular etapas, com justificativa. O sistema registra as movimentações no banco.'));
when('s14-search','change',async ev=>{
search=ev.target.value;try{state=await ctx.rpc('api_14_painel',{p_empresa:ctx.tenant,p_busca:search});draw()}catch(e){ctx.falha(e)}});
async function write(api,args){try{ctx.aviso(await ctx.rpc(api,{p_empresa:ctx.tenant,...args}));state=await ctx.rpc('api_14_painel',{p_empresa:ctx.tenant,p_busca:search});draw()}catch(e){ctx.falha(e)}}
const bindings=[
['s14-stage','api_14_etapa_criar',f=>({p_nome:f.get('nome'),p_checklist:f.get('checklist')||'',p_exigir_foto:f.get('foto')==='on'})],
['s14-item','api_14_item_criar',f=>({p_codigo:f.get('codigo'),p_descricao:f.get('descricao')||'',p_localizacao:f.get('local')||''})],
['s14-prio','api_14_priorizar',f=>({p_item:f.get('item'),p_etapa:f.get('etapa')||null,p_nivel:f.get('nivel'),p_motivo:f.get('motivo')||''})],
['s14-access','api_14_acesso_salvar',f=>({p_usuario:f.get('usuario'),p_etapa:f.get('etapa'),p_gestor:f.get('gestor')==='on'})]];
for(const [id,api,args] of bindings)when(id,'submit',e=>{e.preventDefault();write(api,args(new FormData(e.currentTarget)))});
document.querySelectorAll('[data-action][data-item]').forEach(b=>b.addEventListener('click',()=>{
let observation='';
if(b.dataset.action==='pular'){observation=prompt('Justifique por que a etapa será pulada:')||'';if(observation.trim().length<5)return}
if(b.dataset.action==='localizar'){observation=prompt('Informe a nova localização:')||'';if(!observation.trim())return}
if(b.dataset.action==='concluir'){observation=prompt('Observação/checklist da etapa:')||''}
write('api_14_etapa_acao',{p_item:b.dataset.item,p_acao:b.dataset.action,p_observacao:observation})}));
}
draw();
}
async function catalogo(ctx){
const section=document.createElement('section');section.id='s14-catalogo';el('conteudo').appendChild(section);
let q='';
async function render(){
let data;try{data=await ctx.rpc('api_14_catalogo_listar',{p_empresa:ctx.tenant,p_busca:q})}
catch(e){section.innerHTML=card('Cadastro técnico de produtos','Execute o SQL 14. '+esc(e.message));return}
const rows=(data||[]).map(i=>'<tr><td><b>'+esc(i.nome)+'</b><br><small>'+esc((i.nomes_alternativos||[]).join(', '))+'</small></td><td>'+esc(i.tipo)+'</td><td>'+
esc(i.codigo_interno)+' / '+esc(i.codigo_global)+'</td><td>'+esc(i.fornecedor_nome)+'<br><small>'+esc(i.codigo_fornecedor)+'</small></td></tr>').join('');
section.innerHTML=card('Pesquisa técnica, peças e fornecedores',
'<p class="muted">Busque por nome técnico, apelido, código interno, OEM/global ou código do fornecedor.</p>'+
'<label>Pesquisar referências<input id="s14-search-catalog" type="search" value="'+esc(q)+'" placeholder="Ex.: placa lateral"></label>'+
tbl(['Produto e sinônimos','Tipo','Código interno/global','Fornecedor'],rows)+
'<details class="rh13-details"><summary>Cadastrar referência, códigos e fornecedor</summary><form id="s14-add-catalog" class="formgrid">'+
'<label>Nome técnico<input name="nome" required></label>'+
'<label>Tipo<select name="tipo"><option value="produto">Produto</option><option value="materia-prima">Matéria-prima</option><option value="peca">Peça</option><option value="equipamento">Equipamento</option></select></label>'+
'<label>Código interno<input name="codigo"></label><label>Código universal / OEM<input name="global"></label>'+
'<label>Fabricante<input name="fabricante"></label><label>Sinônimos (vírgula)<input name="sinonimos"></label>'+
'<label>Fornecedor<input name="fornecedor"></label><label>Código do fornecedor<input name="codigo_fornecedor"></label>'+
'<button>Cadastrar referência</button></form></details>'+
'<p class="muted">Aprendizado supervisionado de sinônimos e publicação automática no Mercado Livre/Shopee dependem de integrações adicionais; ainda não estão ativados.</p>');
when('s14-search-catalog','change',e=>{q=e.target.value;render()});
when('s14-add-catalog','submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);
try{ctx.aviso(await ctx.rpc('api_14_catalogo_criar',{p_empresa:ctx.tenant,p_nome:f.get('nome'),p_tipo:f.get('tipo'),
p_codigo:f.get('codigo')||'',p_global:f.get('global')||'',p_fabricante:f.get('fabricante')||'',
p_sinonimos:f.get('sinonimos')||'',p_fornecedor:f.get('fornecedor')||'',p_codigo_fornecedor:f.get('codigo_fornecedor')||''}));render()}catch(x){ctx.falha(x)}});
}
await render();
}
async function bot(ctx){
const section=document.createElement('section');section.id='s14-bot';el('conteudo').appendChild(section);
try{
const s=await ctx.rpc('api_14_bot_config',{p_empresa:ctx.tenant});
section.innerHTML=card('Atendimento automático do WhatsApp',
'<p class="muted">Cada empresa possui sua própria configuração. O bot responde pelo número conectado à Meta.</p>'+
'<form id="s14-bot-form"><label><input name="ativo" type="checkbox" '+(s.ativo?'checked':'')+'> Ativar respostas automáticas</label>'+
'<p>Número: <strong>'+(s.conectado?'Conectado':'Aguardando vinculação na Meta')+'</strong></p>'+
'<button>Salvar</button></form>'+
'<p class="muted">Mensagem inicial com opções: 1 Catálogo, 2 Pedidos, 3 Atendente. A saudação não se repete a cada mensagem.</p>');
when('s14-bot-form','submit',async e=>{e.preventDefault();try{
ctx.aviso(await ctx.rpc('api_14_bot_ativar',{p_empresa:ctx.tenant,p_ativo:e.currentTarget.elements.ativo.checked}))
}catch(x){ctx.falha(x)}});
}catch(x){section.innerHTML=card('Bot WhatsApp','Execute o SQL 14 para configurar. '+esc(x.message))}
}
return {producao,catalogo,bot};
})();