/* SALAMANDRAS 12 - A GRANDE ATUALIZACAO | base 12C preservada */
'use strict';

/* SALAMANDRAS 11 — modo claro/escuro do ERP (sem alterar a loja pública).
   A preferência fica salva somente neste navegador. */
const CHAVE_TEMA_ERP = 'salamandras_erp_tema';
function temaSalvo() {
  try { return window.localStorage.getItem(CHAVE_TEMA_ERP) === 'escuro' ? 'escuro' : 'claro'; }
  catch (_) { return 'claro'; }
}
function aplicarTemaERP(tema) {
  const valor = tema === 'escuro' ? 'escuro' : 'claro';
  document.documentElement.setAttribute('data-tema-erp', valor);
  const botao = document.getElementById('alternar-tema-erp');
  if (botao) {
    botao.textContent = valor === 'escuro' ? '☀️' : '🌙';
    botao.setAttribute('aria-label', valor === 'escuro' ? 'Ativar modo claro' : 'Ativar modo escuro');
    botao.setAttribute('aria-pressed', String(valor === 'escuro'));
    botao.title = valor === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro';
  }
}
function iniciarBotaoTemaERP() {
  // O botão aparece no login e em qualquer tela do ERP que carregue app.js.
  const destino = document.querySelector('.userbar') || document.querySelector('.painel-login');
  if (!destino || document.getElementById('alternar-tema-erp')) return;
  const botao = document.createElement('button');
  botao.id = 'alternar-tema-erp';
  botao.type = 'button';
  botao.className = 'alternar-tema-erp';
  if (destino.classList.contains('painel-login')) {
    const area = document.createElement('div');
    area.className = 'tema-erp-login';
    area.appendChild(botao);
    destino.prepend(area);
  } else {
    // Antes de Sair, sem modificar os HTMLs das páginas.
    const sairBotao = document.getElementById('sair');
    if (sairBotao && sairBotao.parentElement === destino) destino.insertBefore(botao, sairBotao);
    else destino.appendChild(botao);
  }
  botao.addEventListener('click', () => {
    const novo = document.documentElement.getAttribute('data-tema-erp') === 'escuro' ? 'claro' : 'escuro';
    try { window.localStorage.setItem(CHAVE_TEMA_ERP, novo); } catch (_) { /* navegação privada */ }
    aplicarTemaERP(novo);
  });
  aplicarTemaERP(temaSalvo());
}
// Aplique o tema antes de iniciar a sessão para evitar a tela clara piscando.
aplicarTemaERP(temaSalvo());
window.addEventListener('storage', (evento) => {
  if (evento.key === CHAVE_TEMA_ERP) aplicarTemaERP(temaSalvo());
});


const db = window.supabase.createClient(
  window.SALAMANDRAS_CONFIG.url,
  window.SALAMANDRAS_CONFIG.key
);
const pagina = document.body.dataset.page;
const $ = (id) => document.getElementById(id);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reais = (n) => Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dataBR = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—';
const nomeCargo = {dev:'DEV',adm:'ADM',financeiro:'Financeiro',logistica:'Logística',confeiteiro:'Confeiteiro',atendente:'Atendente',funcionario:'Funcionário'};
// SALAMANDRAS 12: barras empilhadas por produto, escala automatica,
// detalhes ao passar o mouse ou tocar. Sem bibliotecas externas.
const NOMES_MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CORES_VENDAS = [
  '#eba44a','#66c8b5','#e284a9','#8494e1','#c18ac9','#e5816d',
  '#8fb85e','#64abd8','#d5ac5d','#ae84d0','#5abfc3','#da8984'
];
function passoEscalaVendas(maximo){
  if(maximo<=0)return 10;
  const ideal=maximo/4;
  const ordem=Math.pow(10,Math.floor(Math.log10(ideal)));
  return [1,2,2.5,5,10].map(v=>v*ordem).find(v=>v>=ideal)||10*ordem;
}
function corDoProduto(indice){
  return CORES_VENDAS[indice] || `hsl(${Math.round(indice*137.508)%360} 64% 59%)`;
}
function graficoVendas(dados,titulo='Vendas por mês',detalhesProdutos=[]){
  const vendas=Array.isArray(dados)?dados:[];
  const detalhamento=Array.isArray(detalhesProdutos)?detalhesProdutos:[];
  const catalogo=new Map();
  detalhamento.forEach(m=>{
    (Array.isArray(m.produtos)?m.produtos:[]).forEach(produto=>{
      const id=String(produto.produto_id||produto.id||'');
      if(!id)return;
      const atual=catalogo.get(id)||{id,nome:String(produto.nome||'Produto sem nome'),valor:0};
      atual.valor+=Math.max(0,Number(produto.valor)||0);
      catalogo.set(id,atual);
    });
  });
  const listaProdutos=[...catalogo.values()].sort((a,b)=>b.valor-a.valor||a.nome.localeCompare(b.nome,'pt-BR'));
  const cores=new Map(listaProdutos.map((p,i)=>[p.id,corDoProduto(i)]));
  const meses=Array.from({length:12},(_,i)=>{
    const registro=vendas.find(d=>Number(d.mes)===i+1)||{};
    const produtoMes=detalhamento.find(d=>Number(d.mes)===i+1)||{};
    const produtos=(Array.isArray(produtoMes.produtos)?produtoMes.produtos:[])
      .filter(p=>Number(p.valor)>0).map(p=>({
        id:String(p.produto_id||p.id||''),nome:String(p.nome||'Produto sem nome'),
        valor:Math.max(0,Number(p.valor)||0),quantidade:Math.max(0,Number(p.quantidade)||0)
      })).sort((a,b)=>b.valor-a.valor);
    const total=Number(registro.total)||0;
    const somaProdutos=produtos.reduce((s,p)=>s+p.valor,0);
    // Pedidos antigos sem itens detalhados continuam visiveis, sem inventar um produto.
    if(total-somaProdutos>0.015){
      produtos.push({id:'__outros__',nome:'Sem detalhamento / ajustes',valor:total-somaProdutos,quantidade:0});
    }
    return {mes:NOMES_MESES[i],total:Math.max(total,somaProdutos,0),pedidos:Number(registro.pedidos)||0,produtos};
  });
  const maior=Math.max(0,...meses.map(m=>m.total));
  const passo=passoEscalaVendas(maior);
  const teto=passo*4;
  const formatoEixo=n=>'R$ '+Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const eixo=[4,3,2,1,0].map(i=>`<span>${esc(formatoEixo(passo*i))}</span>`).join('');
  const linhas=[0,25,50,75,100].map(v=>`<span style="top:${v}%"></span>`).join('');
  const barras=meses.map((m,i)=>{
    const altura=m.total>0?Math.max(1,m.total/teto*100):0;
    const pedacos=m.produtos.map(p=>{
      const cor=p.id==='__outros__'?'#819398':cores.get(p.id)||'#819398';
      const proporcao=p.valor/m.total*100;
      const legenda=`${m.mes} · ${p.nome}: ${reais(p.valor)}${p.quantidade>0?' · '+p.quantidade+' unidade(s)':''}`;
      return `<button type="button" class="grafico12-segmento" style="height:${proporcao.toFixed(5)}%;background:${cor}" data-venda-produto="${esc(p.id)}" data-mes-grafico="${i}" data-venda-nome="${esc(p.nome)}" data-venda-valor="${p.valor.toFixed(2)}" data-venda-quantidade="${p.quantidade}" title="${esc(legenda)}" aria-label="${esc(legenda)}"></button>`;
    }).reverse().join('');
    return `<div class="grafico12-mes">
      <div class="grafico12-espaco"><div class="grafico12-pilha" style="height:${altura.toFixed(5)}%">${pedacos}</div></div>
      <button type="button" class="grafico12-mes-botao" data-escolher-mes="${i}" data-total-mes="${m.total}" title="${esc(m.mes)}: ${esc(reais(m.total))}" aria-label="Consultar todas as vendas de ${m.mes}">${m.mes}</button>
    </div>`;
  }).join('');
  const legenda=listaProdutos.map(p=>`<span class="grafico12-legenda-item"><i style="background:${cores.get(p.id)}"></i>${esc(p.nome)}</span>`).join('');
  const info=maior===0?'<p class="grafico12-sem-vendas">Ainda não há pedidos entregues neste período.</p>':'';
  return `<section class="grafico-vendas grafico12" aria-label="${esc(titulo)}">
    <h3 class="grafico-titulo">${esc(titulo)}</h3>
    <p class="grafico12-instrucao">Passe o mouse sobre uma cor ou toque na barra para ver produto, quantidade e valor.</p>
    <div class="grafico12-corpo">
      <div class="grafico12-eixo" aria-label="Escala em reais">${eixo}</div>
      <div class="grafico12-rolagem"><div class="grafico12-area">
        <div class="grafico12-grade" aria-hidden="true">${linhas}</div>
        <div class="grafico12-meses">${barras}</div>
      </div></div>
    </div>
    <div class="grafico12-legenda" aria-label="Cores dos produtos">${legenda||'<span>Sem produtos vendidos</span>'}</div>
    ${info}
    <div class="grafico-detalhe grafico12-detalhe" aria-live="polite"></div>
  </section>`;
}
function ativarGraficos(raiz=document){
  raiz.querySelectorAll('.grafico12').forEach(grafico=>{
    const meses=[...grafico.querySelectorAll('[data-escolher-mes]')];
    const segmentos=[...grafico.querySelectorAll('[data-venda-produto]')];
    const detalhe=grafico.querySelector('.grafico12-detalhe');
    if(!meses.length||!detalhe)return;
    const escolherMes=b=>{
      meses.forEach(x=>x.classList.toggle('selecionado',x===b));
      segmentos.forEach(x=>x.classList.toggle('selecionado',false));
      const indice=Number(b.dataset.escolherMes);
      const itens=segmentos.filter(x=>Number(x.dataset.mesGrafico)===indice)
        .sort((a,b)=>Number(b.dataset.vendaValor)-Number(a.dataset.vendaValor));
      const resumo=itens.length?itens.map(x=>`<span><i class="grafico12-bolinha" style="background:${x.style.backgroundColor}"></i>${esc(x.dataset.vendaNome)}: ${reais(x.dataset.vendaValor)}${Number(x.dataset.vendaQuantidade)>0?' ('+Number(x.dataset.vendaQuantidade)+' un.)':''}</span>`).join(''):'Nenhuma venda entregue neste mês.';
      detalhe.innerHTML=`<strong>${esc(NOMES_MESES[indice])} · ${reais(b.dataset.totalMes)}</strong><div class="grafico12-detalhe-itens">${resumo}</div>`;
    };
    const escolherProduto=b=>{
      const indice=Number(b.dataset.mesGrafico);
      meses.forEach(x=>x.classList.toggle('selecionado',Number(x.dataset.escolherMes)===indice));
      segmentos.forEach(x=>x.classList.toggle('selecionado',x===b));
      detalhe.innerHTML=`<strong>${esc(NOMES_MESES[indice])} · ${reais(meses[indice].dataset.totalMes)}</strong><div class="grafico12-detalhe-itens"><span><i class="grafico12-bolinha" style="background:${b.style.backgroundColor}"></i>${esc(b.dataset.vendaNome)} — <b>${reais(b.dataset.vendaValor)}</b>${Number(b.dataset.vendaQuantidade)>0?' · '+Number(b.dataset.vendaQuantidade)+' unidade(s)':''}</span></div>`;
    };
    meses.forEach(b=>b.addEventListener('click',()=>escolherMes(b)));
    segmentos.forEach(b=>{
      b.addEventListener('pointerenter',()=>escolherProduto(b));
      b.addEventListener('focus',()=>escolherProduto(b));
      b.addEventListener('click',()=>escolherProduto(b));
    });
    const inicial=[...meses].reverse().find(b=>Number(b.dataset.totalMes)>0)||meses[new Date().getMonth()]||meses[0];
    escolherMes(inicial);
  });
}


// ATT 12B — motivos de cancelamento, exclusivos para ADM e DEV.
function graficoCancelamentos(dados){
  const categorias=Array.isArray(dados?.categorias)?dados.categorias:[];
  const total=Number(dados?.total||0);
  if(!total)return cartao('Principais motivos de cancelamento',
    '<p class="muted">Nenhum pedido cancelado neste ano.</p>');
  const cores=['#ce4653','#de6d56','#e69a58','#b55c80','#ba7549','#b86d9a','#a04c55','#9b6670'];
  const itens=categorias.map((c,i)=>{
    const n=Number(c.quantidade||0);
    const pct=total?100*n/total:0;
    const titulo=`${c.categoria} · ${n} pedido(s) · ${pct.toFixed(1)}%`;
    return `<div class="motivo12-linha" title="${esc(titulo)}">
      <div class="motivo12-nome">${esc(c.categoria)}</div>
      <div class="motivo12-trilho"><div class="motivo12-barra" style="width:${Math.max(0,Math.min(100,pct)).toFixed(1)}%;background:${cores[i%cores.length]}"></div></div>
      <strong class="motivo12-valor">${n} · ${pct.toFixed(1)}%</strong>
    </div>`;
  }).join('');
  return cartao(`Principais motivos de cancelamento (${total})`,
    `<p class="muted">Percentual de pedidos cancelados por motivo. Passe o mouse sobre as barras para consultar.</p>
    <div class="motivo12-grafico" role="img" aria-label="Grafico de motivos de cancelamento">${itens}</div>`);
}
function tabelaCancelamentos(dados){
  const pedidos=Array.isArray(dados?.pedidos)?dados.pedidos:[];
  return cartao('Justificativas dos pedidos cancelados',tabela(
    ['Pedido','Data','Cliente','Categoria','Justificativa','Cancelado por'],
    pedidos.map(p=>`<tr><td><strong>#${esc(p.numero)}</strong></td>
      <td>${dataBR(p.created_at)}</td><td>${esc(p.cliente)}</td><td>${esc(p.categoria)}</td>
      <td>${esc(p.motivo)}</td><td>${esc(p.responsavel)}</td></tr>`).join('')
  ));
}
function tabelaHistoricoOperacoes(dados){
  const itens=Array.isArray(dados)?dados:[];
  return cartao('Historico de movimentacoes e responsaveis',
    `<p class="muted">Somente ADM e DEV veem nomes. Registros antigos sem autor sao identificados como nao registrados.</p>`+
    tabela(['Quando','Responsavel','Area','Acao','Registro'],
      itens.map(m=>`<tr><td>${dataBR(m.created_at)}</td>
        <td>${esc(m.autor_nome)}</td><td>${esc(m.entidade)}</td>
        <td>${esc(String(m.acao||'').replace(/^status_/,''))}</td>
        <td>${esc(m.descricao)}</td></tr>`).join('')));
}

