/* SALAMANDRAS | HTML + JavaScript puro + Supabase. Sem instalação local. */
'use strict';

const db = window.supabase.createClient(
  window.SALAMANDRAS_CONFIG.url,
  window.SALAMANDRAS_CONFIG.key
);
const pagina = document.body.dataset.page;
const $ = (id) => document.getElementById(id);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reais = (n) => Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dataBR = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—';
const nomeCargo = {dev:'DEV',adm:'ADM',logistica:'Logística',confeiteiro:'Confeiteiro',atendente:'Atendente',funcionario:'Funcionário'};
// Mini gráfico de vendas, sem dependência externa e sem envio de dados a terceiros.
const NOMES_MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function graficoVendas(dados,titulo='Vendas por mês'){
  const valores=Array.from({length:12},(_,i)=>{
    const registro=(Array.isArray(dados)?dados:[]).find(d=>Number(d.mes)===i+1);
    return {mes:NOMES_MESES[i],total:Math.max(0,Number(registro?.total||0)),pedidos:Number(registro?.pedidos||0)};
  });
  const maior=Math.max(1,...valores.map(v=>v.total));
  const barras=valores.map((v,i)=>{
    const altura=v.total?Math.max(5,Math.round(v.total/maior*100)):0;
    return `<button type="button" class="grafico-coluna" data-mes-grafico="${i}"
      title="${esc(v.mes)}: ${esc(reais(v.total))} (${v.pedidos} pedidos)"
      aria-label="Consultar ${v.mes}: ${reais(v.total)}">
      <span class="grafico-trilho"><span class="grafico-barra" style="height:${altura}%"></span></span>
      <span class="grafico-mes">${v.mes}</span>
    </button>`;
  }).join('');
  return `<section class="grafico-vendas" aria-label="${esc(titulo)}">
    <h3 class="grafico-titulo">${esc(titulo)}</h3>
    <div class="grafico-colunas">${barras}</div>
    <div class="grafico-detalhe" aria-live="polite">Selecione um mês para consultar o valor.</div>
  </section>`;
}
function ativarGraficos(raiz=document){
  raiz.querySelectorAll('.grafico-vendas').forEach(grafico=>{
    const botoes=[...grafico.querySelectorAll('[data-mes-grafico]')];
    if(!botoes.length)return;
    const detalhes=grafico.querySelector('.grafico-detalhe');
    const selecionarBarra=b=>{
      botoes.forEach(x=>x.classList.toggle('selecionado',x===b));
      detalhes.textContent=b.title;
    };
    botoes.forEach(b=>b.addEventListener('click',()=>selecionarBarra(b)));
    const indice=new Date().getMonth();
    selecionarBarra(botoes[indice]||botoes[botoes.length-1]);
  });
}

const paginas = [
  ['painel','Painel'],['usuarios','Usuários'],['permissoes','Permissões'],
  ['docerias','Docerias'],['redes','Redes da loja'],
  ['estoque','Estoque · Ingredientes'],['produtos','Produtos · Cadastro'],
  ['pedidos','Pedidos'],['clientes','Clientes'],['producao','Produção'],
  ['vitrine','Vitrine'],['agenda','Agenda de entregas'],['relatorios','Relatórios']
];
const modulosEquipe = paginas.filter(p=>!['usuarios','permissoes','docerias','redes','relatorios'].includes(p[0]));
let permissoesAtivas = {};
function podePagina(modulo){
  if(modulo==='docerias')return perfil?.cargo==='dev';
  if(['usuarios','permissoes','redes','relatorios'].includes(modulo))
    return ['dev','adm'].includes(perfil?.cargo);
  return Boolean(permissoesAtivas[modulo]);
}
async function atualizarPermissoes(){
  permissoesAtivas=tenant?await rpc('api_minhas_permissoes',{p_doceria:tenant}):{};
  $('menu').innerHTML=paginas.filter(x=>podePagina(x[0])).map(x=>
    `<a ${x[0]===pagina?'class="ativo"':''} href="${x[0]}.html">${esc(x[1])}</a>`).join('');
}
let usuario=null, perfil=null, docerias=[], tenant=null;
let carrinho=[];

