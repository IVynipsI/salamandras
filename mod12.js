/* Salamandras 12 - A Grande Atualização | UI modular, sem credenciais privadas.
   Todas as mutações passam pelas RPCs autorizadas do Supabase. */
'use strict';
window.Salamandras12 = (() => {
  const se = (ctx,html) => ctx.container(html);
  const E = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const C = (s)=>Number(s||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const F = s => s ? String(s).slice(0,10).split('-').reverse().join('/') : '—';
  const f = id => document.getElementById(id);
  const fila = (titulo,sub,icone,link)=>`<a class="erp12-tile" href="${E(link)}"><span class="erp12-tile-ico">${icone}</span><b>${E(titulo)}</b><span class="erp12-sub">${E(sub)}</span><span class="erp12-seta">Abrir →</span></a>`;
  const ac = (id,evento,cb)=>{const el=f(id);if(el)el.addEventListener(evento,cb)};
  function onForm(ctx,id,callback){
    ac(id,'submit',async e=>{
      e.preventDefault();const b=e.currentTarget.querySelector('[type=submit]');if(b)b.disabled=true;
      try{await callback(e.currentTarget)}catch(err){ctx.falha(err)}finally{if(b)b.disabled=false}
    });
  }
  const linkVoltar = '<p class="erp12-voltar"><a href="estoque.html">← Voltar ao Estoque</a></p>';
  const titulo = (nome,desc='')=>`<div class="erp12-titulo"><div><div class="erp12-kicker">SALAMANDRAS ERP</div><h1>${E(nome)}</h1>${desc?`<p class="muted">${E(desc)}</p>`:''}</div></div>`;
  const secoes = [
    ['Matérias-primas','Cadastros, lotes e validades','◫','estoque-ingredientes.html'],
    ['Localizações','Geladeiras, prateleiras e capacidades','▤','estoque-locais.html'],
    ['Compras','Fornecedores e recebimento de mercadorias','▣','estoque-compras.html'],
    ['Movimentações','Transferências, consumos e descartes','⇄','estoque-movimentacoes.html'],
    ['Custos e análises','Custos por lote e simulador de preços','▥','estoque-custos.html'],
    ['Alertas','Validades, faltas e lotes esgotados','♧','estoque-alertas.html']
  ];
  const tabela = (cabecalhos,linhas) => `<div class="rolagem"><table class="tabela"><thead><tr>${cabecalhos.map(x=>`<th>${E(x)}</th>`).join('')}</tr></thead><tbody>${linhas||`<tr><td colspan="${cabecalhos.length}" class="muted">Nenhum registro.</td></tr>`}</tbody></table></div>`;
  const opt = (arr,value,text)=>arr.map(x=>`<option value="${E(value(x))}">${E(text(x))}</option>`).join('');
  const num = x => Number(x||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
  async function alertas(ctx){return await ctx.rpc('api_12_alertas',{p_empresa:ctx.tenant})}
  async function alertasHTML(ctx,emEstoque=false){
    const dados=await alertas(ctx);
    const venc=dados?.vencimento||[],esg=dados?.esgotados||[],baixo=dados?.baixo||[];
    const itens=[];
    if(baixo.length)itens.push(`<details class="erp12-alerta critical"><summary>● ${baixo.length} ingrediente(s) com estoque baixo</summary><div class="erp12-alerta-corpo">${baixo.map(x=>`<p><b>${E(x.nome)}</b> — ${num(x.quantidade)} ${E(x.unidade)} (mínimo ${num(x.minimo)})</p>`).join('')}</div></details>`);
    if(venc.length)itens.push(`<details class="erp12-alerta warn"><summary>● ${venc.length} lote(s) perto da validade ou vencidos</summary><div class="erp12-alerta-corpo">${venc.map(x=>`<p><b>${E(x.ingrediente)} · Lote ${E(x.codigo)}</b> — ${x.dias<0?'Vencido há '+Math.abs(x.dias)+' dia(s)':x.dias===0?'Vence hoje':'Vence em '+x.dias+' dia(s)'} (${F(x.validade)}) · ${num(x.quantidade)} ${E(x.unidade)}</p>`).join('')}</div></details>`);
    if(esg.length)itens.push(`<details class="erp12-alerta neutral"><summary>● ${esg.length} lote(s) esgotado(s) aguardam leitura</summary><div class="erp12-alerta-corpo">${esg.map(x=>`<div class="erp12-alerta-linha"><span><b>${E(x.ingrediente)} · Lote ${E(x.codigo)}</b><small>Saldo zerado e histórico preservado</small></span><button type="button" class="sec small" data-lote-lido="${E(x.id)}">Confirmar leitura</button></div>`).join('')}</div></details>`);
    const html=`<div class="erp12-alertas">${itens.join('')||'<p class="muted">Nenhum alerta crítico no momento.</p>'}${emEstoque?'<a class="erp12-link" href="estoque-alertas.html">Central de alertas →</a>':''}</div>`;
    return {html,quantidade:baixo.length+venc.length+esg.length};
  }
  function habilitarLeitura(ctx,rerender){
    document.querySelectorAll('[data-lote-lido]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Confirmar que leu o aviso? O lote continuará no histórico.'))return;
      try{await ctx.rpc('api_12_confirmar_alerta',{p_empresa:ctx.tenant,p_lote:b.dataset.loteLido});ctx.aviso('Aviso reconhecido');await rerender()}
      catch(err){ctx.falha(err)}
    }));
  }
  async function estoque(ctx){
    const alert=await alertasHTML(ctx,true);
    se(ctx,`${titulo('Estoque','Almoxarifado · escolha a tarefa que deseja realizar')}
     <div class="erp12-estoque-layout"><div class="erp12-tiles">${secoes.map(x=>fila(...x)).join('')}</div>
     <aside class="card erp12-lateral"><h2>Avisos importantes ${alert.quantidade?`<span class="erp12-contador">${alert.quantidade}</span>`:''}</h2>${alert.html}</aside></div>`);
    habilitarLeitura(ctx,()=>estoque(ctx));
  }
  async function estoqueInterno(modulo,ctx){
    if(modulo==='estoque-alertas')return todosAlertas(ctx);
    if(modulo==='estoque-locais')return locais(ctx);
    if(modulo==='estoque-compras')return compras(ctx);
    if(modulo==='estoque-movimentacoes')return movimentacoes(ctx);
    if(modulo==='estoque-custos')return custos(ctx);
    se(ctx,titulo('Página em preparação'));
  }
  async function todosAlertas(ctx){
    const a=await alertasHTML(ctx,false);
    se(ctx,linkVoltar+titulo('Central de alertas','Avisos são abertos somente quando você solicitar')+`<div class="card"><h2>${a.quantidade} aviso(s) pendente(s)</h2>${a.html}</div>`);
    habilitarLeitura(ctx,()=>todosAlertas(ctx));
  }
  async function dadosEstoque(ctx){return await ctx.rpc('api_12_estoque',{p_empresa:ctx.tenant})}
  async function locais(ctx){
    const d=await dadosEstoque(ctx);const ls=d.locais||[],is=d.ingredientes||[],cs=d.capacidades||[],lotes=d.lotes||[],pos=d.posicoes||[];
    const podeEditar=ctx.pode('adm','logistica');
    const linhas=ls.map(l=>{
      const conteudos=pos.filter(p=>p.local_id===l.id).map(p=>{
        const lt=lotes.find(t=>t.id===p.lote_id);const ing=is.find(i=>i.id===lt?.ingrediente_id);
        return `${E(ing?.nome||'Ingrediente')} (lote ${E(lt?.codigo)}): ${num(p.quantidade)} ${E(ing?.unidade||'')}`;
      });
      const caps=cs.filter(c=>c.local_id===l.id).map(c=>`${E(is.find(i=>i.id===c.ingrediente_id)?.nome)}: até ${num(c.capacidade)}`).join(' · ');
      return `<tr><td><b>${E(l.nome)}</b><div class="muted">${E(l.area)}</div></td><td>${l.prioridade}</td>
       <td>${E(caps)||'Não configurada'}</td><td><details><summary>Ver conteúdo (${conteudos.length})</summary><div class="erp12-lista-texto">${conteudos.join('<br>')||'Vazio'}</div></details></td></tr>`;
    }).join('');
    se(ctx,linkVoltar+titulo('Localizações','O sistema respeita os espaços que a empresa configurar')+
      (podeEditar?`<div class="erp12-dois"><section class="card"><h2>Adicionar localização</h2>
      <form id="f-local" class="erp12-form"><label>Nome (ex.: Prateleira 1)<input name="nome" required minlength="2"></label>
      <label>Área livre (ex.: Depósito)<input name="area"></label><label>Prioridade (1 = maior preferência)<input name="prioridade" type="number" min="1" max="10" value="5" required></label>
      <button type="submit">Criar localização</button></form></section>
      <section class="card"><h2>Definir capacidade por matéria-prima</h2><form id="f-cap" class="erp12-form">
      <label>Local<select name="local" required>${opt(ls,l=>l.id,l=>l.nome)}</select></label>
      <label>Matéria-prima<select name="ing" required>${opt(is,i=>i.id,i=>`${i.nome} (${i.unidade})`)}</select></label>
      <label>Quantidade máxima na unidade cadastrada<input name="cap" type="number" min="0.001" step="0.001" required></label>
      <button type="submit">Salvar capacidade</button></form></section></div>`:'')+
     `<section class="card"><h2>Locais cadastrados</h2><details><summary class="erp12-summary">Ver lista de localizações (${ls.length})</summary>${tabela(['Local','Prioridade','Limites','Conteúdo'],linhas)}</details></section>`);
    onForm(ctx,'f-local',async form=>{
      await ctx.rpc('api_12_local_salvar',{p_empresa:ctx.tenant,p_nome:form.elements.nome.value,
      p_area:form.elements.area.value,p_prioridade:Number(form.elements.prioridade.value)});
      ctx.aviso('Local cadastrado');await locais(ctx);
    });
    onForm(ctx,'f-cap',async form=>{
      await ctx.rpc('api_12_capacidade_salvar',{p_empresa:ctx.tenant,p_local:form.elements.local.value,
      p_ingrediente:form.elements.ing.value,p_capacidade:Number(form.elements.cap.value)});
      ctx.aviso('Capacidade atualizada');await locais(ctx);
    });
  }
  async function compras(ctx){
    const d=await dadosEstoque(ctx);const forn=(d.fornecedores||[]).filter(x=>x.ativo),ingred=(d.ingredientes||[]).filter(i=>i.ativo),locais=(d.locais||[]).filter(l=>l.ativo);
    const podeEditar=ctx.pode('adm','logistica');
    const contato = n=>{let digits=String(n||'').replace(/\D/g,'');if(digits.length===10||digits.length===11)digits='55'+digits;return digits.length>=12&&digits.length<=15?`https://wa.me/${digits}`:null};
    const fornecedores=forn.map(x=>`<tr><td><b>${E(x.nome)}</b></td><td>${E(x.telefone||'—')}</td><td>${contato(x.telefone)?`<a class="erp12-whats" target="_blank" rel="noopener noreferrer" href="${contato(x.telefone)}">Conversar no WhatsApp ↗</a>`:'Número não cadastrado'}</td></tr>`).join('');
    se(ctx,linkVoltar+titulo('Compras e fornecedores','Contato direto para negociação; sem mensagens automáticas')+
      (podeEditar?`<div class="erp12-dois"><section class="card"><h2>Cadastrar fornecedor</h2><form id="f-fornecedor" class="erp12-form">
      <label>Nome<input name="nome" minlength="2" required></label><label>WhatsApp com DDD<input name="telefone" type="tel" placeholder="11999999999"></label>
      <label>CNPJ/CPF (opcional)<input name="documento"></label><label>E-mail (opcional)<input name="email" type="email"></label>
      <button type="submit">Salvar fornecedor</button></form></section>
      <section class="card"><h2>Receber compra</h2><form id="f-compra" class="erp12-form">
      <label>Matéria-prima<select name="ingrediente" required>${opt(ingred,i=>i.id,i=>`${i.nome} (${i.unidade})`)}</select></label>
      <label>Fornecedor<select name="fornecedor"><option value="">Não informado</option>${opt(forn,x=>x.id,x=>x.nome)}</select></label>
      <label>Quantidade (na unidade do ingrediente)<input name="quantidade" type="number" min="0.001" step="0.001" required></label>
      <label>Valor total da compra (R$)<input name="custo" type="number" min="0" step="0.01" required></label>
      <label>Validade<input name="validade" type="date" required></label>
      <label>Lote do fabricante (opcional)<input name="fabricante"></label>
      <button class="sec" type="button" id="sugerir-locais">Sugerir distribuição</button>
      <div id="alocacoes" class="erp12-alocacoes" aria-live="polite"><p class="muted">Escolha as quantidades e clique em sugerir; você poderá alterar.</p></div>
      <button type="submit">Confirmar entrada no estoque</button></form></section></div>`:'')+
      `<section class="card"><h2>Fornecedores cadastrados</h2><details><summary class="erp12-summary">Ver fornecedores (${forn.length})</summary>${tabela(['Nome','Telefone','Contato'],fornecedores)}</details></section>
      <section class="card"><h2>Compras anteriores</h2><details><summary class="erp12-summary">Ver histórico de lotes (${(d.lotes||[]).length})</summary>
      ${tabela(['Lote','Ingrediente','Validade','Saldo'],(d.lotes||[]).map(l=>`<tr><td>${E(l.codigo)}</td><td>${E(ingred.find(i=>i.id===l.ingrediente_id)?.nome||'—')}</td><td>${F(l.validade)}</td><td>${num(l.quantidade_atual)}</td></tr>`).join(''))}</details></section>`);
    onForm(ctx,'f-fornecedor',async form=>{
      await ctx.rpc('api_12_fornecedor_salvar',{p_empresa:ctx.tenant,p_nome:form.elements.nome.value,
      p_telefone:form.elements.telefone.value,p_documento:form.elements.documento.value,p_email:form.elements.email.value});
      ctx.aviso('Fornecedor cadastrado');await compras(ctx);
    });
    let sugestao=[];
    ac('sugerir-locais','click',async()=>{
      const form=f('f-compra');if(!form)return;
      const ing=form.elements.ingrediente.value;const qtd=Number(form.elements.quantidade.value);
      if(!ing||!(qtd>0)){ctx.aviso('Informe ingrediente e quantidade',true);return}
      try{
        const r=await ctx.rpc('api_12_sugerir_locais',{p_empresa:ctx.tenant,p_ingrediente:ing,p_quantidade:qtd});
        sugestao=r.sugestao||[];
        f('alocacoes').innerHTML=`<div class="erp12-form"><b>Distribuição sugerida — confirme ou altere</b>
          ${sugestao.map((s,i)=>`<label>${E(s.nome)} (${E(s.area)})<input data-alocacao="${E(s.local_id)}" type="number" min="0" step="0.001" value="${s.quantidade}"></label>`).join('')}
          ${locais.filter(l=>!sugestao.some(s=>s.local_id===l.id)).map(l=>`<label>${E(l.nome)}<input data-alocacao="${E(l.id)}" type="number" min="0" step="0.001" value="0"></label>`).join('')}
          <small class="muted">Quantidade sem espaço sugerido: ${num(r.nao_alocado)}. Ajuste as posições antes de confirmar.</small>
          </div>`;
      }catch(err){ctx.falha(err)}
    });
    onForm(ctx,'f-compra',async form=>{
      const aloc=[...document.querySelectorAll('[data-alocacao]')].map(el=>({local_id:el.dataset.alocacao,quantidade:Number(el.value)})).filter(x=>x.quantidade>0);
      const qtd=Number(form.elements.quantidade.value);const soma=aloc.reduce((s,x)=>s+x.quantidade,0);
      if(!aloc.length || Math.abs(soma-qtd)>0.000001)throw new Error('Confirme a distribuição completa entre os locais.');
      if(!confirm(`Registrar compra de ${num(qtd)} unidades e alocar fisicamente conforme informado?`))return;
      const resposta=await ctx.rpc('api_12_receber_lote',{p_empresa:ctx.tenant,p_ingrediente:form.elements.ingrediente.value,
      p_fornecedor:form.elements.fornecedor.value||null,p_validade:form.elements.validade.value,
      p_quantidade:qtd,p_custo_total:Number(form.elements.custo.value),p_lote_fabricante:form.elements.fabricante.value,p_distribuicao:aloc});
      ctx.aviso(resposta);await compras(ctx);
    });
  }
  async function movimentacoes(ctx){
    const [d,acessos,solicitacoes,produtosRes]=await Promise.all([
      dadosEstoque(ctx),
      ctx.rpc('api_13b_acessos',{p_empresa:ctx.tenant}),
      ctx.rpc('api_13b_listar',{p_empresa:ctx.tenant}),
      ctx.db.from('produtos').select('id,nome,excluido_em').eq('doceria_id',ctx.tenant)
    ]);
    const ing=d.ingredientes||[],todosLotes=d.lotes||[],lotes=todosLotes.filter(l=>Number(l.quantidade_atual)>0);
    const locais=d.locais||[],movs=d.movimentos||[];
    const produtos=produtosRes.error?[]:(produtosRes.data||[]).filter(x=>!x.excluido_em);
    const pos=d.posicoes||[],temLote=new Set(todosLotes.map(x=>x.ingrediente_id));
    const ingredientesLivres=ing.filter(i=>!temLote.has(i.id));
    const todosItens=[...ingredientesLivres.map(i=>({id:i.id,tipo:'ingrediente',nome:i.nome})),
      ...produtos.map(i=>({id:i.id,tipo:'produto',nome:i.nome}))];
    const formatData=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
    const pendientes=(solicitacoes||[]).filter(s=>s.status==='pendente');
    const historicoSolicitacoes=(solicitacoes||[]).filter(s=>s.status!=='pendente');
    const nomeItem=(s)=>{
      if(s.tipo==='descarte_lote'){
        const lt=todosLotes.find(l=>l.id===s.dados?.lote);
        const local=locais.find(l=>l.id===s.dados?.local);
        return `Lote ${E(lt?.codigo||'—')} · ${E(ing.find(i=>i.id===lt?.ingrediente_id)?.nome||'Ingrediente')} · ${num(s.dados?.quantidade)} · ${E(local?.nome||'—')}`;
      }
      return `${E(todosItens.find(i=>i.id===s.dados?.item)?.nome||'Item')} · variação ${num(s.dados?.variacao)}`;
    };
    const linhaSolicitacao=(s)=>{
      const autorizou=s.tipo==='descarte_lote'?Boolean(acessos.aprovar_descarte):Boolean(acessos.aprovar_ajuste);
      const podeDecidir=autorizou&&s.status==='pendente'&&s.solicitado_por_id!==ctx.perfil?.id;
      return `<article class="rh13b-solicitacao"><div class="rh13b-pedido-titulo"><b>${s.tipo==='descarte_lote'?'Descarte':'Ajuste de inventário'}</b>
      <span class="tag ${s.status==='pendente'?'pendente':s.status==='aprovada'?'aprovado':'rejeitado'}">${E(s.status)}</span></div>
      <div class="rh13b-sub">${nomeItem(s)}</div><p>${E(s.motivo)}</p>
      <small>Solicitado por <b>${E(s.solicitado_por||'Nome não informado')}</b> · ${formatData(s.solicitado_em)}</small>
      ${s.status!=='pendente'?`<small>Decisão: ${E(s.decidido_por||'—')} · ${formatData(s.decidido_em)}${s.justificativa_decisao?` · ${E(s.justificativa_decisao)}`:''}</small>`:''}
      ${podeDecidir?`<div class="rh13b-actions"><button type="button" class="small" data-aprovar-mov="${E(s.id)}">Aprovar</button>
        <button type="button" class="sec small" data-recusar-mov="${E(s.id)}">Recusar</button></div>`:''}</article>`;
    };
    const linhas=movs.map(m=>{
      const lt=todosLotes.find(l=>l.id===m.lote_id),local=locais.find(l=>l.id===m.local_id);
      return `<tr><td>${formatData(m.created_at)}</td><td>${E(lt?.codigo||'—')}</td><td>${E(m.acao)}</td><td>${num(m.quantidade)}</td><td>${E(local?.nome||'—')}</td></tr>`;
    }).join('');
    const formTransferencia=`<form id="f-transf" class="erp12-form">
      <label>Lote<select name="lote" required>${opt(lotes,l=>l.id,l=>`${l.codigo} · ${ing.find(i=>i.id===l.ingrediente_id)?.nome||''}`)}</select></label>
      <label>Origem<select name="origem" required>${opt(locais,l=>l.id,l=>l.nome)}</select></label>
      <label>Destino<select name="destino" required>${opt(locais,l=>l.id,l=>l.nome)}</select></label>
      <label>Quantidade<input name="qtd" type="number" step="0.001" min="0.001" required></label>
      <button type="submit">Confirmar transferência</button></form>`;
    const formDescarte=`<form id="f-descarte" class="erp12-form">
      <label>Lote<select name="lote" required>${opt(lotes,l=>l.id,l=>`${l.codigo} · ${ing.find(i=>i.id===l.ingrediente_id)?.nome||''}`)}</select></label>
      <label>Local<select name="local" required>${opt(locais,l=>l.id,l=>l.nome)}</select></label>
      <label>Quantidade<input name="qtd" type="number" step="0.001" min="0.001" required></label>
      <label>Justificativa<input name="motivo" minlength="5" maxlength="500" required placeholder="Ex.: embalagem avariada"></label>
      <button type="submit" class="${acessos.administrar?'danger':''}">${acessos.administrar?'Confirmar descarte':'Enviar para aprovação'}</button></form>`;
    const formAjuste=`<form id="rh13b-f-ajuste" class="erp12-form">
      <label>Item<select name="item" required>${todosItens.map(i=>`<option value="${E(i.tipo+'|'+i.id)}">${E(i.nome)} · ${i.tipo==='ingrediente'?'Ingrediente sem lote':'Produto pronto'}</option>`).join('')}</select></label>
      <label>Variação (+ entrada / − saída)<input name="variacao" type="number" step="0.001" required placeholder="Ex.: -3"></label>
      <label>Justificativa<input name="motivo" minlength="5" maxlength="500" required></label>
      <button type="submit" ${todosItens.length?'':'disabled'}>Solicitar ajuste</button>
      <p class="muted">Ingredientes com lotes devem ser corrigidos pelo controle de lotes. A solicitação não altera o estoque antes da aprovação.</p></form>`;
    se(ctx,linkVoltar+titulo('Movimentações','Solicitações, aprovações e histórico de estoque')+
      `<div class="rh13b-overview"><div><b>${pendientes.length}</b><span>Solicitações pendentes</span></div><div><b>${movs.length}</b><span>Movimentações recentes</span></div></div>`+
      `<details class="card rh13b-details" id="rh13b-fila"><summary>Solicitações para análise (${pendientes.length})</summary>
      <p class="muted">Aprovações disponíveis somente para cargos autorizados. Ninguém aprova a própria solicitação.</p>
      <div class="rh13b-solicitacoes">${pendientes.map(linhaSolicitacao).join('')||'<p class="muted">Nenhuma solicitação pendente.</p>'}</div></details>`+
      `<div class="rh13b-duas-colunas">
        <details class="card rh13b-details"><summary>Transferir entre locais</summary>${formTransferencia}</details>
        <details class="card rh13b-details"><summary>${acessos.administrar?'Registrar descarte':'Solicitar descarte'}</summary>${formDescarte}</details>
        <details class="card rh13b-details"><summary>Solicitar ajuste de inventário</summary>${formAjuste}</details>
      </div>`+
      `<details class="card rh13b-details"><summary>Histórico de solicitações (${historicoSolicitacoes.length})</summary>
      <div class="rh13b-solicitacoes">${historicoSolicitacoes.map(linhaSolicitacao).join('')||'<p class="muted">Nenhum registro.</p>'}</div></details>`+
      `<details class="card rh13b-details"><summary>Histórico de movimentações (${movs.length})</summary>
      ${tabela(['Quando','Lote','Tipo','Quantidade','Local'],linhas)}</details>`);
    onForm(ctx,'f-transf',async form=>{
      if(!confirm('Confirmar transferência física dos materiais?'))return;
      ctx.aviso(await ctx.rpc('api_12_transferir_lote',{p_empresa:ctx.tenant,
        p_lote:form.elements.lote.value,p_origem:form.elements.origem.value,
        p_destino:form.elements.destino.value,p_quantidade:Number(form.elements.qtd.value)}));
      await movimentacoes(ctx);
    });
    onForm(ctx,'f-descarte',async form=>{
      const dados={lote:form.elements.lote.value,local:form.elements.local.value,
        quantidade:Number(form.elements.qtd.value)};
      const motivo=form.elements.motivo.value.trim();
      if(!confirm(acessos.administrar?'Registrar a baixa imediata deste lote?':'Enviar solicitação de descarte para aprovação?'))return;
      const r=acessos.administrar?
        await ctx.rpc('api_12_descartar_lote',{p_empresa:ctx.tenant,p_lote:dados.lote,p_local:dados.local,
          p_quantidade:dados.quantidade,p_motivo:motivo}):
        await ctx.rpc('api_13b_solicitar',{p_empresa:ctx.tenant,p_tipo:'descarte_lote',p_dados:dados,p_motivo:motivo});
      ctx.aviso(r);await movimentacoes(ctx);
    });
    onForm(ctx,'rh13b-f-ajuste',async form=>{
      const [tipo_item,item]=form.elements.item.value.split('|');
      const variacao=Number(form.elements.variacao.value);
      if(!Number.isFinite(variacao)||!variacao)throw new Error('Informe uma variação diferente de zero.');
      if(!confirm('Enviar solicitação de ajuste para análise?'))return;
      ctx.aviso(await ctx.rpc('api_13b_solicitar',{p_empresa:ctx.tenant,p_tipo:'ajuste_estoque',
        p_dados:{tipo_item,item,variacao},p_motivo:form.elements.motivo.value.trim()}));
      await movimentacoes(ctx);
    });
    document.querySelectorAll('[data-aprovar-mov],[data-recusar-mov]').forEach(b=>b.addEventListener('click',async()=>{
      const aprovar=b.hasAttribute('data-aprovar-mov');
      const id=b.getAttribute(aprovar?'data-aprovar-mov':'data-recusar-mov');
      const explicacao=aprovar?'':prompt('Informe o motivo da recusa (mínimo 5 caracteres):');
      if(!aprovar&&(explicacao===null||explicacao.trim().length<5))return;
      if(!confirm(aprovar?'Aprovar e executar o ajuste no estoque?':'Confirmar recusa da solicitação?'))return;
      try{ctx.aviso(await ctx.rpc('api_13b_decidir',{p_empresa:ctx.tenant,p_solicitacao:id,
        p_aprovar:aprovar,p_justificativa:explicacao||''}));await movimentacoes(ctx)}catch(err){ctx.falha(err)}
    }));
  }
  async function custos(ctx){
    if(!ctx.pode('adm','financeiro')){
      se(ctx,linkVoltar+ctx.cartao('Acesso restrito','Custos são visíveis apenas para ADM, DEV e Financeiro.'));return;
    }
    const [d,dadosCusto]=await Promise.all([dadosEstoque(ctx),ctx.rpc('api_12_custos',{p_empresa:ctx.tenant})]);
    const prods=dadosCusto.produtos||[],recs=dadosCusto.receitas||[],extrasCadastrados=dadosCusto.extras||[];
    const ing=d.ingredientes||[],lotes=d.lotes||[];
    const linhas=prods.filter(p=>p.ativo!==false).map(p=>{
      const extras=extrasCadastrados.filter(e=>e.produto_id===p.id).reduce((s,e)=>s+Number(e.valor||0),0);
      const receita=recs.filter(r=>r.produto_id===p.id);
      const faltas=[];
      const custo=receita.reduce((t,r)=>{
        const i=ing.find(x=>x.id===r.ingrediente_id);
        const ultimo=lotes.filter(l=>l.ingrediente_id===r.ingrediente_id&&Number(l.custo_total)>0)
          .sort((a,b)=>String(b.recebido_em).localeCompare(String(a.recebido_em)))[0];
        if(!ultimo){faltas.push(`Preço de ${i?.nome||'ingrediente'} não cadastrado`);return t}
        return t+Number(r.quantidade||0)*Number(ultimo.custo_total)/Number(ultimo.quantidade_inicial||1);
      },0);
      const custoTotal=custo+extras;
      const preco=Number(p.preco||0),margem=preco>0?(preco-custoTotal)/preco*100:0;
      return `<tr><td><b>${E(p.nome)}</b></td><td>${C(preco)}</td><td>${faltas.length?'<b class="erp12-amarelo">Incompleto</b>':C(custoTotal)}</td>
       <td>${faltas.length?'—':margem.toFixed(1)+'%'}</td><td>${faltas.length?E(faltas.join(' · ')):'Estimativa baseada em ingredientes e custos adicionais cadastrados; impostos e despesas gerais podem faltar'}</td></tr>`;
    }).join('');
    se(ctx,linkVoltar+titulo('Custos e análises','Simule preços sem alterar os produtos reais')+
      `<div class="card"><h2>Simulador de preço</h2><p class="muted">O cálculo não altera preços nem envia dados à loja.</p>
      <div class="erp12-dois"><label>Custo unitário estimado (R$)<input id="custo-sim" type="number" min="0" step="0.01" value="25.50"></label>
      <label>Preço de venda testado (R$)<input id="preco-sim" type="number" min="0.01" step="0.01" value="50"></label></div>
      <div id="resultado-sim" class="erp12-sim"></div></div>
      ${ctx.pode('adm')?`<section class="card"><h2>Adicionar custo por produto</h2><form id="f-custo-extra" class="erp12-form">
       <label>Produto<select name="produto" required>${opt(prods,p=>p.id,p=>p.nome)}</select></label>
       <label>Descrição (embalagem, mão de obra, gás...)<input name="descricao" required minlength="3"></label>
       <label>Valor por unidade (R$)<input name="valor" type="number" min="0" step="0.01" required></label>
       <button type="submit">Registrar custo adicional</button></form></section>`:''}
      <section class="card"><h2>Margens por produto</h2><details><summary class="erp12-summary">Ver comparação de custos e vendas (${prods.length})</summary>${tabela(['Produto','Preço','Custo estimado','Margem parcial','Observação'],linhas)}</details></section>
      <p class="muted">Estimativa com o último custo de compra. Para lucro líquido real são necessários ainda mão de obra, impostos, taxas e despesas indiretas. Sem esses dados, não chamaremos o resultado de lucro líquido.</p>`);
    const calc=()=>{
      const custo=Number(f('custo-sim').value||0),preco=Number(f('preco-sim').value||0);
      f('resultado-sim').innerHTML=preco>0?`<b>Margem bruta simulada: ${((preco-custo)/preco*100).toFixed(1)}%</b><span>Diferença por unidade: ${C(preco-custo)}</span>`:'Informe preço maior que zero';
    };
    onForm(ctx,'f-custo-extra',async form=>{await ctx.rpc('api_12_custo_extra_salvar',{p_empresa:ctx.tenant,p_produto:form.elements.produto.value,p_descricao:form.elements.descricao.value,p_valor:Number(form.elements.valor.value)});ctx.aviso('Custo registrado');await custos(ctx)});
    ac('custo-sim','input',calc);ac('preco-sim','input',calc);calc();
  }
  async function empresas(ctx){
    await ctx.carregarDocerias();
    const lista=await ctx.rpc('api_12_empresas_lista');
    const html=`<section class="card erp12-admemp"><h2>Contratos e acesso das empresas</h2>
      <p class="muted">Suspender por inadimplência bloqueia o acesso operacional de todos da empresa. Remover encerra a utilização sem apagar o histórico; restauração exige ação do DEV.</p>
      ${tabela(['Empresa','Situação','Modelo de loja','Ações'],(lista||[]).map(d=>`<tr><td><b>${E(d.nome)}</b></td>
       <td><span class="erp12-situacao ${E(d.situacao)}">${E(d.situacao)}</span></td><td>${E(d.tema)}</td>
       <td><div class="acoes">
       ${d.situacao==='ativa'?`<button type="button" class="small sec" data-empresa-status="suspensa" data-empresa-id="${E(d.id)}">Bloquear empresa</button>`:`<button type="button" class="small sec" data-empresa-status="ativa" data-empresa-id="${E(d.id)}">Reativar empresa</button>`}
       ${d.situacao!=='encerrada'?`<button type="button" class="small danger" data-empresa-status="encerrada" data-empresa-id="${E(d.id)}">Remover empresa</button>`:`<button type="button" class="small danger" data-empresa-excluir="${E(d.id)}">Excluir definitivamente</button>`}
       </div></td></tr>`).join(''))}</section>`;
    f('conteudo').insertAdjacentHTML('afterbegin',titulo('Empresas','Gerenciamento exclusivo do DEV'));
    f('conteudo').insertAdjacentHTML('beforeend',html);
    document.querySelectorAll('[data-empresa-status]').forEach(b=>b.addEventListener('click',async()=>{
      const nome=lista.find(x=>x.id===b.dataset.empresaId)?.nome||'Empresa';
      const st=b.dataset.empresaStatus;
      const msg=st==='suspensa'?`Suspender ${nome}? Os funcionários perderão acesso aos dados até a reativação.`:
        st==='encerrada'?`Remover ${nome} da operação? O histórico será preservado e todos os acessos bloqueados.`:`Reativar ${nome}?`;
      if(!confirm(msg))return;
      try{await ctx.rpc('api_12_alterar_empresa',{p_empresa:b.dataset.empresaId,p_situacao:st});ctx.aviso('Empresa atualizada');await empresas(ctx)}catch(err){ctx.falha(err)}
    }));
    document.querySelectorAll('[data-empresa-excluir]').forEach(b=>b.addEventListener('click',async()=>{
      const nome=lista.find(x=>x.id===b.dataset.empresaExcluir)?.nome||'';
      const frase=prompt('Exclusão definitiva: o backend precisa desvincular todas as contas com segurança. Para confirmar, digite EXCLUIR '+nome);
      if(frase!=='EXCLUIR '+nome)return;
      try{ctx.aviso(await ctx.rpc('api_13e_excluir_empresa_definitiva',{p_empresa:b.dataset.empresaExcluir,p_confirmacao:frase}));await empresas(ctx)}catch(err){ctx.falha(err)}
    }));
  }
  async function loja(ctx){
    const conf=await ctx.rpc('api_config_doceria',{p_doceria:ctx.tenant});
    const slug=conf?.slug||'';
    se(ctx,titulo('Loja virtual','Selecione o modelo mais adequado ao segmento da empresa')+
      `<div class="erp15-modelos">
<section class="erp15-modelo"><span>🍽️</span><div><h2>Comércio de alimentos</h2><p>Cardápio, fotos e pedidos.</p></div><button type="button" data-modelo="doceria">Selecionar</button></section>
<section class="erp15-modelo"><span>🛍️</span><div><h2>Comércio geral</h2><p>Produtos, categorias e carrinho.</p></div><button type="button" data-modelo="comercio">Selecionar</button></section>
<section class="erp15-modelo"><span>🏢</span><div><h2>Empresarial</h2><p>Catálogo técnico e apresentação B2B.</p></div><button type="button" data-modelo="empresarial">Selecionar</button></section>
</div>
      <section class="card"><h2>Visualização da sua empresa</h2>
      ${slug?`<p><a target="_blank" rel="noopener" href="loja.html?loja=${encodeURIComponent(slug)}">Abrir modelo do seu site ↗</a></p>
      <p><a target="_blank" rel="noopener" href="loja-geral.html?loja=${encodeURIComponent(slug)}">Abrir modelo de comércio geral ↗</a></p>`:'<p class="muted">O endereço público será gerado automaticamente após o SQL 13E.</p>'}
      ${slug?'<p><a target="_blank" rel="noopener" href="loja-empresarial.html?loja='+encodeURIComponent(slug)+'">Prévia empresarial ↗</a></p>':''}
      <small class="muted">A escolha fica salva no Supabase. O modelo empresarial requer que a RPC aceite o valor empresarial.</small></section>
      <section class="card erp15-marketplace"><h2>Marketplaces · Mercado Livre e Shopee</h2>
      <p>Área de preparação para integração por empresa. A conexão e a publicação automática dependem de autorização OAuth e APIs oficiais; ainda não estão habilitadas.</p>
      <div class="erp15-marketplace-linhas"><div><strong>Mercado Livre</strong><span>Não conectado</span><a target="_blank" rel="noopener noreferrer" href="https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos/gestao-de-identidades-e-acessos-oauth-e-tokens">Requisitos da API ↗</a></div>
      <div><strong>Shopee</strong><span>Não conectado</span><a target="_blank" rel="noopener noreferrer" href="https://open.shopee.com/">Portal de integração ↗</a></div></div>
      <p class="muted">Não informe senhas ou tokens aqui. A vinculação será realizada individualmente por cada empresa, quando o fluxo seguro estiver ativo.</p></section>`);
    document.querySelectorAll('[data-modelo]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Definir este modelo de loja para a empresa?'))return;
      try{ctx.aviso(await ctx.rpc('api_12_definir_modelo_loja',{p_empresa:ctx.tenant,p_modelo:b.dataset.modelo}))}catch(err){ctx.falha(new Error(b.dataset.modelo==='empresarial'?'É necessário habilitar o valor empresarial na função SQL de modelos. '+err.message:err.message))}
    }));
  }
  async function financeiro(ctx){
    const d=await ctx.rpc('api_12_financeiro_listar',{p_empresa:ctx.tenant});
    const itens=d.lancamentos||[],reemb=d.reembolsos||[];
    const pagos=itens.filter(x=>x.status==='pago');
    const entradas=pagos.filter(x=>x.tipo==='entrada').reduce((s,x)=>s+Number(x.valor||0),0);
    const saidas=pagos.filter(x=>x.tipo==='saida').reduce((s,x)=>s+Number(x.valor||0),0);
    const pend=itens.filter(x=>x.status==='pendente').reduce((s,x)=>s+(x.tipo==='saida'?-1:1)*Number(x.valor||0),0);
    const admin=ctx.pode('adm');
    const cards=[['Recebimentos lançados',C(entradas)],['Despesas pagas',C(saidas)],['Saldo registrado',C(entradas-saidas)],['Previsão líquida',C(pend)]];
    se(ctx,titulo('Financeiro','Contas a pagar, contas a receber e solicitações de reembolso')+
      `<div class="erp12-metricas">${cards.map(([n,v])=>`<div class="erp12-metrica"><small>${E(n)}</small><b>${E(v)}</b></div>`).join('')}</div>
      <section class="card"><h2>Nova conta / despesa</h2><details><summary class="erp12-summary">Cadastrar lançamento</summary>
      <form id="f-fin" class="erp12-form erp12-form-box">
      <label>Tipo<select name="tipo"><option value="saida">Conta a pagar / Despesa</option><option value="entrada">Conta a receber</option></select></label>
      <label>Categoria<input name="categoria" placeholder="Aluguel, energia, fornecedor..." minlength="2" required></label>
      <label>Descrição<input name="descricao" minlength="3" required></label>
      <label>Valor (R$)<input name="valor" type="number" min="0.01" step="0.01" required></label>
      <label>Vencimento<input name="vencimento" type="date" required></label><button type="submit">Salvar lançamento</button></form></details></section>
      <section class="card"><h2>Contas</h2><details><summary class="erp12-summary">Ver contas a pagar e a receber (${itens.length})</summary>
      ${tabela(['Descrição','Tipo','Valor','Vencimento','Situação','Ação'],itens.map(x=>`<tr><td>${E(x.descricao)}<div class="muted">${E(x.categoria)}</div></td><td>${E(x.tipo)}</td>
      <td>${C(x.valor)}</td><td>${F(x.vencimento)}</td><td>${E(x.status)}</td><td>${x.status==='pendente'?`<button class="small sec" data-fin-baixar="${E(x.id)}">Marcar pago</button>`:'—'}</td></tr>`).join(''))}</details></section>
      <section class="card"><h2>Reembolsos</h2><details><summary class="erp12-summary">Solicitar reembolso (sem transferência automática)</summary>
      <form id="f-reemb" class="erp12-form erp12-form-box"><label>Valor (R$)<input name="valor" type="number" min="0.01" step="0.01" required></label>
      <label>Justificativa<input name="motivo" minlength="8" required></label><button type="submit">Solicitar aprovação</button></form></details>
      <details><summary class="erp12-summary">Consultar reembolsos (${reemb.length})</summary>
      ${tabela(['Valor','Motivo','Situação','Ação'],reemb.map(x=>`<tr><td>${C(x.valor)}</td><td>${E(x.motivo)}</td><td>${E(x.status)}</td>
      <td>${x.status==='solicitado'&&admin?`<button class="small" data-reembolso="${E(x.id)}" data-aceite="true">Aprovar</button> <button class="small danger" data-reembolso="${E(x.id)}" data-aceite="false">Recusar</button>`:'—'}</td></tr>`).join(''))}</details></section>
      <p class="muted">Este financeiro registra contas e decisões internas. Não concilia bancos, não efetua Pix e não executa estornos sozinho. O saldo acima soma somente lançamentos financeiros inseridos neste módulo, não automaticamente todas as vendas dos pedidos.</p>`);
    onForm(ctx,'f-fin',async form=>{
      await ctx.rpc('api_12_financeiro_criar',{p_empresa:ctx.tenant,p_tipo:form.elements.tipo.value,
       p_categoria:form.elements.categoria.value,p_descricao:form.elements.descricao.value,
       p_valor:Number(form.elements.valor.value),p_vencimento:form.elements.vencimento.value,p_fornecedor:null});
      ctx.aviso('Lançamento registrado');await financeiro(ctx);
    });
    onForm(ctx,'f-reemb',async form=>{
      await ctx.rpc('api_12_reembolso_solicitar',{p_empresa:ctx.tenant,p_valor:Number(form.elements.valor.value),
      p_motivo:form.elements.motivo.value,p_pedido:null});ctx.aviso('Solicitação enviada');await financeiro(ctx);
    });
    document.querySelectorAll('[data-fin-baixar]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Confirma que o valor foi efetivamente pago/recebido fora do sistema?'))return;
      try{ctx.aviso(await ctx.rpc('api_12_financeiro_baixar',{p_empresa:ctx.tenant,p_lancamento:b.dataset.finBaixar,p_pago:true}));await financeiro(ctx)}catch(err){ctx.falha(err)}
    }));
    document.querySelectorAll('[data-reembolso]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Registrar decisão interna? Isso não envia dinheiro ao cliente.'))return;
      try{ctx.aviso(await ctx.rpc('api_12_reembolso_decidir',{p_empresa:ctx.tenant,p_reembolso:b.dataset.reembolso,p_aprovar:b.dataset.aceite==='true'}));await financeiro(ctx)}catch(err){ctx.falha(err)}
    }));
  }
  async function painel(ctx){
    const [d,alert]=await Promise.all([ctx.rpc('api_12_painel',{p_empresa:ctx.tenant}),alertasHTML(ctx,true)]);
    const admin=ctx.pode('adm','financeiro'),pedidos=d.pedidos||[],falta=d.faltantes||[];
    const bruto=Number(d.bruto||0),custo=Number(d.custo_estimado||0),faltando=falta.length>0;
    const cards=admin?[['Vendas brutas hoje',C(bruto)],['Margem de contribuição estimada',faltando?'Incompleto':C(bruto-custo)],['A fazer hoje',d.a_fazer||0],['Concluídos hoje',d.concluidos||0]]:
      [['Pedidos a fazer',d.a_fazer||0],['Concluídos hoje',d.concluidos||0]];
    se(ctx,titulo('Painel de operações',`Empresa: ${ctx.docerias.find(x=>x.id===ctx.tenant)?.nome||'—'} · Somente hoje`)+
      `<div class="erp12-metricas">${cards.map(([n,v])=>`<div class="erp12-metrica"><small>${E(n)}</small><b>${E(v)}</b></div>`).join('')}</div>
      ${admin&&faltando?`<section class="card erp12-pendencia"><h2>Por que o resultado está incompleto?</h2>${falta.map(x=>`<p>⚠ ${E(x)}</p>`).join('')}<small class="muted">Também podem faltar impostos, mão de obra ou taxas. Os valores mostrados nunca são tratados como lucro líquido confirmado.</small></section>`:''}
      <div class="erp12-painel-colunas"><div>
       ${admin?`<section class="card"><div class="erp12-linha-cab"><h2>Vendas de hoje</h2><button class="sec small" id="abrir-grafico">Ver gráfico</button></div>
       <div id="grafico-dia" hidden></div><p class="muted">O histórico completo fica em Relatórios.</p></section>`:''}
       <section class="card"><h2>Pedidos do dia</h2><div class="erp12-abas"><button class="sec small" id="ver-fazer">A fazer (${d.a_fazer||0})</button><button class="sec small" id="ver-concluidos">Concluídos (${d.concluidos||0})</button></div>
        <div id="tabela-pedidos-hoje"></div></section>
      </div><div><section class="card"><h2>Avisos importantes ${alert.quantidade?`<span class="erp12-contador">${alert.quantidade}</span>`:''}</h2>${alert.html}<div id="rh13b-avisos-gerencia"></div></section>
      <section class="card"><h2>Cortesias</h2><div id="cortesias-hoje"><p class="muted">Consultando avisos pendentes...</p></div></section></div></div>`);
    // Gerentes e ADM: aviso compacto; a lista completa permanece fechada em Movimentacoes.
    try{
      const cap=await ctx.rpc('api_13b_acessos',{p_empresa:ctx.tenant});
      if(cap.aprovar_ajuste||cap.aprovar_descarte){
        const pend=(await ctx.rpc('api_13b_listar',{p_empresa:ctx.tenant})).filter(x=>
          x.status==='pendente'&&x.solicitado_por_id!==ctx.perfil?.id &&
          (x.tipo==='descarte_lote'?cap.aprovar_descarte:cap.aprovar_ajuste));
        if(pend.length){
          const area=f('rh13b-avisos-gerencia');if(area)area.innerHTML=`<div class="erp12-alerta warn"><b>${pend.length} solicitacao(oes) da Logistica aguardando aprovacao</b>
            <p class="muted">Ajustes e descartes exigem a sua conferencia.</p>
            <a href="estoque-movimentacoes.html">Conferir solicitacoes →</a></div>`;
        }
      }
    }catch(e){console.debug('Avisos de aprovacoes indisponiveis',e)}
    const montar=feito=>{
      const ls=pedidos.filter(x=>feito?x.status==='entregue':x.status!=='entregue');
      f('tabela-pedidos-hoje').innerHTML=ls.length?tabela(['Pedido','Cliente','Horário','Situação'],ls.map(x=>
        `<tr><td><b>#${E(x.numero)}</b></td><td>${E(x.cliente)}</td><td>${E(String(x.hora||'').slice(0,5))}</td><td>${E(x.status)}</td></tr>`).join('')):'<p class="muted">Nenhum pedido nessa categoria hoje.</p>';
    };
    ac('ver-fazer','click',()=>montar(false));ac('ver-concluidos','click',()=>montar(true));montar(false);
    habilitarLeitura(ctx,()=>painel(ctx));
    if(admin){
      try{
        const [avisos,clientes]=await Promise.all([ctx.selecionar('notificacoes_cortesia'),ctx.selecionar('clientes','id,nome')]);
        const pend=avisos.filter(x=>!x.lida_em),nomes=new Map(clientes.map(x=>[x.id,x.nome]));
        f('cortesias-hoje').innerHTML=pend.length?`<details><summary class="erp12-summary">${pend.length} cortesia(s) pendente(s)</summary>
         ${pend.map(x=>`<div class="erp12-alerta-linha"><span>${E(nomes.get(x.cliente_id)||'Cliente')} — ${Number(x.quantidade_bolos)} cortesia(s)</span><button class="small sec" data-cortesia12="${E(x.id)}">Confirmar leitura</button></div>`).join('')}</details>`:'<p class="muted">Nenhuma cortesia pendente.</p>';
        document.querySelectorAll('[data-cortesia12]').forEach(b=>b.addEventListener('click',async()=>{
          try{await ctx.rpc('api_marcar_cortesia_lida',{p_notificacao:b.dataset.cortesia12});ctx.aviso('Cortesia reconhecida');await painel(ctx)}catch(err){ctx.falha(err)}
        }));
      }catch(_){f('cortesias-hoje').innerHTML='<p class="muted">Nenhuma informação disponível para esta conta.</p>'}
    }else{f('cortesias-hoje').innerHTML='<p class="muted">Avisos de cortesia disponíveis para a gestão autorizada.</p>'}
    if(admin){
      ac('abrir-grafico','click',()=>{
        const el=f('grafico-dia');if(!el)return;
        el.hidden=!el.hidden;f('abrir-grafico').textContent=el.hidden?'Ver gráfico':'Ocultar gráfico';
        if(!el.hidden&&!el.dataset.renderizado){
          const vendas=d.vendas_horas||[],horas=[...new Set(vendas.map(x=>x.hora))].sort();
          const total=Math.max(1,...horas.map(h=>vendas.filter(x=>x.hora===h).reduce((s,x)=>s+Number(x.valor),0)));
          const prod=[...new Set(vendas.map(x=>x.produto))];const cores=['#eba44a','#66c8b5','#e284a9','#8494e1','#c18ac9','#e5816d','#8fb85e'];
          el.innerHTML=`<div class="erp12-grafico"><div class="erp12-grafico-bars">${horas.map(h=>{
            const vs=vendas.filter(x=>x.hora===h),soma=vs.reduce((s,x)=>s+Number(x.valor),0);
            return `<div class="erp12-grafico-col"><div class="erp12-grafico-pilha" style="height:${(soma/total*190).toFixed(1)}px">${vs.map(x=>
              `<span class="erp12-grafico-segmento" style="background:${cores[prod.indexOf(x.produto)%cores.length]};height:${soma?(x.valor/soma*100).toFixed(2):0}%" title="${E(x.produto)}: ${C(x.valor)} · ${x.quantidade} un."></span>`).join('')}</div><b>${E(h)}</b></div>`;
          }).join('')}</div><div class="erp12-grafico-legenda">${prod.map((p,i)=>`<span><i style="background:${cores[i%cores.length]}"></i>${E(p)}</span>`).join('')}</div></div>`;
          if(!horas.length)el.innerHTML='<p class="muted">Ainda não há pedidos entregues hoje.</p>';
          el.dataset.renderizado='1';
        }
      });
    }
  }
  return {painel,estoque,estoqueInterno,financeiro,loja,empresas};
})();