const paginas = [
  ['painel','Painel'],['usuarios','Usuários'],['permissoes','Permissões'],
  ['empresas','Empresas'],['redes','Redes da loja'],
  ['estoque','Estoque'],['produtos','Produtos'],
  ['pedidos','Pedidos'],['clientes','Clientes'],
  ['producao','Produção'],['produtos-prontos','Produtos prontos'],
  ['agenda','Agenda de entregas'],['financeiro','Financeiro'],
  ['rh','Gestão de Pessoas'],['registro-ponto','Registro de Ponto'],
  ['relatorios','Relatórios'],['loja-modelos','Loja virtual'],
  ['solicitacoes','Solicitações'],
  ['estoque-ingredientes','Ingredientes'],['estoque-locais','Localizações'],
  ['estoque-compras','Compras'],['estoque-movimentacoes','Movimentações'],
  ['estoque-custos','Custos'],['estoque-alertas','Alertas'],
  ['docerias','Empresas'],['vitrine','Produtos prontos']
];
const modulosOcultos = new Set(['docerias','vitrine','permissoes','cancelados','estoque-ingredientes','estoque-locais',
  'estoque-compras','estoque-movimentacoes','estoque-custos','estoque-alertas']);
const modulosEquipe = [['painel','Painel'],['estoque','Estoque'],['produtos','Produtos'],
  ['pedidos','Pedidos'],['clientes','Clientes'],['producao','Produção'],
  ['vitrine','Produtos prontos'],['agenda','Agenda de entregas']];
let permissoesAtivas = {};
function podePagina(modulo){
  if(modulo==='empresas'||modulo==='docerias')return perfil?.cargo==='dev';
  if(['usuarios','permissoes','cancelados'].includes(modulo))return ['dev','adm'].includes(perfil?.cargo);
  if(modulo==='solicitacoes')return ['dev','adm'].includes(perfil?.cargo)||
    ['estoque','financeiro','rh','pedidos','producao'].some(m=>permissoesAtivas[m]);
  if(modulo==='registro-ponto')return perfil?.cargo!=='dev' && Boolean(permissoesAtivas['registro-ponto']);
  if(modulo==='rh'||modulo==='financeiro'||modulo==='relatorios'||modulo==='loja-modelos')
    return perfil?.cargo==='dev'||perfil?.cargo==='adm'||Boolean(permissoesAtivas[modulo]);
  if(modulo==='estoque-custos')return ['dev','adm'].includes(perfil?.cargo)||Boolean(permissoesAtivas.financeiro);
  if(modulo==='redes')return ['dev','adm'].includes(perfil?.cargo);
  if(modulo.startsWith('estoque-'))modulo='estoque';
  if(modulo==='produtos-prontos')modulo='vitrine';
  return Boolean(permissoesAtivas[modulo]);
}
async function atualizarPermissoes(){
  permissoesAtivas=tenant?await rpc('api_minhas_permissoes',{p_doceria:tenant}):{};
  $('menu').innerHTML=paginas.filter(x=>!modulosOcultos.has(x[0]) && podePagina(x[0])).map(x=>
    `<a ${x[0]===pagina?'class="ativo"':''} href="${x[0]}.html">${esc(x[1])}</a>`).join('');
}
let usuario=null, perfil=null, docerias=[], tenant=null;
let carrinho=[];

function pode(...cargos){
  if(!perfil)return false;
  if(perfil.cargo==='dev'||perfil.cargo==='adm')return true;
  if(cargos.includes(perfil.cargo))return true;
  if(!perfil.cargo_empresa_id)return false;
  const porModulo={atendente:'pedidos',estoquista:'estoque',logistica:'estoque',
    confeiteiro:'producao',financeiro:'financeiro'};
  return cargos.some(c=>c!=='adm' && Boolean(permissoesAtivas[porModulo[c]]));
}
function aviso(msg, erro=false) {
  const el=$('aviso');
  if(!el) return;
  el.textContent=msg; el.style.display='block'; el.classList.toggle('erro',!!erro);
  clearTimeout(window.__avisoTimer);
  window.__avisoTimer=setTimeout(()=>{el.style.display='none';},8500);
}
function falha(err) { console.error('Salamandras:',err); aviso(err?.message || 'Erro inesperado', true); }
async function rpc(nome, parametros={}) {
  const {data,error}=await db.rpc(nome,parametros);
  if(error) throw new Error(error.message);
  return data;
}
async function selecionar(tabela,colunas='*') {
  const {data,error}=await db.from(tabela).select(colunas).eq('doceria_id',tenant);
  if(error) throw new Error(error.message);
  return data || [];
}
function form(id, acao) {
  const el=$(id); if(!el) return;
  el.addEventListener('submit', async ev=>{
    ev.preventDefault();
    const botao=el.querySelector('button[type="submit"]');
    if(botao) botao.disabled=true;
    try {await acao(el);} catch(e){falha(e);} finally {if(botao) botao.disabled=false;}
  });
}
function on(id,evento,acao) { const el=$(id); if(el) el.addEventListener(evento,acao); }
function container(html) { $('conteudo').innerHTML=html; }
function cartao(titulo,corpo){return `<section class="card"><h2>${esc(titulo)}</h2>${corpo}</section>`;}
function tabela(cabecalhos,linhas){
  return `<div class="rolagem"><table class="tabela"><thead><tr>${cabecalhos.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${linhas || `<tr><td colspan="${cabecalhos.length}" class="muted">Nenhum registro.</td></tr>`}</tbody></table></div>`;
}
function selectOpcoes(itens,valorFn,textoFn,selecionado){
  return itens.map(item=>`<option value="${esc(valorFn(item))}" ${valorFn(item)===selecionado?'selected':''}>${esc(textoFn(item))}</option>`).join('');
}
function badge(valor){return `<span class="tag ${esc(valor)}">${esc(valor)}</span>`;}
function nomeProduto(id,lista){return lista.find(x=>x.id===id)?.nome || 'Produto não encontrado';}
function nomeDoceria(id){return docerias.find(x=>x.id===id)?.nome || 'Sem empresa';}
function minhaDoceria(){return docerias.find(d=>d.id===tenant);}
function requerDoceria(){
  if(tenant) return false;
  container(cartao('Nenhuma doceria selecionada',
    `<p>Se você é DEV, crie primeiro um estabelecimento em <a href="empresas.html">Empresas</a>. Se você é funcionário, peça para o administrador atribuir uma empresa à sua conta.</p>`));
  return true;
}
async function lerPerfil(){
  const {data:{user},error}=await db.auth.getUser();
  if(error || !user) return null;
  const {data:p,error:erro}=await db.from('perfis').select('id,nome_completo,cargo,status,doceria_id,cargo_empresa_id').eq('id',user.id).single();
  if(erro || !p) throw new Error('Perfil não encontrado. Confira se o SQL do Salamandras foi executado.');
  usuario=user; perfil=p;
  return p;
}
async function sair(){await db.auth.signOut();window.location.replace('index.html');}

// Login e cadastro separados; contas novas permanecem pendentes ate aprovacao.
async function iniciarLogin(){
  // Alternar entre entrar e criar conta sem navegar para outra pagina.
  on('mostrar-cadastro','click',()=>{
    $('area-login').classList.add('escondido');
    $('area-cadastro').classList.remove('escondido');
    $('aviso').style.display='none';
    $('cad-nome').focus();
  });
  on('mostrar-login','click',()=>{
    $('area-cadastro').classList.add('escondido');
    $('area-login').classList.remove('escondido');
    $('aviso').style.display='none';
    $('login-email').focus();
  });

  // Conta existente: somente email e senha. NUNCA tenta cadastrar se a senha estiver errada.
  form('form-login',async()=>{
    const email=$('login-email').value.trim().toLowerCase();
    const password=$('login-senha').value;
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error){
      const msg=String(error.message||'').toLowerCase();
      if(msg.includes('email not confirmed')||msg.includes('e-mail not confirmed'))
        throw new Error('Confirme seu e-mail para entrar.');
      if(msg.includes('invalid login credentials')||msg.includes('invalid credentials'))
        throw new Error('E-mail ou senha incorretos. Se nao tem conta, clique em Cadastre-se.');
      throw new Error(error.message);
    }
    await rotaAposLogin();
  });

  // Conta nova: nome completo + email + senha. O trigger do SQL 08R cria perfil pendente.
  form('form-cadastro',async()=>{
    const nome=$('cad-nome').value.trim().replace(/\s+/g,' ');
    const email=$('cad-email').value.trim().toLowerCase();
    const password=$('cad-senha').value;
    if(nome.length<5||nome.split(' ').length<2)
      throw new Error('Informe nome e sobrenome.');
    if(password.length<8)
      throw new Error('Crie uma senha com pelo menos 8 caracteres.');

    const {data,error}=await db.auth.signUp({
      email,password,options:{data:{nome_completo:nome}}
    });
    if(error){
      const msg=String(error.message||'').toLowerCase();
      if(msg.includes('already registered')||msg.includes('already exists'))
        throw new Error('Este e-mail ja possui cadastro. Volte ao login.');
      throw new Error(error.message);
    }

    if(data.session){
      // Mesmo com sessao autenticada, nao entra no ERP sem status aprovado.
      await rotaAposLogin();
    }else{
      // Supabase pode pedir confirmacao de email, ou responder de forma generica
      // caso o endereco ja exista. Nunca afirmar que a conta foi criada sem sessao.
      $('auth-forms').classList.add('escondido');
      $('pendente').classList.remove('escondido');
      $('pendente-titulo').textContent='Verifique seu cadastro';
      $('pendente-texto').textContent='Se o e-mail for novo, verifique sua caixa de entrada (caso seja solicitada confirmacao) e aguarde a aprovacao do ADM ou DEV. Se ja tinha uma conta, volte e use Entrar.';
      $('form-convite').classList.add('escondido');
    }
  });

  form('form-convite',async()=>{
    const codigo=$('codigo-convite').value.trim();
    if(!codigo)throw new Error('Digite o codigo recebido da doceria.');
    aviso(await rpc('api_solicitar_doceria',{p_codigo:codigo}));
    $('codigo-convite').value='';
  });
  on('sair-pendente','click',sair);
  // Reaproveita a conta Auth existente; nao tenta criar um segundo usuario para o mesmo e-mail.
  const pendente=$('pendente');
  if(pendente && !$('pedir-novo-cadastro')){
    const botao=document.createElement('button');
    botao.type='button';botao.id='pedir-novo-cadastro';
    botao.className='sec escondido';
    botao.textContent='Solicitar novo cadastro';
    const formulario=$('form-convite');
    if(formulario) formulario.insertAdjacentElement('beforebegin',botao);
    else pendente.appendChild(botao);
    botao.addEventListener('click',async()=>{
      botao.disabled=true;
      try{
        const texto=await rpc('api_reenviar_solicitacao');
        await rotaAposLogin();
        aviso(texto);
      }catch(e){falha(e);}finally{botao.disabled=false;}
    });
  }
  try{await rotaAposLogin();}catch(e){falha(e);}
}

async function rotaAposLogin(){
  const p=await lerPerfil();
  if(!p){$('auth-forms').classList.remove('escondido');$('pendente').classList.add('escondido');return;}
  if(p.status==='aprovado'){
    window.location.replace('painel.html');return;
  }
  $('auth-forms').classList.add('escondido');
  $('pendente').classList.remove('escondido');
  $('pendente-titulo').textContent=p.status==='pendente'?'Aguardando aprovação'
    : p.status==='rejeitado'?'Acesso não aprovado':p.status==='bloqueado'?'Acesso suspenso':`Acesso: ${p.status}`;
  $('pendente-texto').textContent=p.status==='pendente'
    ? 'Seu cadastro existe, mas ainda precisa ser aprovado. Informe o código de convite da empresa ou aguarde o administrador.'
    : p.status==='rejeitado'
      ? 'Sua aprovação foi cancelada ou o cadastro foi rejeitado. Você pode solicitar novamente com este mesmo e-mail e senha.'
      : 'Seu acesso está bloqueado. Consulte um administrador.';
  $('form-convite').classList.toggle('escondido',p.status!=='pendente');
  if($('pedir-novo-cadastro'))$('pedir-novo-cadastro').classList.toggle('escondido',p.status!=='rejeitado');
}

