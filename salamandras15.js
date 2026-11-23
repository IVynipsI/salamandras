'use strict';
/* Salamandras 15B - administracao por empresa; toda gravacao via RPC RLS */
window.Salamandras15=(()=>{
 const $=id=>document.getElementById(id);
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const defaults=[
 {numero:'1',titulo:'Ver catálogo',tipo:'catalogo',resposta:''},
 {numero:'2',titulo:'Consultar pedido',tipo:'pedido',resposta:'Informe o número do pedido para nossa equipe.'},
 {numero:'3',titulo:'Falar com atendente',tipo:'humano',resposta:''}
 ];
 const tipos=[['texto','Resposta personalizada'],['catalogo','Catálogo do WhatsApp'],['pedido','Consultar pedido / solicitar número'],['humano','Atendimento humano'],['menu','Voltar ao menu']];
 const choices=tipo=>tipos.map(([v,n])=>'<option value="'+v+'" '+(v===tipo?'selected':'')+'>'+E(n)+'</option>').join('');
 const field=(name,label,value='',area=false)=>'<label>'+E(label)+(area?'<textarea name="'+name+'" rows="2">'+E(value)+'</textarea>':'<input name="'+name+'" value="'+E(value)+'">')+'</label>';
 async function bot(ctx){
  const root=document.createElement('section');root.className='erp15-config';root.id='erp15-bot';$('conteudo').appendChild(root);
  let data;
  try{data=await ctx.rpc('api_15_bot_ler',{p_empresa:ctx.tenant})}catch(e){root.innerHTML='<section class="card"><h2>Configuração do bot</h2><p>Execute o SQL 15B antes de configurar: '+E(e.message)+'</p></section>';return}
  const options=Array.isArray(data?.menu)&&data.menu.length?data.menu:defaults;
  const admin=ctx.pode('adm');
  root.innerHTML='<section class="card"><div class="linha"><div><h2>Central do WhatsApp</h2><p class="muted">Cada empresa controla seu atendimento, mensagens e catálogo.</p></div><strong>'+E(data?.conectado?'Número conectado à Meta':'Vinculação Meta pendente')+'</strong></div>'+
  (admin?'<form id="erp15-bot-form">'+
   '<details open><summary>Telefone e mensagens</summary><div class="formgrid">'+
   field('telefone','WhatsApp comercial (DDD)',data?.telefone_comercial||'')+
   field('boas_vindas','Boas-vindas',data?.boas_vindas||'Olá! Seja bem-vindo(a)!',true)+
   field('mensagem_invalida','Resposta para opção desconhecida',data?.mensagem_invalida||'Escolha uma opção do menu.',true)+
   field('mensagem_humano','Mensagem de atendimento humano',data?.mensagem_humano||'Nossa equipe continuará o atendimento.',true)+
   '</div><p class="muted">Exemplo: (99) 99999-9999. Cadastrar o telefone não conecta a conta à Meta. A vinculação oficial exige autorização da empresa na Meta.</p></details>'+
   '<details open><summary>Menu numerado e ações</summary><p class="muted">Adicione quantas opções precisar. Cada cliente digita o número para obter a resposta configurada.</p>'+
   '<div id="erp15-options"></div><button type="button" class="sec small" id="erp15-add">+ Adicionar opção</button></details>'+
   '<button type="submit">Salvar mensagens e menu</button></form>'+
   '<details><summary>Ativação do atendimento</summary><form id="erp15-active"><label class="linha"><input type="checkbox" name="ativo" '+(data?.ativo?'checked':'')+'> Respostas automáticas ativadas</label><button>Salvar ativação</button></form></details>':
   '<p>Somente ADM/DEV pode modificar o atendimento automático.</p>')+'</section>'+
   '<section class="card"><h2>Cardápios independentes</h2><p class="muted">Escolha quais produtos aparecem no site e quais aparecem no WhatsApp. Produtos novos entram nos dois por padrão.</p><div id="erp15-produtos">Carregando produtos...</div></section>';
  if(admin){
   const list=$('erp15-options');
   function add(o){
    const div=document.createElement('div');div.className='erp15-opcao';
    div.innerHTML='<label>Número<input data-number inputmode="numeric" pattern="[1-9][0-9]*" maxlength="5" required value="'+E(o.numero||'')+'"></label>'+
    '<label>Nome da opção<input data-title maxlength="90" required value="'+E(o.titulo||'')+'"></label>'+
    '<label>Ação<select data-type>'+choices(o.tipo||'texto')+'</select></label>'+
    '<label>Mensagem da ação<input data-reply maxlength="1500" value="'+E(o.resposta||'')+'" placeholder="Opcional para catálogo e atendente"></label>'+
    '<button type="button" class="sec small" data-remove>Remover</button>';
    div.querySelector('[data-remove]').onclick=()=>div.remove();list.appendChild(div);
   }
   options.forEach(add);
   $('erp15-add').onclick=()=>{
    const ids=[...list.querySelectorAll('[data-number]')].map(n=>Number(n.value)).filter(Number.isFinite);
    let next=1;while(ids.includes(next))next++;add({numero:String(next),titulo:'',tipo:'texto',resposta:''});
   };
   $('erp15-bot-form').onsubmit=async e=>{
    e.preventDefault();
    const menu=[...list.querySelectorAll('.erp15-opcao')].map(div=>({
      numero:div.querySelector('[data-number]').value.trim(),titulo:div.querySelector('[data-title]').value.trim(),
      tipo:div.querySelector('[data-type]').value,resposta:div.querySelector('[data-reply]').value.trim()
    }));
    if(!menu.length){ctx.falha(new Error('Adicione pelo menos uma opção.'));return}
    const nums=menu.map(o=>o.numero);
    if(new Set(nums).size!==nums.length){ctx.falha(new Error('Os números do menu precisam ser únicos.'));return}
    const form=new FormData(e.currentTarget);
    try{ctx.aviso(await ctx.rpc('api_15_bot_salvar',{
      p_empresa:ctx.tenant,p_telefone:String(form.get('telefone')||''),
      p_boas_vindas:String(form.get('boas_vindas')||''),
      p_mensagem_invalida:String(form.get('mensagem_invalida')||''),
      p_mensagem_humano:String(form.get('mensagem_humano')||''),p_menu:menu
    }))}catch(x){ctx.falha(x)}
   };
   $('erp15-active').onsubmit=async e=>{e.preventDefault();try{
    ctx.aviso(await ctx.rpc('api_14_bot_ativar',{p_empresa:ctx.tenant,p_ativo:e.currentTarget.elements.ativo.checked}))
   }catch(x){ctx.falha(x)}};
  }
  async function catalog(){
   const host=$('erp15-produtos');if(!host)return;
   try{
    const arr=await ctx.rpc('api_15_produtos_ler',{p_empresa:ctx.tenant});
    const itens=Array.isArray(arr)?arr:[];
    host.innerHTML=itens.length?'<div class="erp15-produtos">'+itens.map(p=>
    '<div class="erp15-produto" data-product="'+E(p.id)+'"><strong>'+E(p.nome)+'</strong>'+
    '<div class="linha"><label><input type="checkbox" data-site '+(p.site?'checked':'')+' '+(!admin?'disabled':'')+'> Site</label>'+
    '<label><input type="checkbox" data-wa '+(p.whatsapp?'checked':'')+' '+(!admin?'disabled':'')+'> WhatsApp</label>'+
    (admin?'<button type="button" class="sec small" data-save>Salvar</button>':'')+'</div></div>').join('')+'</div>':'<p class="muted">Cadastre produtos na aba Produtos para escolher o que publicar.</p>';
    if(admin)host.querySelectorAll('[data-save]').forEach(btn=>btn.onclick=async()=>{
      const parent=btn.closest('[data-product]');
      try{ctx.aviso(await ctx.rpc('api_15_produto_salvar',{
       p_empresa:ctx.tenant,p_produto:parent.dataset.product,p_site:parent.querySelector('[data-site]').checked,
       p_whatsapp:parent.querySelector('[data-wa]').checked
      }))}catch(x){ctx.falha(x)}
    });
   }catch(x){host.textContent='Erro ao carregar catálogo: '+x.message}
  }
  await catalog();
 }
 async function beneficios(ctx){
  const root=document.createElement('section');root.className='erp15-config';root.id='erp15-beneficios';$('conteudo').appendChild(root);
  let data;
  try{data=await ctx.rpc('api_15_beneficios_ler',{p_empresa:ctx.tenant})}catch(e){root.innerHTML='<section class="card"><h2>Cortesias e descontos</h2><p>Execute o SQL 15B: '+E(e.message)+'</p></section>';return}
  const admin=ctx.pode('adm'),items=Array.isArray(data)?data:[];
  let selected=null;
  root.innerHTML='<section class="card"><h2>Cortesias e descontos</h2><p class="muted">O ADM cria regras para a própria empresa, sem benefício obrigatório ou bolo de fubá fixo.</p>'+
   '<div id="erp15-benefits-list">'+(items.length?items.map(x=>
    '<div class="erp15-beneficio linha"><div><strong>'+E(x.nome)+'</strong><p class="muted">'+E(x.tipo)+' · '+E(x.criterio)+' · '+E(x.ativo?'Ativo':'Inativo')+'</p></div>'+
    (admin?'<button type="button" class="sec small" data-edit="'+E(x.id)+'">Editar</button><button type="button" class="danger small" data-delete="'+E(x.id)+'">Excluir</button>':'')+'</div>').join(''):'<p class="muted">Nenhuma regra cadastrada.</p>')+'</div>'+
   (admin?'<details id="erp15-benefit-editor"><summary>+ Configurar uma regra</summary><form id="erp15-benefit-form">'+
   '<div class="formgrid"><label>Nome<input name="nome" required minlength="2" maxlength="100"></label>'+
   '<label>Benefício<select name="tipo"><option value="cortesia">Cortesia / brinde</option><option value="percentual">Desconto %</option><option value="valor">Desconto R$</option></select></label>'+
   '<label>Valor / porcentagem<input name="valor" type="number" min="0" step="0.01" value="0" required></label>'+
   '<label>Quando oferecer<select name="criterio"><option value="manual">Somente manualmente</option><option value="pedido_numero">Número do pedido do cliente</option><option value="a_cada_n_pedidos">A cada N pedidos do cliente</option><option value="valor_minimo">Pedido a partir de R$</option></select></label>'+
   '<label>Número do pedido / limite<input name="parametro" type="number" min="0" step="0.01" value="0" required></label>'+
   '<label>Descrição da cortesia / condição<input name="descricao" maxlength="500" placeholder="Ex.: sobremesa, frete, produto..."></label></div>'+
   '<label class="linha"><input type="checkbox" name="ativo"> Regra ativa</label><p class="muted">O sistema armazena as regras; aplicação financeira automática em pedidos ainda não está habilitada.</p>'+
   '<div class="linha"><button type="submit">Salvar regra</button><button type="button" id="erp15-benefit-new" class="sec">Nova regra</button></div></form></details>':'')+'</section>';
  if(!admin)return;
  const form=$('erp15-benefit-form');
  const clear=()=>{selected=null;form.reset();form.elements.valor.value=0;form.elements.parametro.value=0};
  $('erp15-benefit-new').onclick=clear;
  root.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>{
   const item=items.find(x=>x.id===btn.dataset.edit);if(!item)return;
   selected=item.id;for(const key of ['nome','tipo','valor','criterio','parametro','descricao'])form.elements[key].value=item[key]??'';
   form.elements.ativo.checked=!!item.ativo;$('erp15-benefit-editor').open=true;form.elements.nome.focus();
  });
  root.querySelectorAll('[data-delete]').forEach(btn=>btn.onclick=async()=>{
   if(!confirm('Excluir esta regra da empresa?'))return;
   try{await ctx.rpc('api_15_beneficio_excluir',{p_empresa:ctx.tenant,p_id:btn.dataset.delete});ctx.aviso('Regra excluída');root.remove();beneficios(ctx)}catch(x){ctx.falha(x)}
  });
  form.onsubmit=async e=>{e.preventDefault();const d=new FormData(form);
   try{await ctx.rpc('api_15_beneficio_salvar',{p_empresa:ctx.tenant,p_id:selected,
    p_nome:String(d.get('nome')),p_tipo:String(d.get('tipo')),p_valor:Number(d.get('valor')),
    p_descricao:String(d.get('descricao')||''),p_criterio:String(d.get('criterio')),
    p_parametro:Number(d.get('parametro')),p_ativo:d.get('ativo')==='on'});
    ctx.aviso('Regra salva');root.remove();beneficios(ctx);
   }catch(x){ctx.falha(x)}
  };
 }
 return {bot,beneficios};
})();