function pode(...cargos) {return perfil && (perfil.cargo === 'dev' || cargos.includes(perfil.cargo));}
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
function nomeDoceria(id){return docerias.find(x=>x.id===id)?.nome || 'Sem doceria';}
function minhaDoceria(){return docerias.find(d=>d.id===tenant);}
function requerDoceria(){
  if(tenant) return false;
  container(cartao('Nenhuma doceria selecionada',
    `<p>Se você é DEV, crie primeiro um estabelecimento em <a href="docerias.html">Docerias</a>. Se você é funcionário, peça para o administrador atribuir uma doceria à sua conta.</p>`));
  return true;
}
async function lerPerfil(){
  const {data:{user},error}=await db.auth.getUser();
  if(error || !user) return null;
  const {data:p,error:erro}=await db.from('perfis').select('id,nome_completo,cargo,status,doceria_id').eq('id',user.id).single();
  if(erro || !p) throw new Error('Perfil não encontrado. Confira se o SQL do Salamandras foi executado.');
  usuario=user; perfil=p;
  return p;
}
async function sair(){await db.auth.signOut();window.location.replace('index.html');}

// Entrada, solicitação e espera por autorização.
async function iniciarLogin(){
  form('form-acesso',async()=>{
    const nome=$('acesso-nome').value.trim().replace(/\s+/g,' ');
    if(nome.length<5 || nome.split(' ').length<2)throw new Error('Informe seu nome e sobrenome.');
    const email=$('acesso-email').value.trim().toLowerCase();
    const password=$('acesso-senha').value;
    if(password.length<8)throw new Error('Informe uma senha de pelo menos 8 caracteres.');
    const entrada=await db.auth.signInWithPassword({email,password});
    if(!entrada.error){await rotaAposLogin();return;}
    const msg=String(entrada.error.message||'').toLowerCase();
    if(msg.includes('email not confirmed')||msg.includes('e-mail not confirmed')){
      throw new Error('Confirme seu e-mail antes de continuar.');
    }
    if(!msg.includes('invalid login credentials')&&!msg.includes('invalid credentials')){
      throw new Error(entrada.error.message);
    }
    // Não é possível consultar se um e-mail existe publicamente sem expor contas.
    // Se a senha estiver errada, o Supabase também pode recusar o cadastro.
    const cadastro=await db.auth.signUp({email,password,options:{data:{nome_completo:nome}}});
    if(cadastro.error){
      throw new Error('Não foi possível entrar ou solicitar acesso. Se já tem conta, confira a senha. '+cadastro.error.message);
    }
    if(cadastro.data.session){
      await rotaAposLogin();
    }else{
      $('auth-forms').classList.add('escondido');
      $('pendente').classList.remove('escondido');
      $('pendente-titulo').textContent='Solicitação recebida';
      $('pendente-texto').textContent='Caso sua conta seja nova, confirme o e-mail (se solicitado) e aguarde a aprovação do ADM ou DEV. Se já tinha conta, verifique a senha.';
      $('form-convite').classList.add('escondido');
    }
  });
  form('form-convite',async()=>{
    const codigo=$('codigo-convite').value.trim();
    if(!codigo)throw new Error('Digite o código recebido da doceria.');
    aviso(await rpc('api_solicitar_doceria',{p_codigo:codigo}));
    $('codigo-convite').value='';
  });
  on('sair-pendente','click',sair);
  try{await rotaAposLogin();}catch(e){falha(e);}
}