// Aplicativo autenticado: todas as páginas verificam sessão e cargo.
async function iniciarApp(){
  try{
    const p=await lerPerfil();
    if(!p || p.status!=='aprovado'){window.location.replace('index.html');return;}
    if(p.cargo!=='dev'){
      const statusEmpresa=await rpc('api_12_minha_empresa');
      if(statusEmpresa?.situacao!=='ativa'){
        container(cartao('Acesso da empresa indisponível',
          '<p>O acesso desta empresa está temporariamente suspenso ou encerrado. Entre em contato com o responsável pelo contrato.</p><p>Seus dados não foram excluídos.</p>'));
        on('sair','click',sair);return;
      }
    }
    const especificacao=paginas.find(x=>x[0]===pagina);
    if(!especificacao){container(cartao('Página desconhecida','Página não encontrada.'));return;}
    const nomeCargoReal=p.cargo_empresa_id ? await rpc('api_13_meu_cargo') : (nomeCargo[p.cargo]||p.cargo);
    $('usuario-atual').textContent=`${p.nome_completo||usuario.email} · ${nomeCargoReal}`;
    on('sair','click',sair);
    docerias=await rpc('api_docerias');
    if(p.cargo==='dev'){
      const escolhido=sessionStorage.getItem('salamandras_tenant');
      tenant=docerias.some(d=>d.id===escolhido)?escolhido:(docerias[0]?.id||null);
      $('seletor-tenant').innerHTML=`<select id="trocar-doceria" aria-label="Empresa ativa"><option value="">Selecionar empresa</option>${selectOpcoes(docerias,d=>d.id,d=>d.nome,tenant)}</select>`;
      on('trocar-doceria','change',ev=>{
        tenant=ev.target.value||null;
        sessionStorage.setItem('salamandras_tenant',tenant||'');
        atualizarPermissoes().then(carregarPagina).catch(falha);
      });
    }else{
      tenant=p.doceria_id;
      $('seletor-tenant').textContent=nomeDoceria(tenant);
    }
    await atualizarPermissoes();
    await carregarPagina();
  }catch(err){container(cartao('Erro de inicialização',`<p>${esc(err.message)}</p><p>Confira se executou <code>SQL_12_GRANDE_ATUALIZACAO.sql</code> e atualize a página.</p>`));console.error(err);}
}
function contexto12(){return {rpc,db,tenant,perfil,container,cartao,esc,reais,aviso,falha,
 dataBR,selecionar,selectOpcoes,carregarDocerias,docerias,pode};}
async function carregarPagina(){
  container('<p>Carregando informações...</p>');
  if(!podePagina(pagina)){
    container(cartao('Acesso negado','Seu cargo ou sua conta não possui permissão para esta aba.'));return;
  }
  if(pagina==='empresas'||pagina==='docerias')return window.Salamandras12.empresas(contexto12());
  if(pagina==='permissoes'){window.location.replace('usuarios.html#cargos');return;}
  if(pagina==='usuarios')return window.Salamandras13.usuarios(contexto12());
  if(pagina==='redes')return carregarRedes();
  if(requerDoceria())return;
  if(pagina==='painel'){await window.Salamandras12.painel(contexto12());
    if(window.Salamandras13C)await window.Salamandras13C.avisosPainel(contexto12());return;}
  if(pagina==='estoque')return window.Salamandras12.estoque(contexto12());
  if(pagina==='estoque-ingredientes')return carregarEstoque();
  if(pagina.startsWith('estoque-'))return window.Salamandras12.estoqueInterno(pagina,contexto12());
  if(pagina==='solicitacoes')return window.Salamandras13C.solicitacoes(contexto12());
  if(pagina==='financeiro')return window.Salamandras12.financeiro(contexto12());
  if(pagina==='rh')return window.Salamandras13.rh(contexto12());
  if(pagina==='registro-ponto')return window.Salamandras13.ponto(contexto12());
  if(pagina==='loja-modelos')return window.Salamandras12.loja(contexto12());
  if(pagina==='produtos')return carregarProdutos();
  if(pagina==='pedidos')return carregarPedidos();
  if(pagina==='cancelados'){window.location.replace('pedidos.html#cancelados');return;}
  if(pagina==='clientes')return carregarClientes();
  if(pagina==='producao')return carregarProducao();
  if(pagina==='produtos-prontos'||pagina==='vitrine')return carregarVitrine();
  if(pagina==='agenda')return carregarAgenda();
  if(pagina==='relatorios')return carregarRelatorios();
}

async function carregarPainel(){
  if(requerDoceria()) return;
  const blocos=[
    ['Produtos cadastrados','produtos','produtos'],
    ['Pedidos','pedidos','pedidos'],
    ['Produções','ordens_producao','producao']
  ];
  const cards=[];
  for(const [titulo,tabelaNome,destinoBase] of blocos){
    if(!podePagina(destinoBase)) continue;
    const destino=destinoBase+'.html';
    let consulta=db.from(tabelaNome).select('id',{head:true,count:'exact'}).eq('doceria_id',tenant);
    if(tabelaNome==='produtos')consulta=consulta.is('excluido_em',null);
    const {count,error}=await consulta;
    if(!error) cards.push(`<a class="card" href="${destino}"><h2>${esc(titulo)}</h2><div class="resumo">${count||0}</div><div class="muted">Abrir módulo</div></a>`);
  }
  const cardTexto=cards.length?cards.join(''):cartao('Bem-vindo','Abra um módulo no menu para começar.');
  let resumoVendas='';
  let notificacoes='';
  let alertasEstoque='';
  let historicoResponsaveis='';
  let cancelamentosPainel='';

  if(pode('adm')){
    // O faturamento considera só pedidos ENTREGUES. Não representa Pix confirmado.
    const anoAtual=new Date().getFullYear();
    const [resumo, avisos, clientes, vendasAno, vendasProdutos, alertas, logOperacoes, cancelamentosAno]=await Promise.all([
      rpc('api_resumo_vendas',{p_doceria:tenant}),
      selecionar('notificacoes_cortesia'),
      selecionar('clientes','id,nome'),
      rpc('api_relatorio_vendas',{p_doceria:tenant,p_ano:anoAtual}),
      rpc('api_vendas_produtos_mensais',{p_doceria:tenant,p_ano:anoAtual}),
      rpc('api_alertas_estoque',{p_doceria:tenant}),
      rpc('api_historico_operacoes',{p_doceria:tenant,p_limite:20}),
      rpc('api_relatorio_cancelamentos',{p_doceria:tenant,p_ano:anoAtual})
    ]);
    if(Array.isArray(alertas)&&alertas.length){
      alertasEstoque=cartao(`⚠️ Ingredientes com estoque baixo (${alertas.length})`,
        `<p class="muted">Reponha os ingredientes ou altere o estoque mínimo em Estoque.</p>${tabela(
          ['Ingrediente','Estoque atual','Avisar até'],
          alertas.map(a=>`<tr><td>${esc(a.nome)}</td><td><strong>${a.quantidade} ${esc(a.unidade)}</strong></td><td>${a.estoque_minimo} ${esc(a.unidade)}</td></tr>`).join(''))}
          <p><a href="estoque.html">Abrir estoque de ingredientes →</a></p>`);
    }
    resumoVendas=`<div class="grid">
      <section class="card card-vendas-com-grafico">
        <div><h2>Vendas entregues</h2>
          <div class="resumo">${reais(resumo.faturamento_entregue)}</div>
          <p class="muted">Acumulado de pedidos entregues. Não é confirmação de Pix.</p>
        </div>
        ${graficoVendas(vendasAno,`Vendas mensais de ${anoAtual}`,vendasProdutos)}
      </section>
      <section class="card"><h2>Pedidos entregues</h2>
        <div class="resumo">${Number(resumo.pedidos_entregues||0)}</div></section>
      <a class="card" href="clientes.html"><h2>Clientes cadastrados</h2>
        <div class="resumo">${Number(resumo.clientes_cadastrados||0)}</div></a>
    </div>`;

    historicoResponsaveis=tabelaHistoricoOperacoes(logOperacoes);
    cancelamentosPainel=graficoCancelamentos(cancelamentosAno);
    const pendentes=avisos.filter(a=>!a.lida_em)
      .sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const nomes=new Map(clientes.map(c=>[c.id,c.nome]));
    const linhas=pendentes.map(n=>{
      const quantidade=Number(n.quantidade_bolos);
      const descricao=quantidade===1?'1 bolo de fubá':`${quantidade} bolos de fubá`;
      return `<tr><td>${dataBR(n.created_at)}</td>
          <td>${esc(nomes.get(n.cliente_id)||'Cliente')}</td>
          <td><strong>Este cliente acumulou ${reais(n.total_acumulado)} em compras. Dê ${esc(descricao)} como cortesia.</strong></td>
          <td><button type="button" class="small sec" data-cortesia-lida="${esc(n.id)}">Marcar como lida</button></td></tr>`;
    }).join('');
    notificacoes=cartao(`🔔 Notificações de cortesia (${pendentes.length})`,
      `<p class="muted">A cada R$ 350 em compras entregues, aparece um aviso. A cortesia não entra automaticamente no pedido ou estoque.</p>
       ${tabela(['Quando','Cliente','Aviso','Ação'],linhas)}`);
  }

  container(`<div class="card"><h2>${esc(nomeDoceria(tenant))}</h2><p>Sua conta está aprovada como <strong>${esc(nomeCargo[perfil.cargo])}</strong>. As operações são autorizadas novamente no banco de dados.</p></div>
    ${resumoVendas}${alertasEstoque}${notificacoes}${cancelamentosPainel}<div class="grid">${cardTexto}</div>${historicoResponsaveis}`);
  ativarGraficos($('conteudo'));
  document.querySelectorAll('[data-cortesia-lida]').forEach(btn=>btn.addEventListener('click',async()=>{
    try{
      const resposta=await rpc('api_marcar_cortesia_lida',{p_notificacao:btn.dataset.cortesiaLida});
      aviso(resposta);
      await carregarPainel();
    }catch(err){falha(err);}
  }));
}

