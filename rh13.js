/* Salamandras 13 - Gestao de Pessoas, cargos por empresa e Registro de Ponto.
   Sem dados falsos. Seguranca e isolamento aplicados nas RPCs do Supabase. */
'use strict';
window.Salamandras13 = (() => {
  const el = id => document.getElementById(id);
  const E = v => String(v??'').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const moeda = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const diaBR = v => v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
  const T = (hs,linhas)=>`<div class="rolagem"><table class="tabela"><thead><tr>${hs.map(x=>`<th>${E(x)}</th>`).join('')}</tr></thead><tbody>${linhas||`<tr><td colspan="${hs.length}" class="muted">Nenhum registro.</td></tr>`}</tbody></table></div>`;
  const C = (tit,body)=>`<section class="card"><h2>${E(tit)}</h2>${body}</section>`;
  const obs = (id,ev,fn)=>{const o=el(id);if(o)o.addEventListener(ev,fn)};
  const opts=(it,v,t)=>it.map(o=>`<option value="${E(v(o))}">${E(t(o))}</option>`).join('');
  const statusLabel = x=>({pendente:'Pendente',aprovado:'Ativo',bloqueado:'Suspenso',rejeitado:'Rejeitado',aprovada:'Aprovada',recusada:'Recusada'}[x]||x);
  // Cada setor fica em seu proprio grupo recolhido, com permissao de tela e aprovacoes.
  const gruposPermissoes=[
    {titulo:'Painel e cadastros',descricao:'Acessos gerais, sem aprovacao administrativa.',itens:[
      ['painel','Painel principal'],['produtos','Produtos'],['clientes','Clientes'],
      ['vitrine','Produtos prontos'],['agenda','Agenda'],['relatorios','Relatorios'],
      ['loja-modelos','Loja virtual']]},
    {titulo:'Logistica e almoxarifado',descricao:'Estoque e autorizacoes de movimentacao.',itens:[
      ['estoque','Acessar Estoque'],
      ['acao:logistica.aprovar_ajuste','Aprovar ajustes de inventario'],
      ['acao:logistica.aprovar_descarte','Aprovar descartes de lotes']]},
    {titulo:'Compras',descricao:'Para aprovar, o cargo tambem precisa de Estoque.',itens:[
      ['acao:compras.aprovar_compra','Autorizar solicitacoes de compra'],
      ['acao:compras.aprovar_fornecedor','Aprovar cadastro de fornecedor']]},
    {titulo:'Financeiro',descricao:'Contas, despesas e reembolsos.',itens:[
      ['financeiro','Acessar Financeiro'],
      ['acao:financeiro.aprovar_despesa','Aprovar despesas'],
      ['acao:financeiro.aprovar_reembolso','Aprovar reembolsos internos']]},
    {titulo:'Gestao de Pessoas / RH',descricao:'Funcionarios, extras e bonificacoes.',itens:[
      ['rh','Acessar Gestao de Pessoas'],
      ['acao:rh.aprovar_hora_extra','Aprovar horas extras'],
      ['acao:rh.aprovar_bonus','Aprovar bonificacoes']]},
    {titulo:'Producao',descricao:'Fabricacao e perdas de materiais.',itens:[
      ['producao','Acessar Producao'],
      ['acao:producao.aprovar_perda','Aprovar perdas de insumos sem lote'],
      ['acao:producao.aprovar_alteracao','Autorizar alteracao de ordem']]},
    {titulo:'Vendas e pedidos',descricao:'Cancelamentos, descontos e atendimento.',itens:[
      ['pedidos','Acessar Pedidos'],
      ['acao:vendas.aprovar_cancelamento','Aprovar cancelamentos de pedidos'],
      ['acao:vendas.aprovar_desconto','Autorizar proposta de desconto']]}];
  const permissoes=gruposPermissoes.flatMap(g=>g.itens);
  const protegido = arr=>Array.isArray(arr)?arr:[];
  const escopo = (ctx)=>{if(!ctx.tenant)throw new Error('Selecione uma empresa primeiro.');return ctx.tenant;};
  function escutarSubmit(ctx,id,fn){obs(id,'submit',async e=>{
    e.preventDefault();const btn=e.currentTarget.querySelector('[type="submit"]');if(btn)btn.disabled=true;
    try{await fn(new FormData(e.currentTarget));}catch(err){ctx.falha(err);}finally{if(btn)btn.disabled=false;}
  });}
  // Fila global: o DEV nao pertence a nenhuma empresa, mas aprova qualquer pedido.
  function renderizarFilaGlobal(ctx,pendentes){
    const empresas=Array.isArray(ctx.docerias)?ctx.docerias:[];
    const empresaOpts='<option value="">Selecione a empresa</option>'+opts(empresas,x=>x.id,x=>x.nome);
    return `<section class="card rh13-global-cadastros"><h2>Solicitações para o DEV (${pendentes.length})</h2>
      <p class="muted">Inclui cadastros de todas as empresas e pedidos ainda sem empresa. Cada autorização exige empresa e cargo.</p>
      ${pendentes.length?pendentes.map(u=>`<form class="rh13-global-form" data-global-pedido="${E(u.id)}">
        <div data-empresa-solicitada="${E(u.empresa_id||'')}"><b>${E(u.nome||'Nome não informado')}</b><br><small>${E(u.email)}</small>
          <br><small>Solicitação: ${E(u.empresa||'Empresa não selecionada')}</small></div>
        <div class="rh13-global-campos">
          <label>Empresa<select name="empresa" required>${empresaOpts}</select></label>
          <label>Cargo<select name="cargo" required><option value="">Escolha a empresa primeiro</option></select></label>
        </div>
        <details class="rh13-global-detalhes"><summary>Definir permissões individuais (opcional)</summary>
          <p class="muted">Se não modificar, valerão as permissões do cargo. Altere somente se quiser personalizar.</p>
          ${gruposPermissoes.map(g=>`<details><summary>${E(g.titulo)}</summary><div class="rh13-permissao-itens">${g.itens.map(([id,nome])=>`<label><input type="checkbox" name="acesso" value="${E(id)}"><span>${E(nome)}</span></label>`).join('')}</div></details>`).join('')}
        </details>
        <div class="rh13-acoes"><button type="button" class="sec small" data-acesso-tudo>acesso a tudo</button>
          <button type="submit" class="small">Aprovar</button>
          <button type="button" class="danger small" data-recusa-global>Rejeitar</button></div>
        <small class="rh13-global-info"></small>
      </form>`).join(''):'<p class="muted">Não há solicitações pendentes.</p>'}</section>`;
  }
  function vincularFilaGlobal(ctx){
    document.querySelectorAll('[data-global-pedido]').forEach(form=>{
      const id=form.dataset.globalPedido,empresaSel=form.elements.empresa,cargoSel=form.elements.cargo;
      const solicitada=form.querySelector('[data-empresa-solicitada]')?.dataset.empresaSolicitada;
      if(solicitada && [...empresaSel.options].some(o=>o.value===solicitada))empresaSel.value=solicitada;
      else if(ctx.tenant)empresaSel.value=ctx.tenant;
      const atualizar=async()=>{
        cargoSel.innerHTML='<option value="">Carregando cargos...</option>';
        if(!empresaSel.value){cargoSel.innerHTML='<option value="">Escolha a empresa primeiro</option>';return;}
        try {const data=await ctx.rpc('api_13_cargos_listar',{p_empresa:empresaSel.value});
          const cargos=protegido(data?.cargos).filter(c=>c.ativo);
          cargoSel.innerHTML='<option value="">Selecione um cargo</option>'+
            opts(cargos,c=>c.id,c=>c.nome)+(ctx.perfil.cargo==='dev'?'<option value="ADM">ADM</option>':'');
        } catch(e){ctx.falha(e);cargoSel.innerHTML='<option value="">Erro ao carregar cargos</option>';}
      };
      empresaSel.addEventListener('change',atualizar);
      if(empresaSel.value)atualizar();
      form.dataset.personalizar='nao';form.dataset.total='nao';
      form.querySelector('[data-acesso-tudo]').addEventListener('click',()=>{
        form.querySelectorAll('input[name="acesso"]').forEach(c=>c.checked=true);
        form.dataset.total='sim';form.dataset.personalizar='sim';
        form.querySelector('.rh13-global-detalhes').open=true;
        form.querySelector('.rh13-global-info').textContent='Acesso completo somente na empresa escolhida; não concede cargo DEV.';
      });
      form.querySelectorAll('input[name="acesso"]').forEach(c=>c.addEventListener('change',()=>{
        form.dataset.total='nao';form.dataset.personalizar='sim';
        form.querySelector('.rh13-global-info').textContent='Permissões individuais personalizadas.';
      }));
      const decidir=async(decisao)=>{
        const empresa=empresaSel.value||null;
        const valor=cargoSel.value;
        if(decisao==='aprovado'&&(!empresa||!valor))throw new Error('Selecione empresa e cargo.');
        const detalhes={p_usuario:id,p_empresa:empresa,p_decisao:decisao,
          p_adm:valor==='ADM',p_cargo:valor&&valor!=='ADM'?valor:null,
          p_permissoes:form.dataset.personalizar==='sim'?[...form.querySelectorAll('input[name="acesso"]:checked')].map(x=>x.value):null,
          p_acesso_total:form.dataset.total==='sim'};
        const mensagem=decisao==='aprovado'?'Aprovar este cadastro?':'Rejeitar esta solicitação?';
        if(!confirm(mensagem))return;
        const resultado=await ctx.rpc('api_13d_decidir',detalhes);
        ctx.aviso(resultado);await usuarios(ctx);
      };
      form.addEventListener('submit',async ev=>{
        ev.preventDefault();const b=form.querySelector('button[type="submit"]');b.disabled=true;
        try{await decidir('aprovado');}catch(e){ctx.falha(e);}finally{b.disabled=false;}
      });
      form.querySelector('[data-recusa-global]').addEventListener('click',async()=>{
        try{await decidir('rejeitado');}catch(e){ctx.falha(e);}
      });
    });
  }

  async function usuarios(ctx,aba=''){
    const empresa=ctx.tenant||null;
    if(!empresa && ctx.perfil.cargo!=='dev')throw new Error('Selecione uma empresa.');
    const [usuarios0,cargos0,banidos0,globais]=await Promise.all([
      empresa?ctx.rpc('api_13_usuarios',{p_empresa:empresa}):Promise.resolve([]),
      empresa?ctx.rpc('api_13_cargos_listar',{p_empresa:empresa}):Promise.resolve({cargos:[]}),
      empresa?ctx.rpc('api_13_bloqueados',{p_empresa:empresa}):Promise.resolve([]),
      ctx.perfil.cargo==='dev'?ctx.rpc('api_13d_pendentes'):Promise.resolve([])
    ]);
    const globalHtml=ctx.perfil.cargo==='dev'?renderizarFilaGlobal(ctx,protegido(globais)):'';
    if(!empresa){ctx.container(globalHtml+'<p class="muted">Selecione uma empresa no topo para gerenciar os cargos e funcionários dela.</p>');
      vincularFilaGlobal(ctx);return;}
    const lista=protegido(usuarios0),cargos=protegido(cargos0?.cargos).filter(c=>c.ativo),
      banidos=protegido(banidos0);
    const opcoes=`<option value="">Selecione um cargo</option>${opts(cargos,c=>c.id,c=>c.nome)}<option value="ADM">ADM (administrador)</option>`;
    const linha=u=>{
      const nome=u.nome||'Nome não informado';const isSelf=u.id===ctx.perfil.id;
      const decisao = u.status==='pendente'?`<div class="rh13-acoes"><select data-papel="${E(u.id)}">${opcoes}</select>
       <button type="button" class="small" data-aprovar="${E(u.id)}">Aprovar</button>
       <button type="button" class="sec small" data-rejeitar="${E(u.id)}">Rejeitar</button></div>`:'';
      const mudar=(!isSelf&&['aprovado','bloqueado'].includes(u.status))?`<div class="rh13-acoes"><select data-papel="${E(u.id)}">${opcoes}</select>
       <button type="button" class="sec small" data-trocar="${E(u.id)}">Alterar cargo</button>
       <button type="button" class="sec small" data-suspender="${E(u.id)}" data-suspender-valor="${u.status==='aprovado'}">${u.status==='aprovado'?'Suspender':'Reativar'}</button>
       <button type="button" class="sec small" data-excluir="${E(u.id)}">Excluir acesso</button>
       <button type="button" class="danger small" data-banir="${E(u.id)}">Bloquear permanentemente</button></div>`:'';
      return `<tr><td><b>${E(nome)}</b><br><small>${E(u.email)}</small></td><td>${E(u.cargo_nome)}</td>
       <td><span class="tag ${E(u.status)}">${E(statusLabel(u.status))}</span></td><td>${decisao||mudar||'—'}</td></tr>`;
    };
    const ativos=lista.filter(u=>!['rejeitado','bloqueado'].includes(u.status) && (ctx.perfil.cargo!=='dev'||u.status!=='pendente'));
    const historico=lista.filter(u=>['rejeitado','bloqueado'].includes(u.status));
    const blocos=`${globalHtml}<div class="rh13-kicker">SALAMANDRAS ERP / ADMINISTRAÇÃO</div><h1>Usuários</h1>
      <p class="muted">Gerencie sua equipe, crie cargos e defina as abas que cada cargo pode acessar. O DEV não pertence à equipe.</p>
      ${C('Pesquisar funcionários',`<div class="formgrid"><div><label>Nome ou e-mail</label><input id="rh13-busca" type="search" placeholder="Buscar funcionário"></div>
       <div><label>Cargo</label><select id="rh13-filtro-cargo"><option value="">Todos</option><option value="adm">ADM</option>${opts(cargos,c=>c.id,c=>c.nome)}</select></div>
       <div><label>Situação</label><select id="rh13-filtro-situacao"><option value="">Todas</option><option value="aprovado">Ativos</option><option value="pendente">Pendentes</option></select></div></div>`)}
      ${C(`Funcionários atuais (${ativos.length})`,`<div id="rh13-lista-ativos">${T(['Nome / E-mail','Cargo','Situação','Ações'],ativos.map(linha).join(''))}</div>`)}
      <details class="card rh13-details" id="rh13-historico"><summary>Histórico de usuários rejeitados, suspensos e excluídos (${historico.length+banidos.length})</summary>
       <p class="muted">Abra apenas quando precisar. O histórico de ações permanece salvo.</p>
       ${T(['Nome / E-mail','Cargo','Situação','Ações'],historico.map(linha).join(''))}
       <h3>Bloqueios permanentes</h3><input id="rh13-busca-bloqueados" type="search" placeholder="Pesquisar nome ou e-mail">
       <div id="rh13-lista-banidos">${T(['Nome / E-mail','Empresa','Ação'],banidos.map(b=>`<tr><td>${E(b.nome_completo||'Nome não informado')}<br><small>${E(b.email)}</small></td>
        <td>${E(b.doceria_nome||'—')}</td><td><button class="sec small" type="button" data-desbanir="${E(b.id)}">Desbloquear</button></td></tr>`).join(''))}</div>
      </details>
      <details class="card rh13-details" id="rh13-cargos"><summary>Cargos e permissões (${cargos.length})</summary>
        <p class="muted">Escolha um cargo para editar. Abra um setor por vez. Cargos novos nao possuem permissoes predefinidas; apenas ADM/DEV alteram estas escolhas.</p>
        <div class="rh13-cargos-cartoes">${cargos.map(c=>{
          const mod=protegido(c.modulos),abas=mod.filter(x=>!x.startsWith('acao:')).length,
            acoes=mod.filter(x=>x.startsWith('acao:')).length;
          return `<article class="rh13-cargo-card"><div><strong>${E(c.nome)}</strong>${c.protegido_dev?'<span class="tag">Cargo principal · DEV</span>':''}<small>${abas} área(s) · ${acoes} aprovação(ões)</small></div>
            <div class="rh13-acoes">${!c.protegido_dev||ctx.perfil.cargo==='dev'?`<button type="button" class="sec small" data-editar-cargo="${E(c.id)}">Editar</button>
            <button type="button" class="danger small" data-arquivar-cargo="${E(c.id)}">Arquivar</button>`:'<small>Somente DEV pode alterar</small>'}</div></article>`}).join('')||'<p class="muted">Nenhum cargo personalizado cadastrado.</p>'}</div>
        <button class="sec" id="rh13-novo-cargo" type="button">+ Criar novo cargo</button>
        <details class="rh13-editor-cargo" id="rh13-editor-cargo"><summary id="rh13-editor-titulo">Configurar cargo</summary>
          <form id="rh13-form-cargo" class="rh13-form"><input type="hidden" name="cargo_id" value="">
            <label>Nome do cargo<input name="nome" required maxlength="65" placeholder="Ex.: Gerente de Logística"></label>
            <p class="muted">Abra apenas os setores que deseja configurar. Todos os acessos começam desmarcados para um cargo novo.</p>
            <div class="rh13-permissoes-setores">${gruposPermissoes.map((g,ix)=>`
              <details class="rh13-permissao-grupo"><summary><span><b>${E(g.titulo)}</b><small>${E(g.descricao)}</small></span><span class="rh13-grupo-contagem" data-grupo="${ix}">0 selecionadas</span></summary>
                <div class="rh13-permissao-itens">${g.itens.map(([id,t])=>`<label><input type="checkbox" name="modulo" value="${E(id)}"><span>${E(t)}</span></label>`).join('')}</div>
              </details>`).join('')}</div>
            <div class="acoes"><button type="submit">Salvar cargo</button><button id="rh13-cargo-limpar" class="sec" type="button">Limpar seleção</button></div>
          </form>
        </details>
      </details>`;
    ctx.container(blocos);
    if(ctx.perfil.cargo==='dev')vincularFilaGlobal(ctx);
    if(aba==='cargos'||location.hash==='#cargos')el('rh13-cargos').open=true;
    const atualizarFiltro=()=>{
      const texto=(el('rh13-busca')?.value||'').toLocaleLowerCase('pt-BR'),cid=el('rh13-filtro-cargo')?.value||'',st=el('rh13-filtro-situacao')?.value||'';
      const selecionados=ativos.filter(u=>(`${u.nome||''} ${u.email||''} ${u.cargo_nome||''}`).toLocaleLowerCase('pt-BR').includes(texto)
        &&(!cid||(cid==='adm'?u.cargo==='adm':u.cargo_empresa_id===cid))&&(!st||u.status===st));
      el('rh13-lista-ativos').innerHTML=T(['Nome / E-mail','Cargo','Situação','Ações'],selecionados.map(linha).join(''));
      vincularAcoes();
    };
    ['rh13-busca','rh13-filtro-cargo','rh13-filtro-situacao'].forEach(id=>obs(id,'input',atualizarFiltro));
    obs('rh13-busca-bloqueados','input',()=>{
      const texto=el('rh13-busca-bloqueados').value.toLocaleLowerCase('pt-BR');
      el('rh13-lista-banidos').querySelectorAll('tbody tr').forEach(tr=>{tr.hidden=!tr.textContent.toLocaleLowerCase('pt-BR').includes(texto)});
    });
    const agir=async(fn,confirmar)=>{if(confirmar&&!confirm(confirmar))return;
      try{ctx.aviso(await fn());await usuarios(ctx,el('rh13-cargos')?.open?'cargos':'');}catch(e){ctx.falha(e)}};
    function papel(id){const value=document.querySelector(`[data-papel="${id}"]`)?.value||'';
      if(!value)throw new Error('Selecione um cargo.');return {p_cargo:value==='ADM'?null:value,p_adm:value==='ADM'};}
    function vincularAcoes(){
      document.querySelectorAll('[data-aprovar]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_13_usuario_decidir',{
       p_empresa:empresa,p_usuario:b.dataset.aprovar,p_decisao:'aprovado',...papel(b.dataset.aprovar)}),'Aprovar o funcionário com o cargo selecionado?'));
      document.querySelectorAll('[data-rejeitar]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_13_usuario_decidir',{
       p_empresa:empresa,p_usuario:b.dataset.rejeitar,p_decisao:'rejeitado'}),'Rejeitar a solicitação?'));
      document.querySelectorAll('[data-trocar]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_13_usuario_cargo',{
       p_empresa:empresa,p_usuario:b.dataset.trocar,...papel(b.dataset.trocar)}),'Confirmar alteração de cargo?'));
      document.querySelectorAll('[data-suspender]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_bloquear_usuario',{
       p_usuario:b.dataset.suspender,p_bloquear:b.dataset.suspenderValor==='true'}),'Confirmar suspensão/reativação?'));
      document.querySelectorAll('[data-excluir]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_remover_acesso',{p_usuario:b.dataset.excluir}),'Excluir o acesso? A conta poderá solicitar nova aprovação.'));
      document.querySelectorAll('[data-banir]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_bloquear_permanente',{p_usuario:b.dataset.banir}),'Bloquear este e-mail permanentemente?'));
      document.querySelectorAll('[data-desbanir]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_desbloquear_permanente',{p_bloqueio:b.dataset.desbanir}),'Desbloquear este e-mail?'));
    }
    vincularAcoes();
    document.querySelectorAll('[data-editar-cargo]').forEach(b=>b.onclick=()=>{
      const c=cargos.find(x=>x.id===b.dataset.editarCargo);if(!c)return;
      const f=el('rh13-form-cargo');f.elements.cargo_id.value=c.id;f.elements.nome.value=c.nome;
      f.querySelectorAll('input[name="modulo"]').forEach(i=>i.checked=protegido(c.modulos).includes(i.value));
      el('rh13-cargos').open=true;el('rh13-editor-cargo').open=true;
      el('rh13-editor-titulo').textContent='Editando: '+c.nome;
      atualizarContagens();f.scrollIntoView({block:'center',behavior:'smooth'});
    });
    document.querySelectorAll('[data-arquivar-cargo]').forEach(b=>b.onclick=()=>agir(()=>ctx.rpc('api_13_cargo_arquivar',{
      p_empresa:empresa,p_cargo:b.dataset.arquivarCargo}),'Arquivar cargo? Funcionários que ainda ocupam o cargo devem ser transferidos antes.'));
    const atualizarContagens=()=>{
      el('rh13-form-cargo')?.querySelectorAll('.rh13-permissao-grupo').forEach((g,i)=>{
        const n=g.querySelectorAll('input[name="modulo"]:checked').length;
        const badge=g.querySelector('[data-grupo]');if(badge)badge.textContent=n+' selecionada(s)';
      });
    };
    // Evita cargo inconsistente: marcar uma aprovacao habilita automaticamente a aba do setor.
    // Ao desligar a aba, suas aprovacoes tambem sao desligadas.
    obs('rh13-form-cargo','change',ev=>{
      const campo=ev.target;
      if(campo?.name==='modulo'){
        const f=el('rh13-form-cargo');
        const regra={logistica:'estoque',compras:'estoque',financeiro:'financeiro',rh:'rh',
          producao:'producao',vendas:'pedidos'};
        const todas=[...f.querySelectorAll('input[name="modulo"]')];
        const acao=campo.value.startsWith('acao:');
        if(acao&&campo.checked){
          const grupo=campo.value.slice(5).split('.')[0],base=regra[grupo];
          const item=todas.find(x=>x.value===base);if(item)item.checked=true;
        } else if(!acao&&!campo.checked){
          for(const item of todas){
            if(!item.value.startsWith('acao:'))continue;
            const grp=item.value.slice(5).split('.')[0];
            if(regra[grp]===campo.value)item.checked=false;
          }
        }
      }
      atualizarContagens();
    });
    const abrirNovo=()=>{const f=el('rh13-form-cargo');f.reset();f.elements.cargo_id.value='';
      el('rh13-cargos').open=true;el('rh13-editor-cargo').open=true;
      el('rh13-editor-titulo').textContent='Criar cargo';
      f.querySelectorAll('.rh13-permissao-grupo').forEach(g=>g.open=false);
      atualizarContagens();f.elements.nome.focus();};
    obs('rh13-novo-cargo','click',abrirNovo);
    obs('rh13-cargo-limpar','click',abrirNovo);
    atualizarContagens();
    escutarSubmit(ctx,'rh13-form-cargo',async data=>{
      const nome=String(data.get('nome')||'').trim(),modulos=data.getAll('modulo').map(String),id=data.get('cargo_id')||null;
      ctx.aviso(await ctx.rpc('api_13_cargo_salvar',{p_empresa:empresa,p_nome:nome,p_modulos:modulos,p_cargo:id}));
      await usuarios(ctx,'cargos');
    });
  }

  async function ponto(ctx){
    const empresa=escopo(ctx);
    if(ctx.perfil.cargo==='dev'){ctx.container(C('Registro de Ponto','O DEV administra a plataforma e não possui vínculo ou jornada com empresas.'));return;}
    const registros=protegido(await ctx.rpc('api_13_ponto_meu',{p_empresa:empresa,p_dias:14}));
    const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
    const tipos=['entrada','intervalo_inicio','intervalo_fim','saida'];
    const rotulos={entrada:'Entrada',intervalo_inicio:'Início do intervalo',intervalo_fim:'Fim do intervalo',saida:'Saída'};
    const hojeRegistros=registros.filter(r=>r.dia===hoje).sort((a,b)=>a.batido_em.localeCompare(b.batido_em));
    const proximo=tipos[hojeRegistros.length]||null;
    ctx.container(`<div class="rh13-kicker">SALAMANDRAS ERP / FUNCIONÁRIO</div><h1>Registro de Ponto</h1>
      ${C('Seu registro',`<p class="muted">O horário oficial é confirmado no servidor. A localização é opcional. Nenhuma foto é obrigatória.</p>
        <div class="rh13-ponto-relogio" id="rh13-relogio">${new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})}</div>
        <p class="muted">Próximo registro: <strong>${proximo?E(rotulos[proximo]):'Jornada registrada'}</strong></p>
        <label class="rh13-checkbox"><input type="checkbox" id="rh13-compartilhar-geo"> Compartilhar localização nesta batida (opcional)</label>
        <div class="rh13-acoes"><button id="rh13-bater" type="button" ${proximo?'':'disabled'}>Registrar ${E(proximo?rotulos[proximo]:'ponto')}</button></div>
        <p class="muted">Selfie opcional será adicionada quando o armazenamento privado estiver configurado. Não usamos reconhecimento facial automático.</p>`)}
      ${C('Histórico de ponto',T(['Data','Tipo','Horário do servidor'],registros.map(r=>`<tr><td>${diaBR(r.dia)}</td><td>${E(rotulos[r.tipo]||r.tipo)}</td>
       <td>${E(new Date(r.batido_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</td></tr>`).join('')))}
      ${C('Comprovantes e correções',`<p class="muted">Cada batida registrada aparece no histórico. Em caso de erro, solicite correção ao RH. A marcação original nunca é substituída silenciosamente.</p>`)}
    `);
    obs('rh13-bater','click',async()=>{
      if(!proximo)return;const b=el('rh13-bater');b.disabled=true;
      try{
        let lat=null,lng=null;
        if(el('rh13-compartilhar-geo')?.checked){
          if(!navigator.geolocation)throw new Error('Localização indisponível neste navegador. Desmarque a opção e tente novamente.');
          const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000}));
          lat=pos.coords.latitude;lng=pos.coords.longitude;
        }
        const retorno=await ctx.rpc('api_13_ponto_bater',{p_empresa:empresa,p_tipo:proximo,p_lat:lat,p_lng:lng});
        ctx.aviso(retorno.mensagem||'Ponto registrado');await ponto(ctx);
      }catch(err){ctx.falha(err);b.disabled=false;}
    });
  }

  async function rh(ctx){
    const empresa=escopo(ctx);
    const [info,tipos13c]=await Promise.all([
      ctx.rpc('api_13_rh_listar',{p_empresa:empresa}),
      ctx.rpc('api_13c_tipos',{p_empresa:empresa})]);
    const podeAprovarExtra=protegido(tipos13c).some(t=>t.tipo==='rh.hora_extra'&&t.pode_aprovar);
    const colaboradores=protegido(info?.funcionarios),ocorrencias=protegido(info?.ocorrencias),extras=protegido(info?.extras),folhas=protegido(info?.folhas),pontos=protegido(info?.pontos);
    const usuariosOpts=`<option value="">Selecione</option>${opts(colaboradores,c=>c.id,c=>`${c.nome||c.email} · ${c.funcao||c.cargo||'Sem função'}`)}`;
    const salarioTotal=colaboradores.reduce((acc,c)=>acc+Number(c.salario_base||0),0);
    const pendentes=extras.filter(x=>x.status==='pendente');
    const funcs=colaboradores.map(c=>`<tr><td><b>${E(c.nome||'Nome não informado')}</b><br><small>${E(c.email)}</small></td><td>${E(c.funcao||'Não informada')}<br><small>${E(c.cargo)}</small><br><small>Ficha por: ${E(c.alterado_por||'Não preenchida')}</small></td>
       <td>${c.salario_base==null?'<span class="rh13-warning">Incompleto: salário não cadastrado</span>':moeda(c.salario_base)}</td>
       <td><button type="button" class="sec small" data-ficha="${E(c.id)}">Editar ficha</button></td></tr>`).join('');
    ctx.container(`<div class="rh13-kicker">SALAMANDRAS ERP / GESTÃO DE PESSOAS</div><h1>Gestão de Pessoas (RH)</h1>
      <p class="muted">Informações individuais protegidas. O DEV não integra o quadro de funcionários.</p>
      <div class="rh13-indicadores"><div><small>Funcionários</small><b>${colaboradores.length}</b></div>
       <div><small>Salários-base cadastrados</small><b>${moeda(salarioTotal)}</b></div>
       <div><small>Horas extras pendentes</small><b>${pendentes.length}</b></div>
       <div><small>Ocorrências</small><b>${ocorrencias.length}</b></div></div>
      ${C('Localizar funcionário',`<label>Buscar por nome, e-mail ou função</label><input id="rh13-pesq-func" type="search" placeholder="Digite para filtrar">
       <div id="rh13-tabela-func">${T(['Funcionário','Função / cargo','Salário-base','Ação'],funcs)}</div>`)}
      <details class="card rh13-details"><summary>Gestão de ponto (${pontos.length} registros recentes)</summary>
       <p class="muted">Registros dos últimos 30 dias. Horário confirmado pelo servidor; correções nunca substituem as batidas originais.</p>
       <input id="rh13-busca-ponto" type="search" placeholder="Filtrar por funcionário ou dia">
       <div id="rh13-tabela-ponto">${T(['Funcionário','Data','Batida','Horário','Localização fornecida'],pontos.map(p=>`<tr><td>${E(p.nome||'Nome não informado')}</td>
        <td>${diaBR(p.dia)}</td><td>${E(p.tipo)}</td><td>${E(new Date(p.batido_em).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</td>
        <td>${p.latitude!=null?'Informada':'Não informada'}</td></tr>`).join(''))}</div>
      </details>
      <details class="card rh13-details" id="rh13-ficha"><summary>Cadastro profissional e salário</summary>
       <form id="rh13-ficha-form" class="rh13-form formgrid">
         <div><label>Funcionário</label><select required name="usuario">${usuariosOpts}</select></div>
         <div><label>Função profissional</label><input name="funcao" required maxlength="100" placeholder="Ex.: Assistente de vendas"></div>
         <div><label>Departamento</label><input name="departamento" maxlength="100" placeholder="Ex.: Comercial"></div>
         <div><label>Admissão</label><input type="date" name="admissao"></div>
         <div><label>Salário-base (R$)</label><input type="number" name="salario" min="0" step="0.01" required></div>
         <div><label>Divisor mensal da jornada</label><input type="number" name="divisor" min="1" max="744" step="0.01" value="220" required></div>
         <div><label>Adicional de horas extras (%)</label><input type="number" name="extra" min="0" max="250" step="0.01" value="50" required></div>
         <div><button type="submit">Salvar ficha profissional</button></div>
       </form><p class="muted">A função profissional é diferente do cargo de acesso definido em Usuários.</p>
      </details>
      <details class="card rh13-details"><summary>Atestados, faltas e outras ocorrências (${ocorrencias.length})</summary>
       <form class="rh13-form formgrid" id="rh13-ocorrencia">
        <div><label>Funcionário</label><select name="usuario" required>${usuariosOpts}</select></div>
        <div><label>Tipo</label><select name="tipo"><option value="falta">Falta</option><option value="atestado">Atestado</option><option value="ajuste_ponto">Pedido de ajuste de ponto</option><option value="outra">Outra</option></select></div>
        <div><label>Início</label><input type="date" name="inicio" required></div><div><label>Fim</label><input type="date" name="fim" required></div>
        <div><label>Descrição</label><input name="descricao" maxlength="1000" placeholder="Não coloque diagnósticos sensíveis aqui"></div>
        <div><button type="submit">Registrar ocorrência</button></div>
       </form>${T(['Funcionário','Tipo','Período','Registrado por'],ocorrencias.map(o=>`<tr><td>${E(o.nome||'Sem nome')}</td>
        <td>${E(o.tipo)}</td><td>${diaBR(o.inicio)} a ${diaBR(o.fim)}</td><td>${E(o.responsavel)}</td></tr>`).join(''))}
      </details>
      <details class="card rh13-details"><summary>Horas extras (${extras.length})</summary>
       <form class="rh13-form formgrid" id="rh13-extra">
        <div><label>Funcionário</label><select name="usuario" required>${usuariosOpts}</select></div>
        <div><label>Data</label><input type="date" name="dia" required></div>
        <div><label>Horas a aprovar</label><input name="horas" type="number" min="0.01" max="24" step="0.01" required></div>
        <div><label>Justificativa</label><input name="descricao" maxlength="300"></div>
        <div><button type="submit">Lançar horas extras</button></div>
       </form>${T(['Funcionário','Data','Horas','Situação','Ações'],extras.map(x=>`<tr>
        <td>${E(x.nome||'Sem nome')}</td><td>${diaBR(x.dia)}</td><td>${E(x.horas)}h</td>
        <td>${E(statusLabel(x.status))}<br><small>Registrado por: ${E(x.registrado_por||'—')}</small><br><small>Decisão: ${E(x.decidido_por||'—')}</small></td><td>${x.status==='pendente'&&podeAprovarExtra?`<button class="small" data-aprovar-extra="${E(x.id)}">Aprovar</button>
        <button class="sec small" data-recusar-extra="${E(x.id)}">Recusar</button>`:'—'}</td></tr>`).join(''))}
      </details>
      <details class="card rh13-details"><summary>Previsão de folha e envio ao Financeiro (${folhas.length})</summary>
       <p class="rh13-warning">Valores estimados: o sistema ainda não calcula automaticamente INSS, IRRF, DSR, adicionais de convenção, faltas e todos os encargos.</p>
       <form class="rh13-form formgrid" id="rh13-folha">
        <div><label>Funcionário</label><select name="usuario" required>${usuariosOpts}</select></div>
        <div><label>Competência</label><input name="competencia" type="month" required></div>
        <div><label>Bonificação manual adicional (R$)</label><input name="bonus" type="number" min="0" step="0.01" value="0"><small>Bonificações aprovadas em Solicitações são somadas automaticamente ao recalcular. Não repita o mesmo valor aqui.</small></div>
        <div><label>Descontos conferidos (R$)</label><input name="descontos" type="number" min="0" step="0.01" value="0"></div>
        <div><label>Encargos estimados (R$)</label><input name="encargos" type="number" min="0" step="0.01" value="0"></div>
        <div><button type="submit">Preparar previsão</button></div>
       </form>${T(['Competência','Funcionário','Bruto','Líquido estimado','Situação'],folhas.map(f=>`<tr>
        <td>${diaBR(f.competencia)}</td><td>${E(f.nome||'Sem nome')}</td>
        <td>${moeda(f.total_bruto)}</td><td>${moeda(f.liquido_estimado)}</td><td>${E(f.status)}<br><small>Por ${E(f.registrado_por||'—')}</small></td></tr>`).join(''))}
       <h3>Enviar previsão consolidada ao Financeiro</h3>
       <form class="rh13-form formgrid" id="rh13-fechamento">
        <div><label>Competência</label><input name="competencia" type="month" required></div>
        <div><label>Vencimento previsto</label><input name="vencimento" type="date" required></div>
        <div><button type="submit">Enviar após aprovação do ADM</button></div>
       </form><p class="muted">Somente ADM/DEV conclui o envio. Uma competência gera um único lançamento pendente no Financeiro.</p>
      </details>`);
    obs('rh13-busca-ponto','input',()=>{const t=el('rh13-busca-ponto').value.toLocaleLowerCase('pt-BR');
      el('rh13-tabela-ponto').querySelectorAll('tbody tr').forEach(tr=>{tr.hidden=!tr.textContent.toLocaleLowerCase('pt-BR').includes(t);});
    });
    obs('rh13-pesq-func','input',()=>{
      const t=el('rh13-pesq-func').value.toLocaleLowerCase('pt-BR');
      const filtered=colaboradores.filter(c=>`${c.nome||''} ${c.email||''} ${c.funcao||''} ${c.cargo||''}`.toLocaleLowerCase('pt-BR').includes(t));
      el('rh13-tabela-func').innerHTML=T(['Funcionário','Função / cargo','Salário-base','Ação'],filtered.map(c=>`<tr><td>${E(c.nome||'Nome não informado')}<br><small>${E(c.email)}</small></td>
       <td>${E(c.funcao||'Não informada')}<br><small>${E(c.cargo)}</small><br><small>Ficha por: ${E(c.alterado_por||'Não preenchida')}</small></td><td>${c.salario_base==null?'Incompleto':moeda(c.salario_base)}</td>
       <td><button class="sec small" data-ficha="${E(c.id)}">Editar ficha</button></td></tr>`).join(''));
      fichaBotoes();
    });
    const fichaBotoes=()=>document.querySelectorAll('[data-ficha]').forEach(b=>b.onclick=()=>{
      const c=colaboradores.find(x=>x.id===b.dataset.ficha);if(!c)return;
      el('rh13-ficha').open=true;const form=el('rh13-ficha-form');
      form.elements.usuario.value=c.id;form.elements.funcao.value=c.funcao||'';form.elements.departamento.value=c.departamento||'';
      form.elements.admissao.value=c.admissao||'';form.elements.salario.value=c.salario_base??'';
      form.elements.divisor.value=c.divisor_mensal||220;form.elements.extra.value=c.percentual_extra??50;
      el('rh13-ficha').scrollIntoView({behavior:'smooth',block:'start'});
    });fichaBotoes();
    const salvar=async(p)=>{ctx.aviso(p);await rh(ctx);};
    escutarSubmit(ctx,'rh13-ficha-form',async f=>salvar(await ctx.rpc('api_13_rh_funcionario_salvar',{
      p_empresa:empresa,p_usuario:f.get('usuario'),p_funcao:f.get('funcao'),p_departamento:f.get('departamento'),
      p_admissao:f.get('admissao')||null,p_salario:Number(f.get('salario')),
      p_divisor:Number(f.get('divisor')),p_extra:Number(f.get('extra'))})));
    escutarSubmit(ctx,'rh13-ocorrencia',async f=>salvar(await ctx.rpc('api_13_rh_ocorrencia_criar',{
      p_empresa:empresa,p_usuario:f.get('usuario'),p_tipo:f.get('tipo'),p_inicio:f.get('inicio'),
      p_fim:f.get('fim'),p_descricao:f.get('descricao')||''})));
    escutarSubmit(ctx,'rh13-extra',async f=>salvar(await ctx.rpc('api_13_rh_extra_criar',{
      p_empresa:empresa,p_usuario:f.get('usuario'),p_dia:f.get('dia'),p_horas:Number(f.get('horas')),
      p_descricao:f.get('descricao')||''})));
    for(const [sel,decisao] of [['data-aprovar-extra',true],['data-recusar-extra',false]]){
      document.querySelectorAll(`[${sel}]`).forEach(b=>b.onclick=async()=>{
        if(!confirm(`Confirmar ${decisao?'aprovação':'recusa'} dessas horas extras?`))return;
        try{await salvar(await ctx.rpc('api_13_rh_extra_decidir',{p_empresa:empresa,p_extra:b.getAttribute(sel),p_aprovar:decisao}));}catch(err){ctx.falha(err)}
      });
    }
    escutarSubmit(ctx,'rh13-folha',async f=>salvar(await ctx.rpc('api_13_rh_folha_preparar',{
      p_empresa:empresa,p_usuario:f.get('usuario'),p_competencia:f.get('competencia')+'-01',
      p_bonus:Number(f.get('bonus')||0),p_descontos:Number(f.get('descontos')||0),p_encargos:Number(f.get('encargos')||0)})));
    escutarSubmit(ctx,'rh13-fechamento',async f=>{
      if(!confirm('Enviar uma previsão consolidada ao Financeiro? Confira antes os impostos e descontos.'))return;
      await salvar(await ctx.rpc('api_13_rh_folha_enviar',{p_empresa:empresa,p_competencia:f.get('competencia')+'-01',p_vencimento:f.get('vencimento')}));
    });
  }

  async function relatorioCaixa(ctx,alvo='rh13-relatorio-caixa'){
    const empresa=escopo(ctx),ano=new Date().getFullYear();
    const raiz=el(alvo);if(!raiz)return;
    raiz.innerHTML=C('Fluxo financeiro por mês',`<p class="muted">Entradas e saídas efetivamente pagas, inclusive as previsões de folha marcadas como pagas.
       O saldo de caixa não equivale ao lucro líquido contábil.</p><p class="rh13-warning">Lucro líquido: incompleto enquanto houver custos de produtos, impostos ou despesas ainda não cadastrados.</p><label>Ano</label><input id="rh13-ano-caixa" type="number" min="2020" max="2100" value="${ano}">
      <div id="rh13-grafico-caixa"></div>`);
    const desenhar=async()=>{
      const anoN=Number(el('rh13-ano-caixa').value);if(!Number.isInteger(anoN)||anoN<2020||anoN>2100)return;
      const rows=protegido(await ctx.rpc('api_13_relatorio_caixa',{p_empresa:empresa,p_ano:anoN}));
      const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const max=Math.max(1,...rows.flatMap(r=>[Number(r.entradas),Number(r.saidas)]));
      const conteudo=rows.map(r=>`<button type="button" class="rh13-mes" title="${E(meses[r.mes-1])}: entradas ${moeda(r.entradas)}, saídas ${moeda(r.saidas)}" data-mes="${r.mes}">
         <span class="rh13-barras"><span class="rh13-barra entrada" style="height:${Math.round(140*Number(r.entradas)/max)}px"></span>
         <span class="rh13-barra saida" style="height:${Math.round(140*Number(r.saidas)/max)}px"></span></span>
         <small>${E(meses[r.mes-1])}</small></button>`).join('');
      el('rh13-grafico-caixa').innerHTML=`<div class="rh13-legenda"><span>● Recebido</span><span>● Pago</span></div><div class="rh13-grafico">${conteudo}</div>
      <div id="rh13-mes-detalhe" class="rh13-detalhe">Selecione um mês para ver os valores e o resultado.</div>`;
      document.querySelectorAll('[data-mes]').forEach(b=>b.onclick=()=>{
        const r=rows.find(x=>String(x.mes)===b.dataset.mes);if(!r)return;
        el('rh13-mes-detalhe').innerHTML=`<b>${E(meses[r.mes-1])}/${anoN}</b> · Entradas: ${moeda(r.entradas)} · Saídas: ${moeda(r.saidas)} · <b>Saldo: ${moeda(r.saldo)}</b>`;
      });
    };
    obs('rh13-ano-caixa','change',()=>desenhar().catch(ctx.falha));await desenhar();
  }
  return {usuarios,ponto,rh,relatorioCaixa};
})();