async function rotaAposLogin(){
  const p=await lerPerfil();
  if(!p){$('auth-forms').classList.remove('escondido');$('pendente').classList.add('escondido');return;}
  if(p.status==='aprovado' && p.cargo!=='funcionario'){
    window.location.replace('painel.html');return;
  }
  $('auth-forms').classList.add('escondido');
  $('pendente').classList.remove('escondido');
  $('pendente-titulo').textContent=p.status==='pendente'?'Aguardando aprovação':`Acesso: ${p.status}`;
  $('pendente-texto').textContent=p.status==='pendente'
    ? 'Seu cadastro existe, mas ainda precisa ser aprovado. Informe o código da doceria para aparecer na lista do ADM, ou aguarde o DEV.'
    : 'Seu acesso não está disponível. Entre em contato com o administrador.';
  $('form-convite').classList.toggle('escondido',p.status!=='pendente');
}

// Aplicativo autenticado: todas as páginas verificam sessão e cargo.
async function iniciarApp(){
  try{
    const p=await lerPerfil();
    if(!p || p.status!=='aprovado'){window.location.replace('index.html');return;}
    const especificacao=paginas.find(x=>x[0]===pagina);
    if(!especificacao){container(cartao('Página desconhecida','Página não encontrada.'));return;}
    $('usuario-atual').textContent=`${p.nome_completo||usuario.email} · ${nomeCargo[p.cargo]||p.cargo}`;
    on('sair','click',sair);
    docerias=await rpc('api_docerias');
    if(p.cargo==='dev'){
      const escolhido=sessionStorage.getItem('salamandras_tenant');
      tenant=docerias.some(d=>d.id===escolhido)?escolhido:(docerias[0]?.id||null);
      $('seletor-tenant').innerHTML=`<select id="trocar-doceria" aria-label="Doceria ativa"><option value="">Selecionar doceria</option>${selectOpcoes(docerias,d=>d.id,d=>d.nome,tenant)}</select>`;
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
  }catch(err){container(cartao('Erro de inicialização',`<p>${esc(err.message)}</p><p>Confira se executou <code>sql/01_atualizacao.sql</code> e atualize a página.</p>`));console.error(err);}
}
async function carregarPagina(){
  container('<p>Carregando informações...</p>');
  if(!podePagina(pagina)){container(cartao('Acesso negado','Seu cargo ou sua conta não possui permissão para esta aba.'));return;}
  if(pagina==='permissoes')return carregarPermissoes();
  if(pagina==='painel') return carregarPainel();
  if(pagina==='usuarios') return carregarUsuarios();
  if(pagina==='docerias') return carregarDocerias();
  if(pagina==='redes') return carregarRedes();
  if(requerDoceria()) return;
  if(pagina==='estoque') return carregarEstoque();
  if(pagina==='produtos') return carregarProdutos();
  if(pagina==='pedidos') return carregarPedidos();
  if(pagina==='clientes') return carregarClientes();
  if(pagina==='producao') return carregarProducao();
  if(pagina==='vitrine') return carregarVitrine();
  if(pagina==='agenda') return carregarAgenda();
  if(pagina==='relatorios') return carregarRelatorios();
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

  if(pode('adm')){
    // O faturamento considera só pedidos ENTREGUES. Não representa Pix confirmado.
    const anoAtual=new Date().getFullYear();
    const [resumo, avisos, clientes, vendasAno, alertas]=await Promise.all([
      rpc('api_resumo_vendas',{p_doceria:tenant}),
      selecionar('notificacoes_cortesia'),
      selecionar('clientes','id,nome'),
      rpc('api_relatorio_vendas',{p_doceria:tenant,p_ano:anoAtual}),
      rpc('api_alertas_estoque',{p_doceria:tenant})
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
        ${graficoVendas(vendasAno,`Vendas mensais de ${anoAtual}`)}
      </section>
      <section class="card"><h2>Pedidos entregues</h2>
        <div class="resumo">${Number(resumo.pedidos_entregues||0)}</div></section>
      <a class="card" href="clientes.html"><h2>Clientes cadastrados</h2>
        <div class="resumo">${Number(resumo.clientes_cadastrados||0)}</div></a>
    </div>`;

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
    ${resumoVendas}${alertasEstoque}${notificacoes}<div class="grid">${cardTexto}</div>`);
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
      : `<p class="muted">A página ainda não foi publicada. Peça ao DEV para configurar o endereço da loja no módulo Docerias.</p>`}
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
}

async function carregarDocerias(){
  const criar=perfil.cargo==='dev'?cartao('Criar doceria',`
    <form id="nova-doceria" class="formgrid">
      <div><label>Nome</label><input name="nome" required minlength="2"></div>
      <button type="submit">Criar doceria</button>
    </form>`):'';
  const linhas=docerias.map(d=>`<tr><td>${esc(d.nome)}</td><td>${d.codigo_convite?`<code>${esc(d.codigo_convite)}</code>`:'—'}</td></tr>`).join('');
  let configuracao=''; let d=null;
  if(tenant&&pode('adm')){
    d=await rpc('api_config_doceria',{p_doceria:tenant});
    if(d)configuracao=cartao('Editar a doceria e suas fotos',`
      <p class="muted">A foto de capa e a foto do local aparecerão no site público da doceria.</p>
      <form id="form-doceria">
        <div class="formgrid">
          ${campoForm('nome','Nome da doceria','text',d.nome,'required minlength="2"')}
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
        <p><label>Descrição da doceria</label><textarea name="descricao" rows="3">${esc(d.descricao_site||'')}</textarea></p>
        <div class="formgrid">
          <div><label>Foto de capa (até 5 MB)</label>${htmlFoto(d.imagem_capa_url)}<input type="file" name="capa" accept="image/jpeg,image/png,image/webp"><label><input type="checkbox" name="remover_capa" class="check-inline"> Remover foto</label></div>
          <div><label>Foto do estabelecimento</label>${htmlFoto(d.imagem_local_url)}<input type="file" name="local" accept="image/jpeg,image/png,image/webp"><label><input type="checkbox" name="remover_local" class="check-inline"> Remover foto</label></div>
        </div>
        <p><button type="submit">Salvar dados da doceria</button></p>
      </form>
      ${d.slug?`<p><a href="loja.html?loja=${esc(d.slug)}" target="_blank" rel="noopener">Visualizar site público</a></p>`:''}
    `);
  }
  container(criar+configuracao+cartao('Docerias e códigos de convite',tabela(['Doceria','Código'],linhas)));
  form('nova-doceria',async el=>{
    await rpc('api_criar_doceria',{p_nome:el.elements.nome.value});
    docerias=await rpc('api_docerias');aviso('Doceria criada. Atualize a página para selecioná-la.');
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

async function carregarUsuarios(){
  if(!pode('adm')){container(cartao('Acesso negado','Apenas ADM e DEV podem gerenciar usuários.'));return;}
  const registros=await rpc('api_usuarios');
  const ordenados=[...registros].sort((a,b)=>(a.status==='pendente'?0:1)-(b.status==='pendente'?0:1));
  const cargos=perfil.cargo==='dev'
    ?['adm','logistica','confeiteiro','atendente']
    :['logistica','confeiteiro','atendente'];
  const linhas=ordenados.map(u=>{
    const proprio=u.id===usuario.id;
    const restrito=proprio||u.cargo==='dev'||(perfil.cargo==='adm'&&u.cargo==='adm');
    let comandos='—';
    const doceria=perfil.cargo==='dev'
      ?`<select data-doceria="${esc(u.id)}"><option value="">Selecionar doceria</option>${selectOpcoes(docerias,d=>d.id,d=>d.nome,u.doceria_id)}</select>`
      :esc(u.doceria_nome||'Sem doceria');
    if(u.status==='pendente'&&!restrito){
      comandos=`<div class="acoes"><select data-aprovar-cargo="${esc(u.id)}">${cargos.map(c=>`<option value="${c}">${esc(nomeCargo[c])}</option>`).join('')}</select>
        <button class="small" data-usuario="${esc(u.id)}" data-decisao="aprovado">Aprovar</button>
        <button class="small danger" data-usuario="${esc(u.id)}" data-decisao="rejeitado">Rejeitar</button></div>`;
    }else if(['aprovado','bloqueado'].includes(u.status)&&!restrito){
      comandos=`<div class="acoes"><select data-cargo-novo="${esc(u.id)}">${cargos.map(c=>`<option value="${c}" ${u.cargo===c?'selected':''}>${esc(nomeCargo[c])}</option>`).join('')}</select>
        <button class="small" data-usuario="${esc(u.id)}" data-salvar-cargo>Alterar cargo</button>
        <button class="small sec" data-usuario="${esc(u.id)}" data-bloquear="${u.status==='aprovado'}">${u.status==='aprovado'?'Bloquear':'Desbloquear'}</button>
        <button class="small danger" data-usuario="${esc(u.id)}" data-remover-acesso>Remover acesso</button></div>`;
    }
    return `<tr><td><strong>${esc(u.nome_completo||'Nome não informado')}</strong><br><small>${esc(u.email||'')}</small></td><td>${badge(u.status)}</td><td>${esc(nomeCargo[u.cargo]||u.cargo)}</td><td>${doceria}</td><td>${comandos}</td></tr>`;
  }).join('');
  container(cartao('Usuários e permissões',`<p class="muted">DEV é exclusivo da conta proprietária. ADM gerencia apenas funcionários da própria doceria; só DEV nomeia ADM. Remover acesso bloqueia a conta e preserva auditoria.</p>
    <button id="atualizar-usuarios" class="sec">Atualizar lista</button>
    ${tabela(['Nome / E-mail','Status','Cargo','Doceria','Ações'],linhas)}`));
  on('atualizar-usuarios','click',()=>carregarUsuarios().catch(falha));
  document.querySelectorAll('[data-decisao]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Confirma a decisão sobre este usuário?'))return;
    try{const id=b.dataset.usuario;
      aviso(await rpc('api_decidir_usuario',{p_usuario:id,p_decisao:b.dataset.decisao,
        p_cargo:document.querySelector(`[data-aprovar-cargo="${id}"]`)?.value||'atendente',
        p_doceria:perfil.cargo==='dev'?(document.querySelector(`[data-doceria="${id}"]`)?.value||null):tenant}));
      await carregarUsuarios();
    }catch(e){falha(e);}
  }));
  document.querySelectorAll('[data-salvar-cargo]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Alterar o cargo deste funcionário?'))return;
    try{const id=b.dataset.usuario;
      aviso(await rpc('api_alterar_cargo',{p_usuario:id,
        p_cargo:document.querySelector(`[data-cargo-novo="${id}"]`).value}));
      await carregarUsuarios();}catch(e){falha(e);}
  }));
  document.querySelectorAll('[data-bloquear]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Confirma alterar o bloqueio deste usuário?'))return;
    try{aviso(await rpc('api_bloquear_usuario',{p_usuario:b.dataset.usuario,
      p_bloquear:b.dataset.bloquear==='true'}));await carregarUsuarios();}catch(e){falha(e);}
  }));
  document.querySelectorAll('[data-remover-acesso]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Remover acesso? O usuário será BLOQUEADO, mas não perderá o histórico.'))return;
    try{aviso(await rpc('api_remover_acesso',{p_usuario:b.dataset.usuario}));
      await carregarUsuarios();}catch(e){falha(e);}
  }));
}