// Fotos: somente JPG, PNG ou WebP de até 5 MB, isoladas por doceria.
const BUCKET_FOTOS = 'salamandras-publico';
const FOTO_REGEXP = /^[0-9a-f-]{36}\/(produtos|capa|local)\/[a-zA-Z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/;
function fotoPublica(caminho){
  if(!caminho)return '';
  if(FOTO_REGEXP.test(caminho)) return db.storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl;
  try {const u=new URL(caminho);return u.protocol==='https:'?u.href:'';} catch {return '';}
}
function htmlFoto(caminho, classe='foto-mini'){
  const url=fotoPublica(caminho);
  return url?`<img class="${esc(classe)}" src="${esc(url)}" alt="Foto cadastrada" loading="lazy">`:'<span class="muted">Sem foto</span>';
}
function fotoEscolhida(el){
  return el.elements.foto_camera?.files?.[0] || el.elements.foto?.files?.[0] || null;
}
async function enviarFoto(arquivo,pasta){
  if(!arquivo || !arquivo.size) return null;
  const extensoes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  const extensao=extensoes[arquivo.type];
  if(!extensao) throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  if(arquivo.size>5*1024*1024) throw new Error('Foto muito grande. Limite: 5 MB.');
  const caminho=`${tenant}/${pasta}/${crypto.randomUUID()}.${extensao}`;
  const {error}=await db.storage.from(BUCKET_FOTOS).upload(caminho,arquivo,{contentType:arquivo.type,upsert:false});
  if(error)throw new Error('Envio de foto: '+error.message);
  return caminho;
}
async function limparFotoAntiga(caminhoNovo,caminhoAntigo){
  if(!FOTO_REGEXP.test(caminhoAntigo||'') || caminhoNovo===caminhoAntigo || !caminhoAntigo.startsWith(tenant+'/'))return;
  const {error}=await db.storage.from(BUCKET_FOTOS).remove([caminhoAntigo]);
  if(error)console.warn('Foto antiga pode permanecer no Storage:',error.message);
}
function campoForm(nome,rotulo,tipo='text',valor='',extra=''){
  return `<div><label>${esc(rotulo)}</label><input name="${esc(nome)}" type="${esc(tipo)}" value="${esc(valor)}" ${extra}></div>`;
}
function seletorAtivo(nome,ativo){return `<select name="${nome}"><option value="true" ${ativo?'selected':''}>Ativo</option><option value="false" ${!ativo?'selected':''}>Arquivado/Inativo</option></select>`;}

// Redes sociais da doceria: uma loja não pode editar os links de outra.
async function carregarRedes(){
  if(requerDoceria()) return;
  const rede = await rpc('api_ler_redes_doceria',{p_doceria:tenant});
  if(!rede) throw new Error('Doceria não encontrada.');
  const configVisual=await rpc('api_config_site',{p_doceria:tenant});
  const linkPublico = rede.site_publicado && rede.slug
    ? 'loja.html?loja='+encodeURIComponent(rede.slug)
    : '';
  container(cartao('Instagram e WhatsApp da doceria',`
    <p class="muted">Cada loja configura seus próprios contatos. Ao salvar, o site público usa os novos dados automaticamente, sem novo deploy.</p>
    <form id="form-redes">
      <div class="formgrid">
        <div>
          <label for="rede-whatsapp">WhatsApp comercial</label>
          <input id="rede-whatsapp" name="whatsapp" type="tel" inputmode="tel"
            placeholder="(11) 96612-8275" value="${esc(rede.whatsapp||'')}" maxlength="32">
          <p class="muted">Pode informar com DDD; o sistema acrescenta +55 automaticamente.</p>
        </div>
        <div>
          <label for="rede-instagram">Instagram</label>
          <input id="rede-instagram" name="instagram" type="text"
            placeholder="@sua_doceria ou https://instagram.com/sua_doceria"
            value="${esc(rede.instagram||'')}" maxlength="128">
        </div>
      </div>
      <p><button type="submit">Salvar contatos</button></p>
    </form>
    <p class="muted">Apagar um campo e salvar remove o respectivo botão do site público.</p>
    <form id="form-cor-site" class="formgrid">
      <div><label>Cor predominante do site</label>
        <select name="cor">
          ${[['#e7436d','Rosa'],['#773dc8','Roxo'],['#007b76','Verde'],['#e07721','Laranja'],['#2162a6','Azul'],['#c13d4a','Vermelho'],['#374151','Cinza escuro']].map(([hex,rotulo])=>`<option value="${hex}" ${configVisual?.cor_site===hex?'selected':''}>${rotulo}</option>`).join('')}
        </select></div>
      <div><label>Prévia</label><div id="cor-site-previa" class="amostra-cor" style="background:${esc(configVisual?.cor_site||'#e7436d')}">Cor da loja</div></div>
      <div><button type="submit">Salvar cor do site</button></div>
    </form>
    ${linkPublico
      ? `<p><a href="${esc(linkPublico)}" target="_blank" rel="noopener noreferrer">Abrir site público desta doceria ↗</a></p>`
      : `<p class="muted">A página ainda não foi publicada. Peça ao DEV para configurar o endereço da loja no módulo Empresas.</p>`}
  `) + cartao('Imagem de capa do site público',`
    <p class="muted">ADM e DEV podem trocar a fotografia principal da loja. Aparece automaticamente no site após atualizar a página.</p>
    <div style="margin:12px 0">
      ${configVisual?.imagem_capa_url
        ? `<img src="${esc(fotoPublica(configVisual.imagem_capa_url))}" alt="Capa atual"
            style="max-width:390px;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px">`
        : '<span class="muted">Nenhuma foto cadastrada; o site mostra a imagem padrão.</span>'}
    </div>
    <form id="form-capa-site">
      <div class="formgrid">
        <div><label>Escolher imagem de capa (JPG, PNG ou WebP, até 5 MB)</label>
          <input name="capa" type="file" accept="image/jpeg,image/png,image/webp">
        </div>
        <div><label>Ou tirar uma foto com o celular</label>
          <input name="capa_camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment">
        </div>
      </div>
      <p><label><input type="checkbox" name="remover_capa" class="check-inline"> Remover capa personalizada e voltar à imagem padrão</label></p>
      <button type="submit">Salvar imagem da capa</button>
    </form>
  `));
  on('form-cor-site','change',()=>{ $('cor-site-previa').style.background=$('form-cor-site').elements.cor.value; });
  form('form-cor-site',async el=>{
    aviso(await rpc('api_atualizar_cor_site',{p_doceria:tenant,p_cor:el.elements.cor.value}));
    await carregarRedes();
  });
  form('form-redes',async el=>{
    const dados=await rpc('api_salvar_redes_doceria',{
      p_doceria:tenant,
      p_whatsapp:el.elements.whatsapp.value,
      p_instagram:el.elements.instagram.value
    });
    aviso('WhatsApp e Instagram salvos! Reabra o site público para conferir.');
    await carregarRedes();
  });
  form('form-capa-site',async el=>{
    const arquivo=el.elements.capa_camera?.files?.[0] || el.elements.capa?.files?.[0] || null;
    const remover=Boolean(el.elements.remover_capa.checked);
    if(arquivo && remover)throw new Error('Escolha uma foto ou marque remover; não faça os dois.');
    if(!arquivo && !remover)throw new Error('Escolha uma imagem para enviar ou marque remover.');
    const anterior=configVisual?.imagem_capa_url||null;
    const novoArquivo=await enviarFoto(arquivo,'capa');
    const novoCaminho=remover?null:novoArquivo;
    try{
      aviso(await rpc('api_salvar_capa_loja',{p_doceria:tenant,p_caminho:novoCaminho}));
      await limparFotoAntiga(novoCaminho,anterior);
      await carregarRedes();
    }catch(err){
      if(novoArquivo)await limparFotoAntiga(null,novoArquivo);
      throw err;
    }
  });
}

async function carregarDocerias(){
  const criar=perfil.cargo==='dev'?cartao('Cadastrar empresa',`
    <form id="nova-doceria" class="formgrid">
      <div><label>Nome</label><input name="nome" required minlength="2"></div>
      <button type="submit">Cadastrar empresa</button>
    </form>`):'';
  const linhas=docerias.map(d=>`<tr><td>${esc(d.nome)}</td><td>${d.codigo_convite?`<code>${esc(d.codigo_convite)}</code>`:'—'}</td></tr>`).join('');
  let configuracao=''; let d=null;
  if(tenant&&pode('adm')){
    d=await rpc('api_config_doceria',{p_doceria:tenant});
    if(d)configuracao=cartao('Editar empresa e imagens',`
      <p class="muted">A foto de capa e a foto do local aparecerão na loja virtual da empresa.</p>
      <form id="form-doceria">
        <div class="formgrid">
          ${campoForm('nome','Nome da empresa','text',d.nome,'required minlength="2"')}
          ${campoForm('slug','Endereço público (slug)','text',d.slug||'','placeholder="doceria-teste"')}
          ${campoForm('whatsapp','WhatsApp com DDI (ex.: 5511999999999)','tel',d.whatsapp_site||'')}
          ${campoForm('instagram','Instagram (URL https://...)','url',d.instagram_site||'')}
          ${campoForm('endereco','Endereço público','text',d.endereco_site||'')}
          ${campoForm('horario','Horário de atendimento','text',d.horario_site||'')}
          <div><label>Site público</label><select name="publicado">
            <option value="true" ${d.site_publicado?'selected':''}>Publicado</option>
            <option value="false" ${!d.site_publicado?'selected':''}>Oculto</option>
          </select></div>
        </div>
        <p><label>Descrição da empresa</label><textarea name="descricao" rows="3">${esc(d.descricao_site||'')}</textarea></p>
        <div class="formgrid">
          <div><label>Foto de capa (até 5 MB)</label>${htmlFoto(d.imagem_capa_url)}<input type="file" name="capa" accept="image/jpeg,image/png,image/webp"><label><input type="checkbox" name="remover_capa" class="check-inline"> Remover foto</label></div>
          <div><label>Foto do estabelecimento</label>${htmlFoto(d.imagem_local_url)}<input type="file" name="local" accept="image/jpeg,image/png,image/webp"><label><input type="checkbox" name="remover_local" class="check-inline"> Remover foto</label></div>
        </div>
        <p><button type="submit">Salvar dados da empresa</button></p>
      </form>
      ${d.slug?`<p><a href="loja.html?loja=${esc(d.slug)}" target="_blank" rel="noopener">Visualizar site público</a></p>`:''}
    `);
  }
  container(criar+configuracao+cartao('Empresas e códigos de convite',tabela(['Empresa','Código'],linhas)));
  form('nova-doceria',async el=>{
    await rpc('api_criar_doceria',{p_nome:el.elements.nome.value});
    docerias=await rpc('api_docerias');aviso('Empresa criada. Atualize a página para selecioná-la.');
    await carregarDocerias();
  });
  form('form-doceria',async el=>{
    const anteriorCapa=d.imagem_capa_url,anteriorLocal=d.imagem_local_url;
    let capa=el.elements.remover_capa.checked?null:anteriorCapa;
    let local=el.elements.remover_local.checked?null:anteriorLocal;
    const enviadoCapa=await enviarFoto(el.elements.capa.files[0],'capa');
    const enviadoLocal=await enviarFoto(el.elements.local.files[0],'local');
    if(enviadoCapa)capa=enviadoCapa;
    if(enviadoLocal)local=enviadoLocal;
    try{
      aviso(await rpc('api_editar_doceria',{
        p_doceria:tenant,p_nome:el.elements.nome.value,p_slug:el.elements.slug.value,
        p_publicado:el.elements.publicado.value==='true',p_whatsapp:el.elements.whatsapp.value,
        p_instagram:el.elements.instagram.value,p_descricao:el.elements.descricao.value,
        p_endereco:el.elements.endereco.value,p_horario:el.elements.horario.value,
        p_capa:capa,p_local:local
      }));
      await Promise.all([limparFotoAntiga(capa,anteriorCapa),limparFotoAntiga(local,anteriorLocal)]);
      docerias=await rpc('api_docerias');
      await carregarDocerias();
    }catch(e){
      if(enviadoCapa)await limparFotoAntiga(null,enviadoCapa);
      if(enviadoLocal)await limparFotoAntiga(null,enviadoLocal);
      throw e;
    }
  });
}

// Usuarios e cargos foram migrados para rh13.js.
// O ADM controla os cargos da sua empresa; DEV nao e um funcionario.

async function carregarEstoque(){return carregarCadastros('estoque');}
async function carregarProdutos(){return carregarCadastros('produtos');}
async function carregarCadastros(modo){
  const produtosPagina=modo==='produtos';
  // Consulta única no backend: a autorização do módulo é checada no banco.
  // Evita a tela quebrar por consultas isoladas sujeitas a políticas RLS distintas.
  const catalogo = await rpc('api_catalogo_erp', {
    p_doceria: tenant, p_modulo: modo
  });
  const produtos = Array.isArray(catalogo?.produtos) ? catalogo.produtos : [];
  const ingredientes = Array.isArray(catalogo?.ingredientes) ? catalogo.ingredientes : [];
  const receitas = Array.isArray(catalogo?.receitas) ? catalogo.receitas : [];
  const produtosVisiveis=produtos.filter(p=>!p.excluido_em);
  const ingredientesVisiveis=ingredientes.filter(i=>!i.excluido_em);
  const permiteIngredientes = pode('adm','logistica','confeiteiro');
  const podeAjustar = pode('adm','logistica');

  // Quantidades da receita são sempre para 1 unidade do produto.
  const disponiveis=ingredientesVisiveis.filter(i=>i.ativo!==false).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const camposReceita=disponiveis.length
    ? `<details class="receita-detalhes" id="receita-expandir">
         <summary>Selecionar ingredientes da receita (${disponiveis.length}) ▾</summary>
         <div class="campo-busca"><label>Pesquisar ingrediente</label>
           <input type="search" id="buscar-ingrediente-receita" placeholder="Digite o nome do ingrediente..."></div>
         <div class="receita-lista">${disponiveis.map(i=>`
           <div class="receita-item" data-receita-nome="${esc(i.nome.toLocaleLowerCase('pt-BR'))}">
             <label for="receita-${esc(i.id)}">${esc(i.nome)} (${esc(i.unidade)}) por unidade</label>
             <input id="receita-${esc(i.id)}" data-ingrediente-receita="${esc(i.id)}"
               type="number" min="0" step="0.001" placeholder="Quantidade">
           </div>`).join('')}</div>
       </details>`
    : '<p class="muted">Cadastre ingredientes primeiro na aba Estoque.</p>';

  const criarProduto = pode('adm') ? cartao('Cadastrar produto com sua receita', `
    <p class="muted">Para cada unidade do produto, informe quanto de cada ingrediente será utilizado.</p>
    <form id="novo-produto">
      <div class="formgrid">
        <div><label>Nome do produto</label><input name="nome" required minlength="2"></div>
        <div><label>Preço de venda (R$)</label>
          <input name="preco" type="number" min="0" step="0.01" required></div>
      </div>
      <div class="formgrid">
        <div><label>Categoria</label><input name="categoria" placeholder="Bolos"></div>
        <div><label>Selecionar foto da galeria</label><input name="foto" type="file" accept="image/jpeg,image/png,image/webp">
          <label class="rotulo-extra">Ou tirar foto agora (celular)</label><input name="foto_camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></div>
      </div>
      <p><label>Descrição para o cliente (site público)</label>
        <textarea name="descricao" rows="3" placeholder="Uma cremosidade intensa, feito com Leite Moça de verdade."></textarea></p>
      <p><label>Peso ou tamanho para o cliente</label>
        <input name="peso_tamanho" type="text" maxlength="80" placeholder="Ex.: 1,2 kg, 500 ml ou 6 unidades">
        <small class="muted">Informação pública, não altera o consumo de ingredientes da receita.</small></p>
      <h3>Ficha técnica — ingredientes para produzir 1 unidade</h3>
      ${camposReceita}
      <p><button type="submit" ${ingredientesVisiveis.some(i=>i.ativo!==false) ? '' : 'disabled'}>Cadastrar produto e salvar receita</button></p>
    </form>`) : '';

  const criarIngrediente = podeAjustar ? cartao('1. Cadastrar ingredientes', `
    <form id="novo-ingrediente" class="formgrid">
      <div><label>Nome do ingrediente</label><input name="nome" required minlength="2"></div>
      <div><label>Unidade de medida</label><select name="unidade">
        <option value="un">Unidades (un)</option><option value="g">Gramas (g)</option>
        <option value="kg">Quilos (kg)</option><option value="ml">Mililitros (ml)</option>
        <option value="l">Litros (l)</option></select></div>
      ${pode('adm')?`<div><label>Avisar quando chegar a</label><input name="estoque_minimo" type="number" min="0" step="0.001" value="0" required>
        <small class="muted">0 desativa o alerta.</small></div>`:''}
      <button type="submit">Cadastrar ingrediente</button>
    </form>`) : '';

  const pLinhas = produtosVisiveis.map(p => {
    const descricao = receitas.filter(r => r.produto_id === p.id).map(r => {
      const ing = ingredientes.find(i => i.id === r.ingrediente_id);
      return ing ? `${r.quantidade} ${ing.unidade} de ${ing.nome}` : 'Ingrediente indisponível';
    }).join(', ') || 'Receita não cadastrada';
    return `<tr data-cadastro-nome="${esc(p.nome.toLocaleLowerCase('pt-BR'))}"><td>${htmlFoto(p.imagem_url)}</td><td>${esc(p.nome)} ${p.peso_tamanho?`<small class="muted">(${esc(p.peso_tamanho)})</small>`:''} ${!p.ativo?'<span class="tag">Arquivado</span>':''}</td><td>${reais(p.preco)}</td>
      <td>${esc(descricao)}</td><td>${p.estoque}</td><td>${p.reservado}</td>
      <td><strong>${p.estoque-p.reservado}</strong></td>
      <td><div class="acoes">${podeAjustar?`<button class="small sec" data-ajuste="produto" data-item="${esc(p.id)}" data-nome="${esc(p.nome)}">Movimentar</button>`:''}
       ${pode('adm')?`<button class="small sec" data-editar-item="produto" data-id="${p.id}">Alterar</button>
         <button class="small sec" data-arquivar-item="produto" data-id="${p.id}" data-arquivar="${p.ativo}">${p.ativo?'Arquivar':'Reativar'}</button>
         <button class="small danger" data-excluir-item="produto" data-id="${p.id}">Excluir</button>`:''}</div></td></tr>`;
  }).join('');
  const iLinhas = ingredientesVisiveis.map(i => `<tr data-cadastro-nome="${esc(i.nome.toLocaleLowerCase('pt-BR'))}"><td>${esc(i.nome)} ${i.ativo===false?'(arquivado)':''}</td><td>${i.quantidade} ${esc(i.unidade)}</td><td>${Number(i.estoque_minimo||0)>0?`${i.estoque_minimo} ${esc(i.unidade)}`:'Desativado'}</td><td>${i.ativo!==false&&Number(i.estoque_minimo||0)>0&&Number(i.quantidade)<=Number(i.estoque_minimo)?'<strong class="estoque-baixo">⚠️ Baixo</strong>':'—'}</td>
    <td><div class="acoes">${podeAjustar?`<button class="small sec" data-ajuste="ingrediente" data-item="${esc(i.id)}" data-nome="${esc(i.nome)}">Movimentar</button>`:''}
      ${pode('adm')?`<button class="small sec" data-editar-item="ingrediente" data-id="${i.id}">Alterar</button>
        <button class="small sec" data-arquivar-item="ingrediente" data-id="${i.id}" data-arquivar="${i.ativo!==false}">${i.ativo!==false?'Arquivar':'Reativar'}</button>
        <button class="small danger" data-excluir-item="ingrediente" data-id="${i.id}">Excluir</button>`:''}</div></td></tr>`).join('');

  const editor = pode('adm') ? (produtosPagina ?
    cartao('Editar / remover produto',`
      <form id="editor-produto">
        <div class="formgrid">
          <div><label>Escolha o produto</label><select name="id" id="editor-produto-id">${selectOpcoes(produtosVisiveis,p=>p.id,p=>p.nome)}</select></div>
          <div><label>Nome</label><input name="nome" required minlength="2"></div>
          <div><label>Preço (R$)</label><input name="preco" type="number" min="0" step="0.01" required></div>
          <div><label>Categoria</label><input name="categoria"></div>
          <div><label>Situação</label><select name="ativo"><option value="true">Ativo no cardápio</option><option value="false">Arquivado</option></select></div>
        </div>
        <p><label>Descrição para o site público</label>
          <textarea name="descricao" rows="3" placeholder="O que o cliente vai ler no cardápio"></textarea></p>
        <p><label>Peso ou tamanho para o cliente</label>
          <input name="peso_tamanho" type="text" maxlength="80" placeholder="Ex.: 1,2 kg, 500 ml ou 6 unidades"></p>
        <div class="formgrid">
          <div><label>Imagem atual</label><div id="foto-produto-atual"></div></div>
          <div><label>Nova foto da galeria</label><input name="foto" type="file" accept="image/jpeg,image/png,image/webp">
            <label class="rotulo-extra">Ou tirar foto agora (celular)</label><input name="foto_camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment">
            <label><input class="check-inline" name="remover_foto" type="checkbox"> Remover foto</label></div>
        </div>
        <p class="acoes"><button type="submit" ${produtosVisiveis.length?'':'disabled'}>Salvar alterações</button>
          <button type="button" id="remover-produto" class="danger" ${produtosVisiveis.length?'':'disabled'}>Excluir produto</button></p>
      </form>`) :
    cartao('Editar / remover ingrediente',`
      <form id="editor-ingrediente">
        <div class="formgrid">
          <div><label>Ingrediente</label><select name="id" id="editor-ingrediente-id">${selectOpcoes(ingredientesVisiveis,i=>i.id,i=>i.nome)}</select></div>
          <div><label>Nome</label><input name="nome" required minlength="2"></div>
          <div><label>Unidade</label><select name="unidade">${['un','g','kg','ml','l'].map(u=>`<option value="${u}">${u}</option>`).join('')}</select></div>
          <div><label>Situação</label><select name="ativo"><option value="true">Ativo</option><option value="false">Arquivado</option></select></div>
          <div><label>Alerta: estoque mínimo</label><input name="estoque_minimo" type="number" min="0" step="0.001" required></div>
        </div>
        <p class="acoes"><button type="submit" ${ingredientesVisiveis.length?'':'disabled'}>Salvar alterações</button>
          <button type="button" class="danger" id="remover-ingrediente" ${ingredientesVisiveis.length?'':'disabled'}>Excluir ingrediente</button></p>
      </form>`)
  ) : '';

  const movimentacoes = permiteIngredientes ? await rpc('api_movimentacoes_resumo',{
    p_doceria:tenant,p_tipo:produtosPagina?'produto':'ingrediente'
  }) : [];
  const movLinhas = (Array.isArray(movimentacoes)?movimentacoes:[]).map(m => `<tr>
    <td>${dataBR(m.created_at)}</td><td>${esc(m.item_tipo)}</td>
    <td>${m.variacao>0?'+':''}${m.variacao}</td>
    <td>${m.saldo_anterior} → ${m.saldo_posterior}</td><td>${esc(m.motivo)}</td>
    ${pode('adm')?`<td>${esc(m.autor_nome||'Nao registrado')}</td>`:''}</tr>`).join('');

  const produtoTabela=cartao('Produtos prontos e fichas técnicas',tabela(
    ['Foto','Produto','Preço','Receita por unidade','Físico','Reservado','Disponível','Ação'],pLinhas));
  const estoqueTabela=cartao('Ingredientes em estoque',tabela(
    ['Ingrediente','Saldo','Alerta até','Situação','Ação'],iLinhas));
  // movLinhas ja e uma string HTML criada com .join(''); nao usar .filter() nela.
  const historico=tabela(['Quando','Tipo','Variação','Antes → Depois','Motivo',...(pode('adm')?['Responsável']:[])],movLinhas);
  const busca=cartao(produtosPagina?'Pesquisar produtos':'Pesquisar ingredientes',
    `<label>Pesquisar pelo nome</label><input id="buscar-cadastros" type="search"
     placeholder="Digite para filtrar os registros..." autocomplete="off">
     <small class="muted">Itens arquivados continuam listados. Os excluídos não aparecem.</small>`);
  container(produtosPagina
    ? criarProduto + busca + produtoTabela + editor + cartao('Últimas movimentações de produtos',historico)
    : criarIngrediente + busca + estoqueTabela + editor + cartao('Últimas movimentações',historico));
  on('buscar-cadastros','input',()=>{
    const termo=$('buscar-cadastros').value.trim().toLocaleLowerCase('pt-BR');
    document.querySelectorAll('[data-cadastro-nome]').forEach(linha=>{
      linha.hidden=!linha.dataset.cadastroNome.includes(termo);
    });
  });
  document.querySelectorAll('[data-editar-item]').forEach(botao=>botao.addEventListener('click',()=>{
    const alvo=botao.dataset.editarItem==='produto'?'editor-produto-id':'editor-ingrediente-id';
    const el=$(alvo);if(!el)return;
    el.value=botao.dataset.id;el.dispatchEvent(new Event('change'));
    el.scrollIntoView({behavior:'smooth',block:'center'});
  }));
  document.querySelectorAll('[data-arquivar-item]').forEach(botao=>botao.addEventListener('click',async()=>{
    const arquivar=botao.dataset.arquivar==='true';
    if(!confirm(arquivar?'Arquivar? Vai sair do site, mas continua no ERP.':'Reativar este cadastro?'))return;
    try{
      const fn=botao.dataset.arquivarItem==='produto'?'api_arquivar_produto':'api_arquivar_ingrediente';
      aviso(await rpc(fn,{p_id:botao.dataset.id,p_arquivar:arquivar}));
      await carregarCadastros(modo);
    }catch(e){falha(e);}
  }));
  document.querySelectorAll('[data-excluir-item]').forEach(botao=>botao.addEventListener('click',async()=>{
    const tipo=botao.dataset.excluirItem;
    const msg=tipo==='ingrediente'
      ?'Excluir do ERP? Os produtos que usam este ingrediente serão arquivados. Histórico preservado.'
      :'Excluir definitivamente das listas e do site? O histórico antigo continuará no banco para auditoria.';
    if(!confirm(msg))return;
    try{
      aviso(await rpc(tipo==='produto'?'api_excluir_produto':'api_excluir_ingrediente',{p_id:botao.dataset.id}));
      await carregarCadastros(modo);
    }catch(e){falha(e);}
  }));
  on('buscar-ingrediente-receita','input',()=>{
    const termo=$('buscar-ingrediente-receita').value.trim().toLocaleLowerCase('pt-BR');
    document.querySelectorAll('[data-receita-nome]').forEach(el=>{
      el.hidden=!el.dataset.receitaNome.includes(termo);
    });
  });


  form('novo-produto', async el => {
    const p_ingredientes = [...el.querySelectorAll('[data-ingrediente-receita]')]
      .filter(input => input.value.trim() !== '')
      .map(input => ({
        ingrediente_id: input.dataset.ingredienteReceita,
        quantidade: Number(input.value)
      }));
    if (!p_ingredientes.length) {
      throw new Error('Informe a quantidade de pelo menos um ingrediente para a receita.');
    }
    if (p_ingredientes.some(i => !Number.isFinite(i.quantidade) || i.quantidade <= 0)) {
      throw new Error('As quantidades escolhidas devem ser maiores que zero.');
    }
    const id=await rpc('api_criar_produto_com_receita', {
      p_doceria: tenant,
      p_nome: el.elements.nome.value,
      p_preco: Number(el.elements.preco.value),
      p_ingredientes
    });
    try {
      const foto=await enviarFoto(fotoEscolhida(el),'produtos');
      await rpc('api_editar_produto_publicacao', {
        p_produto:id,p_nome:el.elements.nome.value,p_preco:Number(el.elements.preco.value),
        p_descricao:el.elements.descricao.value,p_categoria:el.elements.categoria.value,
        p_ativo:true,p_imagem_caminho:foto,
        p_peso_tamanho:el.elements.peso_tamanho.value
      });
      aviso('Produto cadastrado com sua receita e foto.');
    } catch(e) {aviso('Produto criado, mas a foto/detalhes não foram concluídos: '+e.message,true);}
    await carregarCadastros(modo);
  });

  form('novo-ingrediente', async el => {
    const id=await rpc('api_criar_ingrediente', {
      p_doceria: tenant,
      p_nome: el.elements.nome.value,
      p_unidade: el.elements.unidade.value
    });
    if(pode('adm')){
      await rpc('api_definir_estoque_minimo',{
        p_ingrediente:id,p_minimo:Number(el.elements.estoque_minimo.value)
      });
    }
    aviso('Ingrediente cadastrado.');
    await carregarCadastros(modo);
  });

  document.querySelectorAll('[data-ajuste]').forEach(btn => btn.addEventListener('click',async () => {
    const texto = prompt(`Movimentar: ${btn.dataset.nome}\nInforme +10 para entrada ou -2 para saída.`);
    if (texto === null) return;
    const variacao = Number(texto.replace(',','.'));
    if (!Number.isFinite(variacao) || variacao === 0) {
      aviso('Quantidade inválida.',true); return;
    }
    const motivo = prompt('Motivo da movimentação (ex.: compra, contagem, perda):');
    if (motivo === null) return;
    try {
      const resposta = await rpc('api_ajustar_estoque', {
        p_tipo: btn.dataset.ajuste,
        p_id: btn.dataset.item,
        p_variacao: variacao,
        p_motivo: motivo
      });
      aviso(resposta);
      await carregarCadastros(modo);
    } catch (err) { falha(err); }
  }));

  if(pode('adm')){
    const formProd=$('editor-produto'),formIng=$('editor-ingrediente');
    if(formProd){
    const preencherProduto=()=>{
      const p=produtosVisiveis.find(x=>x.id===formProd.elements.id.value);
      if(!p)return;
      formProd.elements.nome.value=p.nome;
      formProd.elements.preco.value=p.preco;
      formProd.elements.categoria.value=p.categoria||'';
      formProd.elements.descricao.value=p.descricao||'';
      formProd.elements.peso_tamanho.value=p.peso_tamanho||'';
      formProd.elements.ativo.value=String(p.ativo);
      formProd.elements.foto.value='';formProd.elements.remover_foto.checked=false;
      $('foto-produto-atual').innerHTML=htmlFoto(p.imagem_url);
    };
    on('editor-produto-id','change',preencherProduto);preencherProduto();
    form('editor-produto',async el=>{
      const p=produtos.find(x=>x.id===el.elements.id.value);
      if(!p)throw new Error('Selecione um produto.');
      const novoArquivo=await enviarFoto(fotoEscolhida(el),'produtos');
      const novoCaminho=novoArquivo||(el.elements.remover_foto.checked?null:p.imagem_url);
      try{
        aviso(await rpc('api_editar_produto_publicacao',{
          p_produto:p.id,p_nome:el.elements.nome.value,p_preco:Number(el.elements.preco.value),
          p_descricao:el.elements.descricao.value,p_categoria:el.elements.categoria.value,
          p_ativo:el.elements.ativo.value==='true',p_imagem_caminho:novoCaminho,
          p_peso_tamanho:el.elements.peso_tamanho.value
        }));
        await limparFotoAntiga(novoCaminho,p.imagem_url);
        await carregarCadastros(modo);
      }catch(err){if(novoArquivo)await limparFotoAntiga(null,novoArquivo);throw err;}
    });
    on('remover-produto','click',async()=>{
      const id=formProd.elements.id.value;if(!id)return;
      if(!confirm('EXCLUIR produto do ERP e do site? O histórico de vendas será preservado.'))return;
      try{aviso(await rpc('api_excluir_produto',{p_id:id}));await carregarCadastros(modo);}catch(e){falha(e);}
    });
    }
    if(formIng){
    const preencherIngrediente=()=>{
      const i=ingredientesVisiveis.find(x=>x.id===formIng.elements.id.value);
      if(!i)return;
      formIng.elements.nome.value=i.nome;
      formIng.elements.unidade.value=i.unidade;
      formIng.elements.ativo.value=String(i.ativo!==false);
      formIng.elements.estoque_minimo.value=i.estoque_minimo||0;
    };
    on('editor-ingrediente-id','change',preencherIngrediente);preencherIngrediente();
    form('editor-ingrediente',async el=>{
      await rpc('api_editar_ingrediente',{
        p_id:el.elements.id.value,p_nome:el.elements.nome.value,
        p_unidade:el.elements.unidade.value,p_ativo:el.elements.ativo.value==='true'
      });
      aviso(await rpc('api_definir_estoque_minimo',{
        p_ingrediente:el.elements.id.value,p_minimo:Number(el.elements.estoque_minimo.value)
      }));
      await carregarCadastros(modo);
    });
    on('remover-ingrediente','click',async()=>{
      const id=formIng.elements.id.value;if(!id)return;
      if(!confirm('EXCLUIR ingrediente? Produtos que dependem dele serão arquivados para impedir vendas com receita incompleta.'))return;
      try{aviso(await rpc('api_excluir_ingrediente',{p_id:id}));await carregarCadastros(modo);}catch(e){falha(e);}
    });
    }
  }
}

async function carregarClientes(){
  const podeCadastrar=pode('adm','atendente');
  const cadastro=podeCadastrar?cartao('Cadastrar cliente',`
    <form id="novo-cliente" class="formgrid">
      <div><label>Nome completo</label><input name="nome" required minlength="2"></div>
      <div><label>Telefone com DDD</label><input name="telefone" type="tel" required placeholder="11999998888"></div>
      <button type="submit">Cadastrar cliente</button>
    </form>`):'';
  container(cadastro+cartao('Pesquisar clientes',`
    <p class="muted">Pesquise pelo nome ou telefone. Mostramos até 80 resultados por consulta.</p>
    <label for="buscar-cliente">Nome ou número</label>
    <input id="buscar-cliente" type="search" placeholder="Digite o nome ou telefone">
    <div id="lista-clientes" class="tabela-area"><p>Carregando...</p></div>`)+
    cartao('Ficha do cliente',`<div id="ficha-cliente"><p class="muted">Selecione um cliente acima para consultar histórico, endereço e produtos favoritos.</p></div>`));
  let buscaSeq=0,buscaTimer=null;
  const buscar=async()=>{
    const seq=++buscaSeq;
    const lista=await rpc('api_buscar_clientes',{p_doceria:tenant,p_termo:$('buscar-cliente').value});
    if(seq!==buscaSeq)return;
    const linhas=lista.map(c=>`<tr>
      <td>${esc(c.nome)} ${!c.ativo?'(arquivado)':''}</td>
      <td>${esc(c.telefone)}</td>
      <td>${reais(c.total_gasto)}</td>
      <td><button class="small sec" data-ficha-cliente="${esc(c.id)}">Abrir ficha</button></td>
    </tr>`).join('');
    $('lista-clientes').innerHTML=tabela(['Cliente','Telefone','Total gasto','Ação'],linhas);
    document.querySelectorAll('[data-ficha-cliente]').forEach(b=>b.addEventListener('click',()=>{
      abrirFicha(b.dataset.fichaCliente).catch(falha);
    }));
  };
  on('buscar-cliente','input',()=>{
    clearTimeout(buscaTimer);
    buscaTimer=setTimeout(()=>buscar().catch(falha),300);
  });
  async function abrirFicha(id){
    const ficha=await rpc('api_ficha_cliente',{p_cliente:id});
    const c=ficha.cliente, favorites=ficha.favoritos||[],pedidos=ficha.pedidos||[];
    const editor=pode('adm')?`
      <form id="editar-cliente">
        <div class="formgrid">
          ${campoForm('nome','Nome','text',c.nome,'required minlength="2"')}
          ${campoForm('telefone','Telefone','tel',c.telefone,'required')}
          ${campoForm('endereco','Endereço','text',c.endereco||'')}
          <div><label>Situação</label>${seletorAtivo('ativo',c.ativo)}</div>
        </div>
        <p class="acoes"><button type="submit">Salvar cliente</button>
        <button class="danger" type="button" id="excluir-cliente">Excluir / arquivar</button></p>
      </form>`:'';
    $('ficha-cliente').innerHTML=`
      <h3>${esc(c.nome)} ${c.ativo?'':'(arquivado)'}</h3>
      <p><strong>Telefone:</strong> ${esc(c.telefone)}<br>
      <strong>Endereço:</strong> ${esc(c.endereco||'Não cadastrado')}<br>
      <strong>Compras entregues:</strong> ${reais(c.total_gasto)}<br>
      <strong>Notificações de bolo de fubá:</strong> ${Number(c.cortesias_avisadas)}<br>
      <strong>Progresso para próxima cortesia:</strong> ${reais(Number(c.total_gasto)%350)} / R$ 350,00</p>
      <h3>Produtos mais comprados (pedidos entregues)</h3>
      ${tabela(['Produto','Unidades'],favorites.map(f=>`<tr><td>${esc(f.produto)}</td><td>${Number(f.quantidade)}</td></tr>`).join(''))}
      <h3>Últimos pedidos</h3>
      ${tabela(['Data','Retirada','Status','Total'],pedidos.map(o=>`<tr>
        <td>${dataBR(o.data)}</td><td>${esc(o.data_agendada||'—')}</td>
        <td>${badge(o.status)}</td><td>${reais(o.total)}</td></tr>`).join(''))}
      ${editor}`;
    form('editar-cliente',async el=>{
      aviso(await rpc('api_editar_cliente',{
        p_id:id,p_nome:el.elements.nome.value,p_telefone:el.elements.telefone.value,
        p_endereco:el.elements.endereco.value,p_ativo:el.elements.ativo.value==='true'
      }));
      await buscar();await abrirFicha(id);
    });
    on('excluir-cliente','click',async()=>{
      if(!confirm('Excluir cliente sem histórico ou arquivar mantendo os pedidos antigos?'))return;
      try{aviso(await rpc('api_remover_cliente',{p_id:id}));
        $('ficha-cliente').innerHTML='<p>Cadastro removido ou arquivado.</p>';
        await buscar();
      }catch(e){falha(e);}
    });
  }
  form('novo-cliente',async el=>{
    await rpc('api_criar_cliente',{p_doceria:tenant,
      p_nome:el.elements.nome.value,p_telefone:el.elements.telefone.value});
    aviso('Cliente cadastrado.');el.reset();await buscar();
  });
  await buscar();
}

async function carregarPedidos(){
  const podeCriar=pode('adm','atendente');
  // Produtos prontos/confeiteiro podem consultar pedidos, mas não têm permissão
  // para acessar a lista de clientes. Não solicitar dados sem autorização.
  const [produtos,pedidos,itens,clientes]=await Promise.all([
    selecionar('produtos'),
    selecionar('pedidos'),
    selecionar('pedido_itens'),
    podeCriar ? selecionar('clientes','id,nome,telefone,ativo') : Promise.resolve([])
  ]);
  const criar=podeCriar?cartao('Novo pedido',`
    <p class="muted">Escolha um cliente cadastrado. Isso permite acumular corretamente os R$ 350 para avisos de cortesia.</p>
    <form id="novo-pedido"><div class="formgrid">
    <div><label>Cliente cadastrado</label>
      <select name="cliente_id" required><option value="">Selecione um cliente</option>
        ${selectOpcoes(clientes.filter(c=>c.ativo!==false),c=>c.id,c=>`${c.nome} · ${c.telefone}`)}</select>
      <p class="mini"><a href="clientes.html">Cadastrar cliente novo</a></p></div>
    <div><label>Produto</label><select id="produto-carrinho">${selectOpcoes(produtos.filter(p=>p.ativo && p.estoque>p.reservado),p=>p.id,p=>`${p.nome} · disponível ${p.estoque-p.reservado} · ${reais(p.preco)}`)}</select></div>
    <div><label>Quantidade</label><input id="qtd-carrinho" type="number" min="1" value="1"></div>
    <button type="button" id="adicionar-item" class="sec">Adicionar item</button></div>
    <div id="itens-carrinho" class="card muted">Nenhum item adicionado.</div>
    <h3>Agendamento da retirada ou entrega</h3>
    <div class="formgrid">
      <div><label>Data</label><input name="data" type="date" required></div>
      <div><label>Horário</label><input name="hora" type="time" required></div>
      <div><label>Modalidade</label><select name="tipo"><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select></div>
      <div><label>Endereço (obrigatório para entrega)</label><input name="endereco" placeholder="Rua, número, bairro"></div>
    </div>
    <p><label>Observação</label><textarea name="observacao" rows="2"></textarea></p>
    <p class="muted">Este pedido reserva produtos que já estão prontos. Encomendas sem estoque ficam para uma etapa posterior.</p>
    <button type="submit" ${clientes.some(c=>c.ativo!==false)?'':'disabled'}>Criar pedido e agendar</button>
    </form>`):'';
  const pedidosAtivos=pedidos.filter(p=>p.status!=='cancelado');
  pedidosAtivos.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const linhas=pedidosAtivos.map(p=>{
    const descricao=itens.filter(i=>i.pedido_id===p.id).map(i=>`${i.quantidade}× ${nomeProduto(i.produto_id,produtos)}`).join(', ');
    const acoes=[];
    if(p.status==='novo' && pode('adm','atendente','confeiteiro','logistica')) acoes.push(['preparando','Preparando']);
    if(['novo','preparando'].includes(p.status) && pode('adm','atendente','confeiteiro','logistica')) acoes.push(['pronto','Pronto']);
    if(p.status==='pronto' && pode('adm','atendente','logistica')) acoes.push(['entregue','Entregar']);
    const podeCancelar=['novo','preparando','pronto'].includes(p.status)&&pode('adm');
    const reagendar=['novo','preparando','pronto'].includes(p.status)&&pode('adm','atendente');
    const editarItens=['novo','preparando','pronto'].includes(p.status)&&pode('adm');
    return `<tr><td><strong>#${esc(p.codigo_visivel||p.numero_pedido||p.id.slice(0,8))}</strong></td><td>${dataBR(p.created_at)}</td><td>${esc(p.cliente)}</td><td>${esc(descricao)}</td>
      <td>${esc(p.retirada_data||'Sem data')} ${esc(p.retirada_hora?.slice(0,5)||'')}</td>
      <td>${reais(p.total)}</td><td>${badge(p.status)}</td><td><div class="acoes">
      ${acoes.map(([st,label])=>`<button class="small" data-pedido="${p.id}" data-status="${st}">${label}</button>`).join('')}
      ${podeCancelar?`<button type="button" class="small danger" data-cancelar-pedido="${p.id}">Cancelar com motivo</button>`:''}
      ${reagendar?`<button type="button" class="small sec" data-reagendar="${p.id}">Reagendar</button>`:''}
      ${editarItens?`<button type="button" class="small sec" data-editar-itens="${p.id}">Editar itens</button>`:''}
      </div></td></tr>`;
  }).join('');
  container(criar+`<div id="cancelamento-pedido"></div><div id="editor-itens-pedido"></div>`+
    cartao('Pedidos registrados',`<p><button class="sec" id="recarregar-pedidos">Atualizar</button></p>${tabela(['Registrado','Cliente','Itens','Agendado','Total','Status','Ações'],linhas)}`)+
    (pode('adm')?`<details id="pedidos-cancelados-detalhes" class="card rh13-details"><summary>Consultar pedidos cancelados</summary>
      <p class="muted">Histórico recolhido por padrão, com justificativas, responsáveis e filtros.</p>
      <div id="pedidos-cancelados-conteudo">Abra a seção para consultar.</div></details>`:''));
  const secaoCancelados=$('pedidos-cancelados-detalhes');
  if(secaoCancelados){
    secaoCancelados.addEventListener('toggle',()=>{
      if(secaoCancelados.open&&!secaoCancelados.dataset.carregado){
        secaoCancelados.dataset.carregado='1';
        carregarCancelados('pedidos-cancelados-conteudo').catch(err=>{
          secaoCancelados.dataset.carregado='';falha(err);
        });
      }
    });
    if(location.hash==='#cancelados')secaoCancelados.open=true;
  }
  carrinho=[];atualizarCarrinho(produtos);
  const dataInput=document.querySelector('#novo-pedido input[name="data"]');
  if(dataInput){
    const agora=new Date();
    dataInput.value=new Date(agora.getTime()-agora.getTimezoneOffset()*60000).toISOString().slice(0,10);
  }

  on('recarregar-pedidos','click',()=>carregarPedidos().catch(falha));
  on('adicionar-item','click',()=>{
    const id=$('produto-carrinho').value,qtd=Number($('qtd-carrinho').value);
    if(!id || !Number.isInteger(qtd) || qtd<1){aviso('Escolha produto e quantidade válida.',true);return;}
    const produto=produtos.find(p=>p.id===id);
    const antigo=carrinho.find(x=>x.produto_id===id);
    const novoTotal=(antigo?.quantidade||0)+qtd;
    if(novoTotal>produto.estoque-produto.reservado){aviso('Quantidade excede o estoque disponível.',true);return;}
    if(antigo) antigo.quantidade=novoTotal; else carrinho.push({produto_id:id,quantidade:qtd});
    atualizarCarrinho(produtos);
  });
  form('novo-pedido',async el=>{
    if(carrinho.length===0)throw new Error('Adicione ao menos um produto.');
    if(!el.elements.cliente_id.value)throw new Error('Escolha um cliente cadastrado.');
    await rpc('api_criar_pedido_cliente_agendado',{
      p_doceria:tenant,p_cliente_id:el.elements.cliente_id.value,p_itens:carrinho,
      p_data:el.elements.data.value,p_hora:el.elements.hora.value,
      p_tipo:el.elements.tipo.value,p_endereco:el.elements.endereco.value,
      p_observacao:el.elements.observacao.value
    });
    aviso('Pedido registrado, agendado e produtos reservados.');
    await carregarPedidos();
  });
  document.querySelectorAll('[data-pedido]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm(`Alterar pedido para ${b.dataset.status}?`))return;
    try{
      aviso(await rpc('api_status_pedido',{p_pedido:b.dataset.pedido,p_status:b.dataset.status}));
      await carregarPedidos();
    }catch(err){falha(err);}
  }));

  // Somente ADM/DEV visualiza o formulario; a RPC impõe a mesma regra no servidor.
  document.querySelectorAll('[data-cancelar-pedido]').forEach(b=>b.addEventListener('click',()=>{
    if(!pode('adm'))return;
    const ped=pedidos.find(p=>p.id===b.dataset.cancelarPedido);
    if(!ped)return;
    $('cancelamento-pedido').innerHTML=cartao(`Cancelar pedido #${esc(ped.codigo_visivel||ped.numero_pedido||ped.id.slice(0,8))}`,`
      <p class="muted">O cancelamento libera a reserva, mas preserva o pedido e a justificativa no historico.</p>
      <form id="form-cancelar-pedido">
        <div class="formgrid">
          <div><label>Motivo principal</label><select name="categoria" required>
            <option value="">Selecione o motivo</option>
            ${[
              ['Desistencia do cliente','Desistencia do cliente'],
              ['Falta de estoque','Falta de estoque'],
              ['Problema na producao','Problema na producao'],
              ['Prazo ou entrega','Prazo ou entrega'],
              ['Pagamento nao realizado','Pagamento nao realizado'],
              ['Pedido duplicado','Pedido duplicado'],
              ['Outro','Outro motivo']
            ].map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('')}
          </select></div>
        </div>
        <p><label>Justificativa detalhada (obrigatoria)</label>
        <textarea name="motivo" minlength="5" maxlength="280" rows="3" required
          placeholder="Ex.: Cliente pediu o cancelamento porque mudou a data da festa"></textarea></p>
        <p class="acoes"><button type="submit" class="danger">Confirmar cancelamento</button>
          <button type="button" class="sec" id="fechar-cancelamento">Voltar</button></p>
      </form>`);
    $('cancelamento-pedido').scrollIntoView({behavior:'smooth',block:'start'});
    on('fechar-cancelamento','click',()=>{$('cancelamento-pedido').innerHTML='';});
    form('form-cancelar-pedido',async el=>{
      if(!confirm(`Confirmar cancelamento do pedido #${ped.numero_pedido||ped.id.slice(0,8)}?`))return;
      aviso(await rpc('api_cancelar_pedido',{
        p_pedido:ped.id,p_categoria:el.elements.categoria.value,
        p_motivo:el.elements.motivo.value.trim()
      }));
      await carregarPedidos();
    });
  }));

  document.querySelectorAll('[data-editar-itens]').forEach(b=>b.addEventListener('click',()=>{
    const ped=pedidos.find(p=>p.id===b.dataset.editarItens);
    if(!ped)return;
    const anteriores=itens.filter(i=>i.pedido_id===ped.id);
    $('editor-itens-pedido').innerHTML=cartao(`Editar itens de ${ped.cliente}`,`
      <p class="muted">Quantidades: use zero para remover. Você pode adicionar mais um produto.
      O estoque reservado e o total são recalculados com segurança.</p>
      <form id="alterar-itens">
        ${anteriores.map(i=>`<div class="formgrid">
          <div><label>${esc(nomeProduto(i.produto_id,produtos))}</label>
          <input data-item-existente="${esc(i.produto_id)}" type="number" min="0" step="1" value="${i.quantidade}"></div>
        </div>`).join('')}
        <div class="formgrid">
          <div><label>Adicionar outro produto</label><select name="produto_novo">
            <option value="">Nenhum</option>
            ${selectOpcoes(produtos.filter(p=>p.ativo),p=>p.id,p=>`${p.nome} · ${reais(p.preco)}`)}
          </select></div>
          <div><label>Quantidade do produto adicional</label><input name="qtd_nova" type="number" min="0" step="1" value="0"></div>
        </div>
        <p class="acoes"><button type="submit">Salvar itens e ajustar reserva</button>
          <button type="button" class="sec" id="fechar-editor-itens">Fechar</button></p>
      </form>`);
    $('editor-itens-pedido').scrollIntoView({behavior:'smooth',block:'start'});
    on('fechar-editor-itens','click',()=>{$('editor-itens-pedido').innerHTML='';});
    form('alterar-itens',async el=>{
      const novoItens=[...el.querySelectorAll('[data-item-existente]')].map(x=>({
        produto_id:x.dataset.itemExistente,quantidade:Number(x.value)
      })).filter(x=>x.quantidade>0);
      const produtoNovo=el.elements.produto_novo.value;
      const qtdNovo=Number(el.elements.qtd_nova.value);
      if(!Number.isInteger(qtdNovo)||qtdNovo<0)throw new Error('Quantidade adicional inválida');
      if(produtoNovo&&qtdNovo>0){
        const existente=novoItens.find(i=>i.produto_id===produtoNovo);
        if(existente)existente.quantidade+=qtdNovo;
        else novoItens.push({produto_id:produtoNovo,quantidade:qtdNovo});
      }
      if(!novoItens.length)throw new Error('Pedido precisa ter pelo menos um produto. Para cancelar, use Cancelar.');
      if(novoItens.some(i=>!Number.isInteger(i.quantidade)||i.quantidade<1))
        throw new Error('Todas as quantidades devem ser inteiras e positivas');
      aviso(await rpc('api_editar_itens_pedido',{p_pedido:ped.id,p_itens:novoItens}));
      await carregarPedidos();
    });
  }));
  document.querySelectorAll('[data-reagendar]').forEach(b=>b.addEventListener('click',async()=>{
    const p=pedidos.find(p=>p.id===b.dataset.reagendar);if(!p)return;
    const data=prompt('Nova data (AAAA-MM-DD):',p.retirada_data||'');if(data===null)return;
    const hora=prompt('Novo horário (HH:MM):',p.retirada_hora?.slice(0,5)||'');if(hora===null)return;
    const tipo=prompt('Digite retirada ou entrega:',p.tipo_entrega||'retirada');if(tipo===null)return;
    const endereco=tipo==='entrega'?prompt('Endereço da entrega:',p.endereco_entrega||''):'';
    if(endereco===null)return;
    const observacao=prompt('Observação:',p.observacao_pedido||'');if(observacao===null)return;
    try{aviso(await rpc('api_agendar_pedido',{
      p_pedido:p.id,p_data:data,p_hora:hora,p_tipo:tipo,
      p_endereco:endereco,p_observacao:observacao
    }));await carregarPedidos();}catch(e){falha(e);}
  }));
}

