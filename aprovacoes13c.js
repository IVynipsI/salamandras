/* Salamandras 13C — solicitações e aprovações de todos os setores.
 * Segurança e gravações são exclusivamente realizadas pelas RPCs do Supabase.
 * Este arquivo não autoriza funções por texto no navegador. */
'use strict';
window.Salamandras13C=(()=>{
  const $=id=>document.getElementById(id);
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lista=v=>Array.isArray(v)?v:[];
  const data=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
  const dinheiro=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const SETOR={logistica:'Logística',compras:'Compras',financeiro:'Financeiro',rh:'Gestão de Pessoas',producao:'Produção',vendas:'Vendas'};
  const TIPO={
    'logistica.descarte_lote':'Descarte de lote','logistica.ajuste_estoque':'Ajuste de estoque',
    'compras.compra':'Solicitação de compra','compras.fornecedor':'Novo fornecedor',
    'financeiro.despesa':'Nova despesa','financeiro.reembolso':'Reembolso',
    'rh.hora_extra':'Horas extras','rh.bonus':'Bonificação',
    'producao.perda':'Perda de insumo','producao.alteracao':'Alteração em ordem',
    'vendas.cancelamento':'Cancelamento de pedido','vendas.desconto':'Proposta de desconto'
  };
  const CATEGORIAS=['Desistencia do cliente','Falta de estoque','Problema na producao','Prazo ou entrega','Pagamento nao realizado','Pedido duplicado','Outro'];
  const op=(v,txt)=>`<option value="${e(v)}">${e(txt)}</option>`;
  const campos={
    'compras.compra':[
      {n:'fornecedor',l:'Fornecedor (opcional)',t:'select',src:'fornecedores',opcional:true},
      {n:'descricao',l:'O que precisa comprar?',t:'text',max:500,wide:true},
      {n:'valor',l:'Valor estimado (R$)',t:'number',step:'0.01',min:'0.01'}],
    'compras.fornecedor':[
      {n:'nome',l:'Nome do fornecedor',t:'text',max:150,wide:true},
      {n:'telefone',l:'WhatsApp / telefone',t:'tel',max:60,opcional:true,wide:true}],
    'financeiro.despesa':[
      {n:'categoria',l:'Categoria da despesa',t:'text',max:100},
      {n:'valor',l:'Valor (R$)',t:'number',step:'0.01',min:'0.01'},
      {n:'descricao',l:'Descrição',t:'text',max:300,wide:true},
      {n:'vencimento',l:'Vencimento',t:'date'}],
    'financeiro.reembolso':[
      {n:'pedido',l:'Pedido (opcional)',t:'select',src:'pedidos',opcional:true},
      {n:'valor',l:'Valor proposto (R$)',t:'number',step:'0.01',min:'0.01'}],
    'rh.hora_extra':[
      {n:'usuario',l:'Funcionário',t:'select',src:'funcionarios'},
      {n:'dia',l:'Dia trabalhado',t:'date'},
      {n:'horas',l:'Horas extras',t:'number',step:'0.25',min:'0.25',max:'24'},
      {n:'descricao',l:'Descrição da atividade',t:'text',max:300,wide:true,opcional:true}],
    'rh.bonus':[
      {n:'usuario',l:'Funcionário',t:'select',src:'funcionarios'},
      {n:'competencia',l:'Competência da folha',t:'month'},
      {n:'valor',l:'Bonificação (R$)',t:'number',step:'0.01',min:'0.01'}],
    'producao.perda':[
      {n:'ingrediente',l:'Insumo sem controle por lote',t:'select',src:'insumos'},
      {n:'quantidade',l:'Quantidade perdida (na unidade do estoque)',t:'number',step:'0.001',min:'0.001'}],
    'producao.alteracao':[
      {n:'ordem',l:'Ordem de produção',t:'select',src:'ordens'}],
    'vendas.cancelamento':[
      {n:'pedido',l:'Pedido',t:'select',src:'pedidos'},
      {n:'categoria',l:'Categoria do cancelamento',t:'select',opts:CATEGORIAS}],
    'vendas.desconto':[
      {n:'pedido',l:'Pedido',t:'select',src:'pedidos'},
      {n:'percentual',l:'Desconto proposto (%)',t:'number',step:'0.01',min:'0.01',max:'100'}]
  };
  const efeito={
    'compras.compra':'Autorização interna. Não compra nem paga automaticamente.',
    'compras.fornecedor':'Cadastra o fornecedor quando aprovado.',
    'financeiro.despesa':'Cria lançamento pendente, sem pagar.',
    'financeiro.reembolso':'Aprova internamente; não transfere dinheiro.',
    'rh.hora_extra':'Registra horas aprovadas para a folha.',
    'rh.bonus':'Entra no próximo recálculo da folha da competência.',
    'producao.perda':'Desconta o insumo sem lote depois da aprovação.',
    'producao.alteracao':'Somente autoriza; a ordem deve ser modificada depois.',
    'vendas.cancelamento':'Cancela o pedido e libera a reserva de produtos.',
    'vendas.desconto':'Somente autoriza; o preço não muda automaticamente.'
  };
  function campo(f,ctx){
    let input='';const a=f.opcional?'':'required';const titulo=e(f.l);
    if(f.t==='select'){
      const valores=f.opts?f.opts.map(x=>({id:x,nome:x})):lista(ctx[f.src]);
      const cab=f.opcional?op('','Nenhum / não informado'):op('','Selecione uma opção');
      input=`<select name="${e(f.n)}" ${a}>${cab}${valores.map(x=>op(x.id,x.nome)).join('')}</select>`;
      if(!valores.length&&!f.opcional)input+='<small>Nenhum registro disponível para selecionar.</small>';
    } else{
      input=`<input type="${e(f.t)}" name="${e(f.n)}" ${a} ${f.max?`maxlength="${f.max}"`:''}
      ${f.step?`step="${f.step}"`:''} ${f.min?`min="${f.min}"`:''} ${f.max&&f.t==='number'?`max="${f.max}"`:''}
      autocomplete="off">`;
    }
    return `<label class="${f.wide?'erp13c-largura':''}"><span>${titulo}</span>${input}</label>`;
  }
  function detalhar(obj,ctx){
    const traduzir={fornecedor:'Fornecedor',descricao:'Descrição',valor:'Valor',vencimento:'Vencimento',
      nome:'Nome',telefone:'Contato',pedido:'Pedido',usuario:'Funcionário',dia:'Dia',horas:'Horas',
      competencia:'Competência',ingrediente:'Insumo',quantidade:'Quantidade',ordem:'Ordem',
      categoria:'Categoria',percentual:'Desconto (%)',lote:'Lote',local:'Local',tipo_item:'Tipo de item',variacao:'Variação',item:'Item'};
    return Object.entries(obj||{}).filter(([k,v])=>v!==''&&v!==null).slice(0,12).map(([k,v])=>{
      if(!Object.hasOwn(traduzir,k))return '';
      let txt=v;
      if(['usuario','pedido','fornecedor','ingrediente','ordem'].includes(k)){
        const origem={usuario:'funcionarios',pedido:'pedidos',fornecedor:'fornecedores',ingrediente:'insumos',ordem:'ordens'}[k];
        txt=lista(ctx[origem]).find(x=>x.id===v)?.nome||String(v).slice(0,8);
      }
      if(k==='valor')txt=dinheiro(v);
      if(k==='competencia')txt=String(v).slice(0,7);
      return `<span><b>${e(traduzir[k])}:</b> ${e(txt)}</span>`;
    }).join('');
  }
  function registro(s,contexto){
    const pend=s.status==='pendente',autorizar=pend&&s.pode_aprovar,
      status={pendente:'Aguardando',aprovada:'Aprovada',recusada:'Recusada'}[s.status]||s.status;
    return `<article class="erp13c-registro">
      <div class="erp13c-topo"><div class="erp13c-titulo"><strong>${e(TIPO[s.tipo]||s.tipo)}</strong>
      <span class="erp13c-etiqueta">${e(SETOR[s.setor]||s.setor)}</span></div>
      <span class="tag ${pend?'pendente':s.status==='aprovada'?'aprovado':'rejeitado'}">${e(status)}</span></div>
      <div class="erp13c-sub">Solicitado por <b>${e(s.solicitado_por||'Nome não informado')}</b> · ${e(data(s.solicitado_em))}</div>
      <p class="erp13c-descricao">${e(s.motivo)}</p>
      <div class="erp13c-dados">${detalhar(s.dados,contexto)}</div>
      ${s.decidido_em?`<div class="erp13c-sub">Decisão: ${e(s.decidido_por||'—')} · ${e(data(s.decidido_em))}</div>`:''}
      ${s.justificativa_decisao?`<p class="erp13c-sub">Justificativa: ${e(s.justificativa_decisao)}</p>`:''}
      ${s.efeito?`<div class="erp13c-nota"><b>Resultado:</b> ${e(s.efeito)}</div>`:''}
      ${autorizar?`<div class="erp13c-acoes">
        <button class="small" data-13c-decisao="sim" data-id="${e(s.id)}" data-origem="${e(s.origem)}">Aprovar</button>
        <button class="sec small" data-13c-decisao="nao" data-id="${e(s.id)}" data-origem="${e(s.origem)}">Recusar</button>
      </div>`:''}
    </article>`;
  }
  async function solicitacoes(ctx){
    if(!ctx.tenant){ctx.container('<h1>Solicitações</h1><p>Selecione uma empresa.</p>');return;}
    const [tipos0,contexto,lista0]=await Promise.all([
      ctx.rpc('api_13c_tipos',{p_empresa:ctx.tenant}),
      ctx.rpc('api_13c_contexto',{p_empresa:ctx.tenant}),
      ctx.rpc('api_13c_listar',{p_empresa:ctx.tenant})]);
    const tipos=lista(tipos0),registros=lista(lista0);
    const pendentes=registros.filter(x=>x.status==='pendente');
    const decididos=registros.filter(x=>x.status!=='pendente');
    const autorizaveis=pendentes.filter(x=>x.pode_aprovar);
    const grupos=[...new Set(tipos.map(x=>x.setor))];
    ctx.container(`<div class="erp13c-cabecalho"><div><h1>Solicitações e aprovações</h1>
      <p>Filas separadas por setor. Apenas o responsável autorizado decide.</p></div></div>
      <div class="erp13c-numeros">
        <div class="erp13c-numero"><strong>${pendentes.length}</strong><span>Visíveis pendentes</span></div>
        <div class="erp13c-numero"><strong>${autorizaveis.length}</strong><span>Para você aprovar</span></div>
        <div class="erp13c-numero"><strong>${decididos.length}</strong><span>Histórico visível</span></div></div>
      <details class="card erp13c-secao" id="erp13c-nova"><summary><b>+ Nova solicitação</b></summary>
        <p class="muted">Somente os setores aos quais seu cargo tem acesso aparecerão aqui.</p>
        <form id="erp13c-form" class="erp12-form">
          <label>Setor<select id="erp13c-setor"><option value="">Escolha um setor</option>${grupos.map(x=>op(x,SETOR[x]||x)).join('')}</select></label>
          <label>Operação<select id="erp13c-tipo"><option value="">Selecione o setor primeiro</option></select></label>
          <div id="erp13c-campos" class="erp13c-formgrid"></div>
          <div class="erp13c-nota" id="erp13c-observacao">Escolha uma operação para ver o que acontece depois da aprovação.</div>
          <label>Justificativa<textarea name="motivo" maxlength="500" minlength="5" rows="3" required placeholder="Explique o motivo da solicitação"></textarea></label>
          <button type="submit" id="erp13c-enviar">Enviar solicitação</button>
        </form>
        <p class="muted">Descarte e ajuste de lotes: <a href="estoque-movimentacoes.html">abrir Movimentações de Estoque</a>.</p>
      </details>
      <div class="card erp13c-secao"><h2>Para análise (${autorizaveis.length})</h2>
        <div class="erp13c-filter"><label>Buscar<input type="search" id="erp13c-busca" placeholder="Nome, setor ou operação"></label>
          <label>Setor<select id="erp13c-filtro-setor"><option value="">Todos os setores</option>${Object.entries(SETOR).map(([k,v])=>op(k,v)).join('')}</select></label></div>
        <div id="erp13c-fila"></div></div>
      <details class="card erp13c-secao"><summary><b>Outras solicitações pendentes (${pendentes.length-autorizaveis.length})</b></summary>
        <div id="erp13c-outras">${pendentes.filter(x=>!x.pode_aprovar).map(x=>registro(x,contexto)).join('')||'<p class="erp13c-vazio">Nenhuma solicitação.</p>'}</div>
      </details>
      <details class="card erp13c-secao"><summary><b>Histórico de decisões (${decididos.length})</b></summary>
        <div id="erp13c-historico">${decididos.map(x=>registro(x,contexto)).join('')||'<p class="erp13c-vazio">Sem decisões registradas.</p>'}</div>
      </details>`);
    const atualizarFila=()=>{
      const busca=String($('erp13c-busca').value||'').toLocaleLowerCase('pt-BR'),setor=$('erp13c-filtro-setor').value;
      const arr=autorizaveis.filter(x=>(!setor||x.setor===setor)&&
        `${x.solicitado_por} ${x.setor} ${TIPO[x.tipo]||x.tipo} ${x.motivo}`.toLocaleLowerCase('pt-BR').includes(busca));
      $('erp13c-fila').innerHTML=arr.map(x=>registro(x,contexto)).join('')||'<p class="erp13c-vazio">Nenhuma solicitação correspondente.</p>';
      ligarDecisoes();
    };
    $('erp13c-busca').oninput=atualizarFila;
    $('erp13c-filtro-setor').onchange=atualizarFila;
    const trocarSetor=()=>{
      const setor=$('erp13c-setor').value,arr=tipos.filter(x=>x.setor===setor);
      $('erp13c-tipo').innerHTML=op('','Selecione a operação')+arr.map(x=>op(x.tipo,x.titulo)).join('');
      trocarTipo();
    };
    const trocarTipo=()=>{
      const t=$('erp13c-tipo').value;
      $('erp13c-campos').innerHTML=(campos[t]||[]).map(f=>campo(f,contexto)).join('');
      $('erp13c-observacao').textContent=efeito[t]||'Selecione uma operação.';
      $('erp13c-enviar').disabled=!t;
    };
    $('erp13c-setor').onchange=trocarSetor;
    $('erp13c-tipo').onchange=trocarTipo;
    trocarTipo();
    $('erp13c-form').onsubmit=async ev=>{
      ev.preventDefault();const bt=$('erp13c-enviar');bt.disabled=true;
      try{
        const t=$('erp13c-tipo').value,arr=campos[t];if(!arr)throw Error('Selecione uma operação');
        const fd=new FormData(ev.currentTarget),dados={};
        for(const f of arr){const v=String(fd.get(f.n)||'').trim();if(!v&&!f.opcional)throw Error('Preencha '+f.l);
          if(v)dados[f.n]=f.n==='competencia'?v+'-01':v;}
        const motivo=String(fd.get('motivo')||'').trim();
        if(motivo.length<5)throw Error('Descreva o motivo da solicitação.');
        await ctx.rpc('api_13c_solicitar',{p_empresa:ctx.tenant,p_tipo:t,p_dados:dados,p_motivo:motivo});
        ctx.aviso('Solicitação enviada para aprovação.');await solicitacoes(ctx);
      }catch(err){ctx.falha(err);bt.disabled=false;}
    };
    function ligarDecisoes(){
      document.querySelectorAll('[data-13c-decisao]').forEach(b=>b.onclick=async()=>{
        const aprovar=b.dataset['13cDecisao']==='sim';
        const titulo=aprovar?'Confirma a aprovação? O efeito descrito será aplicado.':'Por que está recusando?';
        const justificativa=prompt(titulo,aprovar?'':'') ;if(justificativa===null)return;
        if(!aprovar&&justificativa.trim().length<5){ctx.aviso('Informe justificativa de pelo menos 5 caracteres.',true);return;}
        b.disabled=true;
        try{const resposta=await ctx.rpc('api_13c_decidir',{
          p_empresa:ctx.tenant,p_solicitacao:b.dataset.id,p_origem:b.dataset.origem,
          p_aprovar:aprovar,p_justificativa:justificativa.trim()});
          ctx.aviso(resposta);await solicitacoes(ctx);
        }catch(err){ctx.falha(err);b.disabled=false;}
      });
    }
    atualizarFila();
  }
  async function avisosPainel(ctx){
    if(!ctx.tenant||!document.getElementById('conteudo'))return;
    try{
      const dados=lista(await ctx.rpc('api_13c_listar',{p_empresa:ctx.tenant}));
      const pend=dados.filter(x=>x.status==='pendente'&&x.pode_aprovar&&x.solicitado_por_id!==ctx.perfil?.id);
      if(!pend.length)return;
      const container=document.getElementById('conteudo');
      const bloco=document.createElement('section');bloco.className='card erp13c-secao';
      bloco.innerHTML=`<details><summary><b>${pend.length} solicitação(ões) aguardando sua aprovação</b></summary>
        <p class="muted">${[...new Set(pend.map(x=>SETOR[x.setor]||x.setor))].map(e).join(' · ')}</p>
        <a href="solicitacoes.html">Abrir central de solicitações</a></details>`;
      container.appendChild(bloco);
    }catch(err){console.warn('Central de solicitações indisponível:',err?.message||err);}
  }
  return {solicitacoes,avisosPainel};
})();