// Controle de acesso por cargo ou funcionario (apenas ADM/DEV).
async function carregarPermissoes(){
  if(!pode('adm')){container(cartao('Acesso negado','Apenas ADM ou DEV.'));return;}
  if(requerDoceria())return;
  const config=await rpc('api_config_permissoes',{p_doceria:tenant});
  const cargos=['logistica','confeiteiro','atendente','funcionario'];
  const opcoes=[['','Padrão do cargo'],['true','Permitir'],['false','Bloquear']];
  const selecao=(tipo,modulo,chave,atual)=>`<select data-perm-${tipo}="${esc(modulo)}" data-chave="${esc(chave)}">
    ${opcoes.map(([v,label])=>`<option value="${v}" ${atual===v?'selected':''}>${label}</option>`).join('')}</select>`;
  const cargosTabela=modulosEquipe.map(([mod,rotulo])=>`<tr><td>${esc(rotulo)}</td>
     ${cargos.map(c=>{
      const r=(config.cargos||[]).find(x=>x.cargo===c&&x.modulo===mod);
      return `<td>${selecao('cargo',mod,c,r?String(r.permitido):'')}</td>`;
     }).join('')}</tr>`).join('');
  const lista=(config.usuarios||[]).filter(u=>u.cargo!=='dev'&&u.cargo!=='adm');
  container(cartao('Permissões por cargo',`
    <p class="muted">Estas opções definem quais abas cada cargo pode visualizar. "Padrão" mantém as permissões originais. Ações críticas exigem cargo autorizado no banco.</p>
    ${tabela(['Aba',...cargos.map(c=>nomeCargo[c])],cargosTabela)}
    <button type="button" id="salvar-permissoes-cargo">Salvar permissões dos cargos</button>`)+
    cartao('Permissões individuais',`<p class="muted">Um ajuste individual prevalece sobre o cargo. Ao mudar o cargo de um funcionário, suas exceções individuais são zeradas.</p>
      <label for="usuario-permissoes">Funcionário</label>
      <select id="usuario-permissoes"><option value="">Selecione um funcionário</option>
        ${selectOpcoes(lista,u=>u.id,u=>`${u.nome_completo||u.email} · ${nomeCargo[u.cargo]}`)}</select>
      <div id="permissoes-individuais"></div>`)+
    cartao('Áreas protegidas',`<p>Docerias: somente DEV. Usuários, Redes da loja e Relatórios financeiros: somente ADM/DEV. Essas áreas não podem ser liberadas a funcionários.</p>`));
  const desenhar=()=>{
    const uid=$('usuario-permissoes').value;
    if(!uid){$('permissoes-individuais').innerHTML='<p class="muted">Escolha um funcionário acima.</p>';return;}
    const linhas=modulosEquipe.map(([mod,rotulo])=>{
      const r=(config.pessoas||[]).find(x=>x.usuario_id===uid&&x.modulo===mod);
      return `<tr><td>${esc(rotulo)}</td><td>${selecao('usuario',mod,uid,r?String(r.permitido):'')}</td></tr>`;
    }).join('');
    $('permissoes-individuais').innerHTML=tabela(['Aba','Acesso'],linhas)+
      '<p><button type="button" id="salvar-permissoes-usuario">Salvar permissões do funcionário</button></p>';
    on('salvar-permissoes-usuario','click',async()=>{
      try{
        const selecionados=[...document.querySelectorAll('[data-perm-usuario]')];
        for(const s of selecionados){
          await rpc('api_salvar_permissao_usuario',{
            p_doceria:tenant,p_usuario:uid,p_modulo:s.dataset.permUsuario,
            p_permitido:s.value===''?null:s.value==='true'
          });
        }
        aviso('Permissões individuais salvas. O funcionário deve atualizar a página.');
        await carregarPermissoes();
      }catch(e){falha(e);}
    });
  };
  on('usuario-permissoes','change',desenhar);desenhar();
  on('salvar-permissoes-cargo','click',async()=>{
    try{
      const selecionados=[...document.querySelectorAll('[data-perm-cargo]')];
      for(const s of selecionados){
        await rpc('api_salvar_permissao_cargo',{
          p_doceria:tenant,p_cargo:s.dataset.chave,p_modulo:s.dataset.permCargo,
          p_permitido:s.value===''?null:s.value==='true'
        });
      }
      aviso('Permissões dos cargos salvas. Funcionários devem atualizar a página.');
      await carregarPermissoes();
    }catch(e){falha(e);}
  });
}