function atualizarCarrinho(produtos){
  const el=$('itens-carrinho');if(!el)return;
  if(!carrinho.length){el.textContent='Nenhum item adicionado.';return;}
  el.innerHTML=carrinho.map(c=>`<div>${c.quantidade} × ${esc(nomeProduto(c.produto_id,produtos))} — ${reais((produtos.find(p=>p.id===c.produto_id)?.preco||0)*c.quantidade)}</div>`).join('')+
    `<p><strong>Total: ${reais(carrinho.reduce((v,c)=>v+c.quantidade*Number(produtos.find(p=>p.id===c.produto_id)?.preco||0),0))}</strong></p><button type="button" id="limpar-carrinho" class="sec small">Limpar itens</button>`;
  on('limpar-carrinho','click',()=>{carrinho=[];atualizarCarrinho(produtos);});
}

async function carregarProducao(){
  const [produtos,ingredientes,receitas,ordens]=await Promise.all([
    selecionar('produtos'),selecionar('ingredientes'),selecionar('receitas'),selecionar('ordens_producao')
  ]);
  const editar=pode('adm','confeiteiro');
  const alterarReceita=editar?cartao('Ficha técnica — por 1 unidade de produto',`
    <form class="formgrid" id="ficha"><div><label>Produto</label><select name="produto">${selectOpcoes(produtos.filter(x=>x.ativo),x=>x.id,x=>x.nome)}</select></div>
    <div><label>Ingrediente</label><select name="ingrediente">${selectOpcoes(ingredientes.filter(x=>x.ativo!==false),x=>x.id,x=>`${x.nome} (${x.unidade})`)}</select></div>
    <div><label>Quantidade (0 para remover)</label><input name="quantidade" type="number" step="0.001" min="0" required></div>
    <button type="submit">Salvar ficha técnica</button></form>`):'';
  const criar=editar?cartao('Nova ordem de produção',`
    <form id="nova-ordem" class="formgrid"><div><label>Produto</label><select name="produto">${selectOpcoes(produtos.filter(x=>x.ativo),x=>x.id,x=>x.nome)}</select></div>
    <div><label>Unidades a produzir</label><input name="quantidade" type="number" min="1" step="1" required></div>
    <button type="submit">Criar ordem</button></form>`):'';
  const recLinhas=receitas.map(r=>{
    const i=ingredientes.find(x=>x.id===r.ingrediente_id);
    return `<tr><td>${esc(nomeProduto(r.produto_id,produtos))}</td><td>${esc(i?.nome||'Não encontrado')}</td><td>${r.quantidade} ${esc(i?.unidade||'')}</td>
      <td>${pode('adm')
        ? `<button type="button" class="small danger" data-excluir-receita="1"
           data-produto-id="${esc(r.produto_id)}" data-ingrediente-id="${esc(r.ingrediente_id)}"
           data-ingrediente-nome="${esc(i?.nome||'ingrediente')}">Excluir da ficha</button>`
        : '—'}</td></tr>`;
  }).join('');
  ordens.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const ordLinhas=ordens.map(o=>{
    const acoes=o.status==='pendente'&&editar?[['iniciada','Iniciar'],['concluida','Concluir'],['cancelada','Cancelar']]:
      o.status==='iniciada'&&editar?[['concluida','Concluir'],['cancelada','Cancelar']]:[];
    return `<tr><td>${dataBR(o.created_at)}</td><td>${esc(nomeProduto(o.produto_id,produtos))}</td><td>${o.quantidade}</td><td>${badge(o.status)}</td><td><div class="acoes">${acoes.map(([st,label])=>`<button class="small ${st==='cancelada'?'danger':''}" data-ordem="${o.id}" data-status="${st}">${label}</button>`).join('')}</div></td></tr>`;
  }).join('');
  container(alterarReceita+cartao('Fichas técnicas cadastradas',tabela(['Produto','Ingrediente','Quantidade por unidade','Ação'],recLinhas))+
    criar+cartao('Ordens de produção',tabela(['Data','Produto','Unidades','Status','Ações'],ordLinhas)));
  // ADM/DEV remove somente o vínculo da receita. Não apaga o ingrediente nem seu estoque.
  document.querySelectorAll('[data-excluir-receita]').forEach(botao=>botao.addEventListener('click',async()=>{
    if(!confirm(`Remover ${botao.dataset.ingredienteNome} desta ficha técnica? O ingrediente continuará no estoque.`))return;
    try{
      aviso(await rpc('api_definir_receita',{
        p_produto:botao.dataset.produtoId,
        p_ingrediente:botao.dataset.ingredienteId,
        p_quantidade:0
      }));
      await carregarProducao();
    }catch(err){falha(err);}
  }));
  form('ficha',async el=>{
    if(!el.elements.produto.value || !el.elements.ingrediente.value) throw new Error('Cadastre produtos e ingredientes primeiro.');
    aviso(await rpc('api_definir_receita',{
      p_produto:el.elements.produto.value,p_ingrediente:el.elements.ingrediente.value,
      p_quantidade:Number(el.elements.quantidade.value)
    }));await carregarProducao();
  });
  form('nova-ordem',async el=>{
    aviso('Ordem de produção criada: '+await rpc('api_criar_producao',{
      p_doceria:tenant,p_produto:el.elements.produto.value,p_quantidade:Number(el.elements.quantidade.value)
    }));await carregarProducao();
  });
  document.querySelectorAll('[data-ordem]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm(`Atualizar produção para ${b.dataset.status}?`))return;
    try{aviso(await rpc('api_status_producao',{p_ordem:b.dataset.ordem,p_status:b.dataset.status}));await carregarProducao();}
    catch(err){falha(err);}
  }));
}

async function carregarVitrine(){
  const [produtos,pedidos,itens]=await Promise.all([
    selecionar('produtos'),selecionar('pedidos'),selecionar('pedido_itens')
  ]);
  const fila=pedidos.filter(p=>['novo','preparando'].includes(p.status));
  const prontos=pedidos.filter(p=>p.status==='pronto');
  const ordenar=(a,b)=>(String(a.retirada_data||'9999')+' '+String(a.retirada_hora||'')).localeCompare(String(b.retirada_data||'9999')+' '+String(b.retirada_hora||''));
  fila.sort(ordenar);prontos.sort(ordenar);
  const formatarItens=p=>itens.filter(i=>i.pedido_id===p.id)
    .map(i=>`${i.quantidade}× ${nomeProduto(i.produto_id,produtos)}`).join(', ')||'—';
  const rows=lista=>lista.map(p=>{
    const acoes=p.status==='novo'
      ? [['preparando','Iniciar'],['pronto','Marcar pronto']]
      : p.status==='preparando'
        ? [['pronto','Marcar pronto']]
        : [['entregue',p.tipo_entrega==='entrega'?'Marcar entregue':'Marcar retirado']];
    const permitidos=acoes.filter(([status])=>
      (status==='preparando'&&pode('adm','atendente','confeiteiro','logistica'))||
      (status==='pronto'&&pode('adm','atendente','confeiteiro','logistica'))||
      (status==='entregue'&&pode('adm','atendente','logistica')));
    const data=p.retirada_data
      ? `${p.retirada_data.split('-').reverse().join('/')} ${String(p.retirada_hora||'').slice(0,5)}`
      : 'Não agendado';
    return `<tr><td><strong>#${esc(p.codigo_visivel||p.numero_pedido||p.id.slice(0,8))}</strong></td>
      <td>${esc(p.cliente)}</td><td>${esc(formatarItens(p))}</td>
      <td>${esc(data)}</td><td>${esc(p.tipo_entrega==='entrega'?'Entrega':'Retirada')}</td>
      <td>${esc(p.endereco_entrega||'—')}</td><td>${badge(p.status)}</td>
      <td><div class="acoes">${permitidos.map(([status,rotulo])=>`<button type="button" class="small" data-pedido="${p.id}" data-status="${status}">${esc(rotulo)}</button>`).join('')}</div></td></tr>`;
  }).join('');
  const linhas=produtos.filter(p=>p.ativo)
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
    .map(p=>`<tr><td>${htmlFoto(p.imagem_url)}</td><td>${esc(p.nome)}</td>
      <td>${p.estoque}</td><td>${p.reservado}</td>
      <td><strong>${p.estoque-p.reservado}</strong></td></tr>`).join('');
  const cabecalhos=['Pedido','Cliente','Produtos','Data/hora','Tipo','Endereço','Status','Ações'];
  container(cartao('Produtos prontos para venda',tabela(
      ['Foto','Produto','Prontos','Reservados','Disponíveis'],linhas))+
    cartao(`Pedidos a preparar (${fila.length})`,tabela(cabecalhos,rows(fila)))+
    cartao(`Pedidos prontos (${prontos.length})`,tabela(cabecalhos,rows(prontos)))+
    `<p class="muted">Pedidos feitos no site somente aparecerão aqui depois que conectarmos a criação de pedidos pelo bot/checkout. A sacola pública atual apenas abre o WhatsApp.</p>`);
  document.querySelectorAll('[data-pedido]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Atualizar este pedido?'))return;
    try{
      aviso(await rpc('api_status_pedido',{p_pedido:b.dataset.pedido,p_status:b.dataset.status}));
      await carregarVitrine();
    }catch(e){falha(e);}
  }));
}