async function carregarEstoque(){return carregarCadastros('estoque');}
async function carregarProdutos(){return carregarCadastros('produtos');}
async function carregarCadastros(modo){
  const produtosPagina=modo==='produtos';
  const [produtos, ingredientes, receitas] = await Promise.all([
    selecionar('produtos'), selecionar('ingredientes'), selecionar('receitas')
  ]);
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
        <div><label>Nome do bolo/produto</label><input name="nome" required minlength="2"></div>
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

  const movimentacoes = permiteIngredientes ? await selecionar('movimentacoes') : [];
  movimentacoes.sort((a,b) => b.created_at.localeCompare(a.created_at));
  const movLinhas = movimentacoes.filter(m=>produtosPagina?m.item_tipo==='produto':m.item_tipo==='ingrediente').slice(0,30).map(m => `<tr>
    <td>${dataBR(m.created_at)}</td><td>${esc(m.item_tipo)}</td>
    <td>${m.variacao>0?'+':''}${m.variacao}</td>
    <td>${m.saldo_anterior} → ${m.saldo_posterior}</td><td>${esc(m.motivo)}</td></tr>`).join('');

  const produtoTabela=cartao('Produtos prontos e fichas técnicas',tabela(
    ['Foto','Produto','Preço','Receita por unidade','Físico','Reservado','Disponível','Ação'],pLinhas));
  const estoqueTabela=cartao('Ingredientes em estoque',tabela(
    ['Ingrediente','Saldo','Alerta até','Situação','Ação'],iLinhas));
  const historico=tabela(['Quando','Tipo','Variação','Antes → Depois','Motivo'],movLinhas.filter(Boolean));
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
  // Vitrine/confeiteiro podem consultar pedidos, mas não têm permissão
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
  pedidos.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const linhas=pedidos.map(p=>{
    const descricao=itens.filter(i=>i.pedido_id===p.id).map(i=>`${i.quantidade}× ${nomeProduto(i.produto_id,produtos)}`).join(', ');
    const acoes=[];
    if(p.status==='novo' && pode('adm','atendente','confeiteiro','logistica')) acoes.push(['preparando','Preparando']);
    if(['novo','preparando'].includes(p.status) && pode('adm','atendente','confeiteiro','logistica')) acoes.push(['pronto','Pronto']);
    if(p.status==='pronto' && pode('adm','atendente','logistica')) acoes.push(['entregue','Entregar']);
    if(['novo','preparando','pronto'].includes(p.status) && pode('adm','atendente')) acoes.push(['cancelado','Cancelar']);
    const reagendar=['novo','preparando','pronto'].includes(p.status)&&pode('adm','atendente');
    const editarItens=['novo','preparando','pronto'].includes(p.status)&&pode('adm');
    return `<tr><td><strong>#${esc(p.numero_pedido||p.id.slice(0,8))}</strong></td><td>${dataBR(p.created_at)}</td><td>${esc(p.cliente)}</td><td>${esc(descricao)}</td>
      <td>${esc(p.retirada_data||'Sem data')} ${esc(p.retirada_hora?.slice(0,5)||'')}</td>
      <td>${reais(p.total)}</td><td>${badge(p.status)}</td><td><div class="acoes">
      ${acoes.map(([st,label])=>`<button class="small ${st==='cancelado'?'danger':''}" data-pedido="${p.id}" data-status="${st}">${label}</button>`).join('')}
      ${reagendar?`<button type="button" class="small sec" data-reagendar="${p.id}">Reagendar</button>`:''}
      ${editarItens?`<button type="button" class="small sec" data-editar-itens="${p.id}">Editar itens</button>`:''}
      </div></td></tr>`;
  }).join('');
  container(criar+`<div id="editor-itens-pedido"></div>`+cartao('Pedidos registrados',`<p><button class="sec" id="recarregar-pedidos">Atualizar</button></p>${tabela(['Registrado','Cliente','Itens','Agendado','Total','Status','Ações'],linhas)}`));
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
    return `<tr><td>${esc(nomeProduto(r.produto_id,produtos))}</td><td>${esc(i?.nome||'Não encontrado')}</td><td>${r.quantidade} ${esc(i?.unidade||'')}</td></tr>`;
  }).join('');
  ordens.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const ordLinhas=ordens.map(o=>{
    const acoes=o.status==='pendente'&&editar?[['iniciada','Iniciar'],['concluida','Concluir'],['cancelada','Cancelar']]:
      o.status==='iniciada'&&editar?[['concluida','Concluir'],['cancelada','Cancelar']]:[];
    return `<tr><td>${dataBR(o.created_at)}</td><td>${esc(nomeProduto(o.produto_id,produtos))}</td><td>${o.quantidade}</td><td>${badge(o.status)}</td><td><div class="acoes">${acoes.map(([st,label])=>`<button class="small ${st==='cancelada'?'danger':''}" data-ordem="${o.id}" data-status="${st}">${label}</button>`).join('')}</div></td></tr>`;
  }).join('');
  container(alterarReceita+cartao('Fichas técnicas cadastradas',tabela(['Produto','Ingrediente','Quantidade por unidade'],recLinhas))+
    criar+cartao('Ordens de produção',tabela(['Data','Produto','Unidades','Status','Ações'],ordLinhas)));
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
    return `<tr><td><strong>#${esc(p.numero_pedido||p.id.slice(0,8))}</strong></td>
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
      selecionados.map(a=>`<tr><td><strong>#${esc(a.numero_pedido||a.id.slice(0,8))}</strong></td><td>${esc(a.data?String(a.data).split('-').reverse().join('/'):'—')}</td><td>${esc((a.hora||'').slice(0,5))}</td>
        <td>${esc(a.cliente)}</td><td>${esc(a.itens)}</td><td>${esc(a.tipo)}</td>
        <td>${esc(a.endereco||'—')} ${a.observacao?`<small>${esc(a.observacao)}</small>`:''}</td>
        <td>${badge(a.status)}</td></tr>`).join(''));
  };
  on('agenda-data','change',desenhar);on('agenda-status','change',desenhar);
  on('agenda-atualizar','click',()=>carregarAgenda().catch(falha));
  desenhar();
}

// Informações financeiras disponíveis apenas para ADM e DEV.
// Totaliza pedidos entregues; não representa Pix confirmado nem lucro.
async function carregarRelatorios(){
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
    const dados=await rpc('api_relatorio_vendas',{p_doceria:tenant,p_ano:ano});
    const registros=Array.isArray(dados)?dados:[];
    const total=registros.reduce((s,v)=>s+Number(v.total||0),0);
    const quant=registros.reduce((s,v)=>s+Number(v.pedidos||0),0);
    $('resultado-relatorio').innerHTML=`
      <div class="relatorio-cabecalho">
        <div class="relatorio-numeros">
          <div><span class="muted">Vendas entregues em ${ano}</span><div class="resumo">${reais(total)}</div></div>
          <div><span class="muted">Pedidos entregues</span><div class="resumo">${quant}</div></div>
        </div>
        ${graficoVendas(registros,`Evolução das vendas em ${ano}`)}
      </div>
      <h3>Detalhamento por mês</h3>
      ${tabela(['Mês','Vendas entregues','Pedidos'],registros.map(d=>`<tr>
        <td>${NOMES_MESES[Number(d.mes)-1]||'—'}</td>
        <td>${reais(d.total)}</td><td>${Number(d.pedidos||0)}</td>
      </tr>`).join(''))}
    `;
    ativarGraficos($('resultado-relatorio'));
  };
  on('consultar-relatorio','click',()=>carregar().catch(falha));
  await carregar();
}

window.addEventListener('DOMContentLoaded',()=>{
  if(!window.supabase || !window.SALAMANDRAS_CONFIG){
    aviso('Biblioteca ou configuração não carregou. Confira config.js e a conexão à internet.',true);return;
  }
  (pagina==='login'?iniciarLogin():iniciarApp()).catch(falha);
});