// Agenda compartilhada por todos os funcionários APROVADOS da doceria.
async function carregarAgenda(){
  const agendas=await rpc('api_agenda_entregas',{p_doceria:tenant});
  container(cartao('Agenda de retiradas e entregas',`
    <p class="muted">Todos os cargos aprovados podem consultar a agenda da própria doceria. ADM e atendente podem reagendar em Pedidos.</p>
    <div class="formgrid">
      <div><label>Filtrar por data</label><input id="agenda-data" type="date"></div>
      <div><label>Status</label><select id="agenda-status"><option value="">Todos</option>
      ${['novo','preparando','pronto','entregue','cancelado'].map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div>
      <div><button id="agenda-atualizar" class="sec" type="button">Atualizar</button></div>
    </div><div id="tabela-agenda"></div>`));
  const desenhar=()=>{
    const filtroData=$('agenda-data').value,filtroStatus=$('agenda-status').value;
    const selecionados=agendas.filter(a=>(!filtroData||a.data===filtroData)&&(!filtroStatus||a.status===filtroStatus));
    $('tabela-agenda').innerHTML=tabela(
      ['Pedido','Data','Hora','Cliente','Produtos','Modalidade','Endereço / Observação','Status'],
      selecionados.map(a=>`<tr><td><strong>#${esc(a.codigo_visivel||a.numero_pedido||a.id.slice(0,8))}</strong></td><td>${esc(a.data?String(a.data).split('-').reverse().join('/'):'—')}</td><td>${esc((a.hora||'').slice(0,5))}</td>
        <td>${esc(a.cliente)}</td><td>${esc(a.itens)}</td><td>${esc(a.tipo)}</td>
        <td>${esc(a.endereco||'—')} ${a.observacao?`<small>${esc(a.observacao)}</small>`:''}</td>
        <td>${badge(a.status)}</td></tr>`).join(''));
  };
  on('agenda-data','change',desenhar);on('agenda-status','change',desenhar);
  on('agenda-atualizar','click',()=>carregarAgenda().catch(falha));
  desenhar();
}

// ATT 12C — Cancelados fora da lista de pedidos, área exclusiva para ADM e DEV.
async function carregarCancelados(alvo='conteudo'){
  if(!pode('adm')){
    container(cartao('Acesso negado','Somente DEV ou ADM podem consultar cancelamentos.'));
    return;
  }
  let paginaAtual=0;
  let filtroAtual='';
  const anoAtual=new Date().getFullYear();
  const mostrarCancelados=alvo==='conteudo'?container:html=>{$(alvo).innerHTML=html};
  mostrarCancelados(cartao('Consultar pedidos cancelados',`
    <p class="muted">Pedidos cancelados não aparecem na lista operacional. Aqui fica o histórico com justificativas e responsáveis.</p>
    <div class="formgrid">
      <div><label>Ano do cancelamento</label>
        <select id="ano-cancelados">
          <option value="">Todos os anos</option>
          ${Array.from({length:Math.min(10,anoAtual-2020+1)},(_,i)=>anoAtual-i)
              .map(ano=>`<option value="${ano}">${ano}</option>`).join('')}
        </select></div>
      <div><label>Pesquisar cliente ou nº do pedido</label><input id="busca-cancelados" placeholder="Ex.: Maria ou 125" maxlength="100"></div>
      <div><label>&nbsp;</label><button type="button" id="buscar-cancelados">Pesquisar</button></div>
    </div>
    <div id="grafico-motivos-cancelados"></div>
    <div id="historico-cancelados" aria-live="polite"></div>`));
  const carregar=async()=>{
    const anoTxt=$('ano-cancelados').value;
    const ano=anoTxt?Number(anoTxt):null;
    filtroAtual=$('busca-cancelados').value.trim();
    if(ano!==null && (!Number.isInteger(ano)||ano<2020||ano>2100)){
      throw new Error('Ano inválido.');
    }
    const dados=await rpc('api_pedidos_cancelados',{
      p_doceria:tenant,p_ano:ano,p_busca:filtroAtual,p_limite:30,p_offset:paginaAtual*30
    });
    const lista=Array.isArray(dados?.pedidos)?dados.pedidos:[];
    const total=Number(dados?.total||0);
    const linhas=lista.map(p=>`<tr>
      <td><strong>#${esc(p.numero)}</strong></td>
      <td>${dataBR(p.cancelado_em)}</td>
      <td>${esc(p.cliente)}</td>
      <td>${esc(p.itens||'—')}</td>
      <td>${reais(p.valor)}</td>
      <td>${esc(p.categoria)}</td>
      <td>${esc(p.motivo)}</td>
      <td>${esc(p.responsavel)}</td>
    </tr>`).join('');
    const paginas=Math.max(1,Math.ceil(total/30));
    $('historico-cancelados').innerHTML=cartao(`Histórico de pedidos cancelados (${total})`,
      `${tabela(['Pedido','Cancelado em','Cliente','Produtos','Valor','Categoria','Justificativa','Cancelado por'],linhas)}
      <div class="acoes" style="margin-top:14px;align-items:center">
        <button id="pagina-cancelados-anterior" type="button" class="sec small" ${paginaAtual===0?'disabled':''}>Anterior</button>
        <span>Página ${paginaAtual+1} de ${paginas}</span>
        <button id="pagina-cancelados-proxima" type="button" class="sec small" ${(paginaAtual+1)*30>=total?'disabled':''}>Próxima</button>
      </div>`);
    on('pagina-cancelados-anterior','click',()=>{
      if(paginaAtual>0){paginaAtual--;carregar().catch(falha);}
    });
    on('pagina-cancelados-proxima','click',()=>{
      if((paginaAtual+1)*30<total){paginaAtual++;carregar().catch(falha);}
    });
  };
  const carregarGrafico=async()=>{
    // O resumo de motivos considera o ano escolhido, sem filtrar por nome do cliente.
    const ano=$('ano-cancelados').value;
    const dados=await rpc('api_motivos_cancelamentos',{
      p_doceria:tenant,p_ano:ano?Number(ano):null
    });
    $('grafico-motivos-cancelados').innerHTML=graficoCancelamentos(dados);
  };
  on('buscar-cancelados','click',()=>{paginaAtual=0;carregar().catch(falha);});
  on('busca-cancelados','keydown',ev=>{
    if(ev.key==='Enter'){ev.preventDefault();paginaAtual=0;carregar().catch(falha);}
  });
  on('ano-cancelados','change',()=>{
    paginaAtual=0;
    Promise.all([carregar(),carregarGrafico()]).catch(falha);
  });
  await Promise.all([carregar(),carregarGrafico()]);
}

// Informações financeiras disponíveis apenas para ADM e DEV.
// Totaliza pedidos entregues; não representa Pix confirmado nem lucro.
async function carregarRelatorios(){
  if(!pode('adm') && podePagina('relatorios')){
    container('<h1>Relatórios financeiros</h1><div id="rh13-relatorio-caixa"></div>');
    await window.Salamandras13.relatorioCaixa(contexto12());return;
  }
  if(!pode('adm')){
    container(cartao('Acesso negado','Apenas ADM e DEV podem consultar os resultados financeiros.'));
    return;
  }
  const anoAtual=new Date().getFullYear();
  container(cartao('Relatório de vendas mensais',`
    <p class="muted">Valores de pedidos entregues. Não representa dinheiro recebido por Pix nem lucro.</p>
    <div class="formgrid">
      <div><label>Ano</label><input type="number" id="ano-relatorio" min="2020" max="2100" value="${anoAtual}"></div>
      <div><button type="button" id="consultar-relatorio">Consultar</button></div>
    </div>
    <div id="resultado-relatorio" aria-live="polite"></div>`));
  const carregar=async()=>{
    const ano=Number($('ano-relatorio').value);
    if(!Number.isInteger(ano)||ano<2020||ano>2100){aviso('Informe um ano entre 2020 e 2100.',true);return;}
    const [dados,produtosDoAno,cancelamentosAno]=await Promise.all([
      rpc('api_relatorio_vendas',{p_doceria:tenant,p_ano:ano}),
      rpc('api_vendas_produtos_mensais',{p_doceria:tenant,p_ano:ano}),
      rpc('api_relatorio_cancelamentos',{p_doceria:tenant,p_ano:ano})
    ]);
    const registros=Array.isArray(dados)?dados:[];
    const total=registros.reduce((s,v)=>s+Number(v.total||0),0);
    const quant=registros.reduce((s,v)=>s+Number(v.pedidos||0),0);
    $('resultado-relatorio').innerHTML=`
      <div class="relatorio-cabecalho">
        <div class="relatorio-numeros">
          <div><span class="muted">Vendas entregues em ${ano}</span><div class="resumo">${reais(total)}</div></div>
          <div><span class="muted">Pedidos entregues</span><div class="resumo">${quant}</div></div>
        </div>
        ${graficoVendas(registros,`Evolução das vendas em ${ano}`,produtosDoAno)}
      </div>
      <h3>Detalhamento por mês</h3>
      ${tabela(['Mês','Vendas entregues','Pedidos'],registros.map(d=>`<tr>
        <td>${NOMES_MESES[Number(d.mes)-1]||'—'}</td>
        <td>${reais(d.total)}</td><td>${Number(d.pedidos||0)}</td>
      </tr>`).join(''))}
      ${graficoCancelamentos(cancelamentosAno)}
      <p><a href="pedidos.html#cancelados">Consultar todos os pedidos cancelados e suas justificativas</a></p>
    `;
    ativarGraficos($('resultado-relatorio'));
  };
  on('consultar-relatorio','click',()=>carregar().catch(falha));
  await carregar();
  $('conteudo').insertAdjacentHTML('beforeend','<div id="rh13-relatorio-caixa"></div>');
  await window.Salamandras13.relatorioCaixa(contexto12());
}

window.addEventListener('DOMContentLoaded',()=>{
  iniciarBotaoTemaERP();
  if(!window.supabase || !window.SALAMANDRAS_CONFIG){
    aviso('Biblioteca ou configuração não carregou. Confira config.js e a conexão à internet.',true);return;
  }
  (pagina==='login'?iniciarLogin():iniciarApp()).catch(falha);
});