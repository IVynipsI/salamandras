
/* SALAMANDRAS | HTML + JavaScript puro + Supabase */
'use strict';

const db = window.supabase.createClient(
  window.SALAMANDRAS_CONFIG.url,
  window.SALAMANDRAS_CONFIG.key
);

const pagina = document.body.dataset.page;
const $ = (id) => document.getElementById(id);

const esc = (x) => String(x ?? '').replace(
  /[&<>"']/g,
  c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c])
);

const reais = (n) => Number(n || 0).toLocaleString(
  'pt-BR',
  {style:'currency',currency:'BRL'}
);

const dataBR = (s) =>
  s ? new Date(s).toLocaleString('pt-BR') : '—';

const nomeCargo = {
  dev:'DEV',
  adm:'ADM',
  estoquista:'Estoquista',
  confeiteiro:'Confeiteiro',
  vitrine:'Vitrine',
  atendente:'Atendente',
  funcionario:'Funcionário'
};

const paginas = [
  ['painel','Painel',['adm','estoquista','confeiteiro','vitrine','atendente']],
  ['usuarios','Usuários',['adm']],
  ['docerias','Docerias',['adm']],
  ['estoque','Estoque',['adm','estoquista','confeiteiro']],
  ['pedidos','Pedidos',['adm','atendente','vitrine','confeiteiro']],
  ['clientes','Clientes',['adm','atendente']],
  ['producao','Produção',['adm','confeiteiro','estoquista']],
  ['vitrine','Vitrine',['adm','vitrine','atendente']]
];

let usuario = null;
let perfil = null;
let docerias = [];
let tenant = null;
let carrinho = [];

function pode(...cargos) {
  return perfil &&
    (perfil.cargo === 'dev' || cargos.includes(perfil.cargo));
}

function aviso(msg, erro=false) {
  const el = $('aviso');
  if (!el) return;

  el.textContent = msg;
  el.style.display = 'block';
  el.classList.toggle('erro', !!erro);

  clearTimeout(window.__avisoTimer);

  window.__avisoTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 8500);
}

function falha(err) {
  console.error('Salamandras:', err);
  aviso(err?.message || 'Erro inesperado', true);
}

async function rpc(nome, parametros={}) {
  const {data,error} = await db.rpc(nome,parametros);
  if (error) throw new Error(error.message);
  return data;
}

async function selecionar(tabela,colunas='*') {
  const {data,error} = await db
    .from(tabela)
    .select(colunas)
    .eq('doceria_id',tenant);

  if (error) throw new Error(error.message);
  return data || [];
}

function form(id,acao) {
  const el = $(id);
  if (!el) return;

  el.addEventListener('submit',async ev => {
    ev.preventDefault();

    const botao = el.querySelector('button[type="submit"]');
    if (botao) botao.disabled = true;

    try {
      await acao(el);
    } catch (e) {
      falha(e);
    } finally {
      if (botao) botao.disabled = false;
    }
  });
}

function on(id,evento,acao) {
  const el = $(id);
  if (el) el.addEventListener(evento,acao);
}

function container(html) {
  $('conteudo').innerHTML = html;
}

function cartao(titulo,corpo) {
  return `<section class="card">
    <h2>${esc(titulo)}</h2>${corpo}
  </section>`;
}

function tabela(cabecalhos,linhas) {
  return `<div class="rolagem">
    <table class="tabela">
      <thead><tr>
        ${cabecalhos.map(x=>`<th>${esc(x)}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${linhas || `<tr><td colspan="${cabecalhos.length}" class="muted">Nenhum registro.</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function selectOpcoes(itens,valorFn,textoFn,selecionado) {
  return itens.map(item =>
    `<option value="${esc(valorFn(item))}"
      ${valorFn(item)===selecionado?'selected':''}>
      ${esc(textoFn(item))}
    </option>`
  ).join('');
}

function badge(valor) {
  return `<span class="tag ${esc(valor)}">${esc(valor)}</span>`;
}

function nomeProduto(id,lista) {
  return lista.find(x=>x.id===id)?.nome || 'Produto não encontrado';
}

function nomeDoceria(id) {
  return docerias.find(x=>x.id===id)?.nome || 'Sem doceria';
}

function requerDoceria() {
  if (tenant) return false;

  container(cartao(
    'Nenhuma doceria selecionada',
    `<p>Se você é DEV, crie primeiro um estabelecimento em
    <a href="docerias.html">Docerias</a>.
    Se você é funcionário, peça para o administrador
    atribuir uma doceria à sua conta.</p>`
  ));

  return true;
}

async function lerPerfil() {
  const {data:{user},error} = await db.auth.getUser();

  if (error || !user) return null;

  const {data:p,error:erro} = await db
    .from('perfis')
    .select('id,cargo,status,doceria_id')
    .eq('id',user.id)
    .single();

  if (erro || !p) {
    throw new Error('Perfil não encontrado. Confira o SQL do Salamandras.');
  }

  usuario = user;
  perfil = p;
  return p;
}

async function sair() {
  await db.auth.signOut();
  window.location.replace('index.html');
}

// LOGIN E CADASTRO

async function iniciarLogin() {
  form('form-login',async () => {
    const email = $('login-email').value.trim();
    const password = $('login-senha').value;

    const {error} = await db.auth.signInWithPassword({
      email,password
    });

    if (error) throw new Error(error.message);

    await rotaAposLogin();
  });

  form('form-cadastro',async () => {
    const email = $('cad-email').value.trim();
    const password = $('cad-senha').value;

    const {data,error} = await db.auth.signUp({
      email,password
    });

    if (error) throw new Error(error.message);

    if (data.session) {
      await rotaAposLogin();
    } else {
      aviso('Solicitação enviada. Confira seu e-mail, se a confirmação estiver habilitada, e depois faça login.');
    }
  });

  form('form-convite',async () => {
    const codigo = $('codigo-convite').value.trim();

    if (!codigo) {
      throw new Error('Digite o código recebido da doceria.');
    }

    const resposta = await rpc(
      'api_solicitar_doceria',
      {p_codigo:codigo}
    );

    aviso(resposta);
    $('codigo-convite').value = '';
  });

  on('sair-pendente','click',sair);

  try {
    await rotaAposLogin();
  } catch (e) {
    falha(e);
  }
}

async function rotaAposLogin() {
  const p = await lerPerfil();

  if (!p) {
    $('auth-forms').classList.remove('escondido');
    $('pendente').classList.add('escondido');
    return;
  }

  if (p.status==='aprovado' && p.cargo!=='funcionario') {
    window.location.replace('painel.html');
    return;
  }

  $('auth-forms').classList.add('escondido');
  $('pendente').classList.remove('escondido');

  $('pendente-titulo').textContent =
    p.status==='pendente'
      ? 'Aguardando aprovação'
      : `Acesso: ${p.status}`;

  $('pendente-texto').textContent =
    p.status==='pendente'
      ? 'Seu cadastro existe, mas ainda precisa ser aprovado. Informe o código da doceria para aparecer na lista do ADM, ou aguarde o DEV.'
      : 'Seu acesso não está disponível. Entre em contato com o administrador.';

  $('form-convite').classList.toggle(
    'escondido',
    p.status!=='pendente'
  );
}

// INICIALIZAÇÃO DO SISTEMA

async function iniciarApp() {
  try {
    const p = await lerPerfil();

    if (!p || p.status!=='aprovado') {
      window.location.replace('index.html');
      return;
    }

    const especificacao = paginas.find(x=>x[0]===pagina);

    if (!especificacao || !pode(...especificacao[2])) {
      container(cartao(
        'Acesso negado',
        'Esta função não está disponível para seu cargo.'
      ));
      return;
    }

    $('usuario-atual').textContent =
      `${usuario.email} · ${nomeCargo[p.cargo]||p.cargo}`;

    on('sair','click',sair);

    $('menu').innerHTML = paginas
      .filter(x=>pode(...x[2]))
      .map(x =>
        `<a ${x[0]===pagina?'class="ativo"':''}
          href="${x[0]}.html">${esc(x[1])}</a>`
      ).join('');

    docerias = await rpc('api_docerias');

    if (p.cargo==='dev') {
      const escolhido = sessionStorage.getItem('salamandras_tenant');

      tenant = docerias.some(d=>d.id===escolhido)
        ? escolhido
        : (docerias[0]?.id||null);

      $('seletor-tenant').innerHTML =
        `<select id="trocar-doceria" aria-label="Doceria ativa">
          <option value="">Selecionar doceria</option>
          ${selectOpcoes(docerias,d=>d.id,d=>d.nome,tenant)}
        </select>`;

      on('trocar-doceria','change',ev => {
        tenant = ev.target.value||null;
        sessionStorage.setItem('salamandras_tenant',tenant||'');
        carregarPagina().catch(falha);
      });

    } else {
      tenant = p.doceria_id;
      $('seletor-tenant').textContent = nomeDoceria(tenant);
    }

    await carregarPagina();

  } catch (err) {
    container(cartao(
      'Erro de inicialização',
      `<p>${esc(err.message)}</p>
       <p>Confira se executou o SQL do Salamandras.</p>`
    ));
    console.error(err);
  }
}

async function carregarPagina() {
  container('<p>Carregando informações...</p>');

  if (pagina==='painel') return carregarPainel();
  if (pagina==='usuarios') return carregarUsuarios();
  if (pagina==='docerias') return carregarDocerias();

  if (requerDoceria()) return;

  if (pagina==='estoque') return carregarEstoque();
  if (pagina==='pedidos') return carregarPedidos();
  if (pagina==='clientes') return carregarClientes();
  if (pagina==='producao') return carregarProducao();
  if (pagina==='vitrine') return carregarVitrine();
}

// PAINEL E FATURAMENTO

async function carregarPainel() {
  if (requerDoceria()) return;

  const blocos = [
    ['Produtos prontos','produtos',['adm','estoquista','confeiteiro','vitrine','atendente'],'estoque.html'],
    ['Pedidos','pedidos',['adm','atendente','vitrine','confeiteiro'],'pedidos.html'],
    ['Produções','ordens_producao',['adm','confeiteiro','estoquista'],'producao.html']
  ];

  const cards = [];

  for (const [titulo,tabelaNome,cargos,destino] of blocos) {
    if (!pode(...cargos)) continue;

    const {count,error} = await db
      .from(tabelaNome)
      .select('id',{head:true,count:'exact'})
      .eq('doceria_id',tenant);

    if (!error) {
      cards.push(`<a class="card" href="${destino}">
        <h2>${esc(titulo)}</h2>
        <div class="resumo">${count||0}</div>
        <div class="muted">Abrir módulo</div>
      </a>`);
    }
  }

  const cardTexto = cards.length
    ? cards.join('')
    : cartao('Bem-vindo','Abra um módulo no menu para começar.');

  let resumoVendas = '';
  let notificacoes = '';

  if (pode('adm')) {
    const [resumo,avisos,clientes] = await Promise.all([
      rpc('api_resumo_vendas',{p_doceria:tenant}),
      selecionar('notificacoes_cortesia'),
      selecionar('clientes','id,nome')
    ]);

    resumoVendas = `<div class="grid">
      <section class="card">
        <h2>Vendas entregues</h2>
        <div class="resumo">${reais(resumo.faturamento_entregue)}</div>
        <p class="muted">Soma dos pedidos entregues. Não é confirmação de Pix.</p>
      </section>

      <section class="card">
        <h2>Pedidos entregues</h2>
        <div class="resumo">${Number(resumo.pedidos_entregues||0)}</div>
      </section>

      <a class="card" href="clientes.html">
        <h2>Clientes cadastrados</h2>
        <div class="resumo">${Number(resumo.clientes_cadastrados||0)}</div>
      </a>
    </div>`;

    const pendentes = avisos
      .filter(a=>!a.lida_em)
      .sort((a,b)=>b.created_at.localeCompare(a.created_at));

    const nomes = new Map(clientes.map(c=>[c.id,c.nome]));

    const linhas = pendentes.map(n => {
      const quantidade = Number(n.quantidade_bolos);

      const descricao = quantidade===1
        ? '1 bolo de fubá'
        : `${quantidade} bolos de fubá`;

      return `<tr>
        <td>${dataBR(n.created_at)}</td>
        <td>${esc(nomes.get(n.cliente_id)||'Cliente')}</td>
        <td>
          <strong>
            Este cliente acumulou ${reais(n.total_acumulado)} em compras.
            Dê ${esc(descricao)} como cortesia.
          </strong>
        </td>
        <td>
          <button type="button" class="small sec"
            data-cortesia-lida="${esc(n.id)}">
            Marcar como lida
          </button>
        </td>
      </tr>`;
    }).join('');

    notificacoes = cartao(
      `🔔 Notificações de cortesia (${pendentes.length})`,
      `<p class="muted">
        A cada R$ 350 em compras entregues, aparece um aviso.
        A cortesia não entra automaticamente no pedido ou estoque.
      </p>
      ${tabela(['Quando','Cliente','Aviso','Ação'],linhas)}`
    );
  }

  container(`
    <div class="card">
      <h2>${esc(nomeDoceria(tenant))}</h2>
      <p>
        Sua conta está aprovada como
        <strong>${esc(nomeCargo[perfil.cargo])}</strong>.
      </p>
    </div>

    ${resumoVendas}
    ${notificacoes}
    <div class="grid">${cardTexto}</div>
  `);

  document.querySelectorAll('[data-cortesia-lida]')
    .forEach(btn=>btn.addEventListener('click',async () => {
      try {
        const resposta = await rpc(
          'api_marcar_cortesia_lida',
          {p_notificacao:btn.dataset.cortesiaLida}
        );

        aviso(resposta);
        await carregarPainel();

      } catch (err) {
        falha(err);
      }
    }));
}

// DOCERIAS

async function carregarDocerias() {
  const criar = perfil.cargo==='dev'
    ? cartao('Criar doceria',`
      <form id="nova-doceria" class="formgrid">
        <div>
          <label>Nome</label>
          <input name="nome" required minlength="2">
        </div>
        <button type="submit">Criar doceria</button>
      </form>`)
    : '';

  const linhas = docerias.map(d=>`
    <tr>
      <td>${esc(d.nome)}</td>
      <td>
        ${d.codigo_convite
          ? `<code>${esc(d.codigo_convite)}</code>
             <button type="button" data-copiar="${esc(d.codigo_convite)}"
               class="sec small">Copiar</button>`
          : '—'}
      </td>
    </tr>
  `).join('');

  container(criar + cartao(
    'Estabelecimentos',
    `<p class="muted">
      O código de convite permite que novos funcionários
      solicitem entrada na doceria.
    </p>
    ${tabela(['Doceria','Código de convite'],linhas)}`
  ));

  form('nova-doceria',async el => {
    await rpc('api_criar_doceria',{
      p_nome:el.elements.nome.value
    });

    docerias = await rpc('api_docerias');

    aviso('Doceria criada. Atualize a página para selecionar o estabelecimento.');
    await carregarDocerias();
  });

  document.querySelectorAll('[data-copiar]')
    .forEach(b=>b.addEventListener('click',async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copiar);
        aviso('Código copiado.');
      } catch(e) {
        aviso('Copie o código manualmente.');
      }
    }));
}

// USUÁRIOS E APROVAÇÕES

async function carregarUsuarios() {
  const registros = await rpc('api_usuarios');

  const ordenados = [...registros].sort(
    (a,b)=>(a.status==='pendente'?0:1)-(b.status==='pendente'?0:1)
  );

  const cargosPermitidos = perfil.cargo==='dev'
    ? ['adm','estoquista','confeiteiro','vitrine','atendente']
    : ['estoquista','confeiteiro','vitrine','atendente'];

  const linhas = ordenados.map(u => {
    const suaConta = u.id===usuario.id;

    const opcoesDoceria = perfil.cargo==='dev'
      ? `<select data-doceria="${esc(u.id)}">
           <option value="">Escolha a doceria</option>
           ${selectOpcoes(docerias,d=>d.id,d=>d.nome,u.doceria_id)}
         </select>`
      : esc(u.doceria_nome||'Sem doceria');

    let botoes = '—';

    if (u.status==='pendente' && !suaConta) {
      botoes = `<div class="acoes">
        <select data-cargo="${esc(u.id)}">
          ${cargosPermitidos.map(c=>`
            <option value="${c}">${esc(nomeCargo[c])}</option>
          `).join('')}
        </select>

        <button class="small"
          data-decisao="aprovado"
          data-usuario="${esc(u.id)}">
          Aprovar
        </button>

        <button class="small danger"
          data-decisao="rejeitado"
          data-usuario="${esc(u.id)}">
          Rejeitar
        </button>
      </div>`;

    } else if (
      !suaConta &&
      u.cargo!=='dev' &&
      u.status==='aprovado' &&
      (perfil.cargo==='dev'||u.cargo!=='adm')
    ) {
      botoes = `<button class="small danger"
        data-bloquear="true"
        data-usuario="${esc(u.id)}">Bloquear</button>`;

    } else if (
      !suaConta &&
      u.cargo!=='dev' &&
      u.status==='bloqueado' &&
      (perfil.cargo==='dev'||u.cargo!=='adm')
    ) {
      botoes = `<button class="small"
        data-bloquear="false"
        data-usuario="${esc(u.id)}">Desbloquear</button>`;
    }

    return `<tr>
      <td>${esc(u.email)}</td>
      <td>${badge(u.status)}</td>
      <td>${esc(nomeCargo[u.cargo]||u.cargo)}</td>
      <td>${opcoesDoceria}</td>
      <td>${botoes}</td>
    </tr>`;
  }).join('');

  container(cartao('Gerenciar solicitações',`
    <p class="muted">
      Solicitações pendentes aparecem primeiro.
      O DEV pode definir doceria e cargo.
      O ADM aprova pessoas da própria doceria.
    </p>

    <p>
      <button class="sec" id="recarregar-usuarios">
        Atualizar lista
      </button>
    </p>

    ${tabela(
      ['E-mail','Status','Cargo atual','Doceria','Ações'],
      linhas
    )}
  `));

  on('recarregar-usuarios','click',()=>{
    carregarUsuarios().catch(falha);
  });

  document.querySelectorAll('[data-decisao]')
    .forEach(btn=>btn.addEventListener('click',async () => {
      if (!confirm('Confirma esta decisão?')) return;

      try {
        const id = btn.dataset.usuario;

        const cargo = document.querySelector(
          `[data-cargo="${id}"]`
        )?.value || 'atendente';

        const doceria = perfil.cargo==='dev'
          ? document.querySelector(`[data-doceria="${id}"]`)?.value||null
          : tenant;

        const resposta = await rpc('api_decidir_usuario',{
          p_usuario:id,
          p_decisao:btn.dataset.decisao,
          p_cargo:cargo,
          p_doceria:doceria
        });

        aviso(resposta);
        await carregarUsuarios();

      } catch(err) {
        falha(err);
      }
    }));

  document.querySelectorAll('[data-bloquear]')
    .forEach(btn=>btn.addEventListener('click',async () => {
      if (!confirm('Confirma alterar o acesso deste usuário?')) return;

      try {
        const resposta = await rpc('api_bloquear_usuario',{
          p_usuario:btn.dataset.usuario,
          p_bloquear:btn.dataset.bloquear==='true'
        });

        aviso(resposta);
        await carregarUsuarios();

      } catch(err) {
        falha(err);
      }
    }));
}

// ESTOQUE, PRODUTOS E RECEITAS

async function carregarEstoque() {
  const [produtos,ingredientes,receitas] = await Promise.all([
    selecionar('produtos'),
    selecionar('ingredientes'),
    selecionar('receitas')
  ]);

  const permiteIngredientes = pode('adm','estoquista','confeiteiro');
  const podeAjustar = pode('adm','estoquista');

  const camposReceita = ingredientes.length
    ? `<div class="formgrid">
      ${ingredientes.map(i=>`
        <div>
          <label for="receita-${esc(i.id)}">
            ${esc(i.nome)} (${esc(i.unidade)}) por unidade
          </label>

          <input
            id="receita-${esc(i.id)}"
            data-ingrediente-receita="${esc(i.id)}"
            type="number" min="0" step="0.001"
            placeholder="Deixe vazio se não usar">
        </div>
      `).join('')}
      </div>`
    : `<p class="muted">
        Primeiro cadastre os ingredientes abaixo.
        Em seguida, volte ao cadastro do produto.
       </p>`;

  const criarProduto = pode('adm')
    ? cartao('Cadastrar produto com sua receita',`
      <p class="muted">
        Para cada unidade do produto, informe quanto de
        cada ingrediente será utilizado.
      </p>

      <form id="novo-produto">
        <div class="formgrid">
          <div>
            <label>Nome do bolo/produto</label>
            <input name="nome" required minlength="2">
          </div>

          <div>
            <label>Preço de venda (R$)</label>
            <input name="preco" type="number"
              min="0" step="0.01" required>
          </div>
        </div>

        <h3>Ficha técnica — ingredientes para produzir 1 unidade</h3>
        ${camposReceita}

        <p>
          <button type="submit" ${ingredientes.length?'':'disabled'}>
            Cadastrar produto e salvar receita
          </button>
        </p>
      </form>`)
    : '';

  const criarIngrediente = podeAjustar
    ? cartao('1. Cadastrar ingredientes',`
      <form id="novo-ingrediente" class="formgrid">
        <div>
          <label>Nome do ingrediente</label>
          <input name="nome" required minlength="2">
        </div>

        <div>
          <label>Unidade de medida</label>
          <select name="unidade">
            <option value="un">Unidades (un)</option>
            <option value="g">Gramas (g)</option>
            <option value="kg">Quilos (kg)</option>
            <option value="ml">Mililitros (ml)</option>
            <option value="l">Litros (l)</option>
          </select>
        </div>

        <button type="submit">Cadastrar ingrediente</button>
      </form>`)
    : '';

  const pLinhas = produtos.map(p => {
    const descricao = receitas
      .filter(r=>r.produto_id===p.id)
      .map(r => {
        const ing = ingredientes.find(i=>i.id===r.ingrediente_id);
        return ing
          ? `${r.quantidade} ${ing.unidade} de ${ing.nome}`
          : 'Ingrediente indisponível';
      })
      .join(', ') || 'Receita não cadastrada';

    return `<tr>
      <td>${esc(p.nome)}</td>
      <td>${reais(p.preco)}</td>
      <td>${esc(descricao)}</td>
      <td>${p.estoque}</td>
      <td>${p.reservado}</td>
      <td><strong>${p.estoque-p.reservado}</strong></td>
      <td>
        ${podeAjustar
          ? `<button class="small sec"
               data-ajuste="produto"
               data-item="${esc(p.id)}"
               data-nome="${esc(p.nome)}">Movimentar</button>`
          : '—'}
      </td>
    </tr>`;
  }).join('');

  const iLinhas = ingredientes.map(i => `
    <tr>
      <td>${esc(i.nome)}</td>
      <td>${i.quantidade} ${esc(i.unidade)}</td>
      <td>
        ${podeAjustar
          ? `<button class="small sec"
               data-ajuste="ingrediente"
               data-item="${esc(i.id)}"
               data-nome="${esc(i.nome)}">Movimentar</button>`
          : '—'}
      </td>
    </tr>
  `).join('');

  const movimentacoes = permiteIngredientes
    ? await selecionar('movimentacoes')
    : [];

  movimentacoes.sort(
    (a,b)=>b.created_at.localeCompare(a.created_at)
  );

  const movLinhas = movimentacoes.slice(0,30).map(m=>`
    <tr>
      <td>${dataBR(m.created_at)}</td>
      <td>${esc(m.item_tipo)}</td>
      <td>${m.variacao>0?'+':''}${m.variacao}</td>
      <td>${m.saldo_anterior} → ${m.saldo_posterior}</td>
      <td>${esc(m.motivo)}</td>
    </tr>
  `).join('');

  container(
    criarIngrediente +
    criarProduto +
    cartao('Produtos prontos e fichas técnicas',tabela(
      ['Produto','Preço','Receita por unidade','Físico','Reservado','Disponível','Ação'],
      pLinhas
    )) +
    (permiteIngredientes
      ? cartao('Ingredientes em estoque',tabela(
          ['Ingrediente','Saldo','Ação'],iLinhas
        )) +
        cartao('Últimas movimentações',tabela(
          ['Quando','Tipo','Variação','Antes → Depois','Motivo'],
          movLinhas
        ))
      : '')
  );

  form('novo-produto',async el => {
    const p_ingredientes = [
      ...el.querySelectorAll('[data-ingrediente-receita]')
    ]
      .filter(input=>input.value.trim()!=='')
      .map(input=>({
        ingrediente_id:input.dataset.ingredienteReceita,
        quantidade:Number(input.value)
      }));

    if (!p_ingredientes.length) {
      throw new Error('Informe ao menos um ingrediente para a receita.');
    }

    if (p_ingredientes.some(i=>
      !Number.isFinite(i.quantidade) || i.quantidade<=0
    )) {
      throw new Error('As quantidades devem ser maiores que zero.');
    }

    await rpc('api_criar_produto_com_receita',{
      p_doceria:tenant,
      p_nome:el.elements.nome.value,
      p_preco:Number(el.elements.preco.value),
      p_ingredientes
    });

    aviso('Produto e ficha técnica cadastrados juntos.');
    await carregarEstoque();
  });

  form('novo-ingrediente',async el => {
    await rpc('api_criar_ingrediente',{
      p_doceria:tenant,
      p_nome:el.elements.nome.value,
      p_unidade:el.elements.unidade.value
    });

    aviso('Ingrediente cadastrado.');
    await carregarEstoque();
  });

  document.querySelectorAll('[data-ajuste]')
    .forEach(btn=>btn.addEventListener('click',async () => {
      const texto = prompt(
        `Movimentar: ${btn.dataset.nome}
Informe +10 para entrada ou -2 para saída.`
      );

      if (texto===null) return;

      const variacao = Number(texto.replace(',','.'));

      if (!Number.isFinite(variacao)||variacao===0) {
        aviso('Quantidade inválida.',true);
        return;
      }

      const motivo = prompt(
        'Motivo da movimentação: compra, contagem, perda etc.'
      );

      if (motivo===null) return;

      try {
        const resposta = await rpc('api_ajustar_estoque',{
          p_tipo:btn.dataset.ajuste,
          p_id:btn.dataset.item,
          p_variacao:variacao,
          p_motivo:motivo
        });

        aviso(resposta);
        await carregarEstoque();

      } catch(err) {
        falha(err);
      }
    }));
}

// CLIENTES E FIDELIDADE

async function carregarClientes() {
  const clientes = await selecionar('clientes');

  clientes.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));

  const podeCadastrar = pode('adm','atendente');

  const cadastro = podeCadastrar
    ? cartao('Cadastrar cliente',`
      <p class="muted">
        Use o telefone com DDD.
        Ele identifica o cliente para acumular suas compras.
      </p>

      <form id="novo-cliente" class="formgrid">
        <div>
          <label>Nome</label>
          <input name="nome" required minlength="2" autocomplete="name">
        </div>

        <div>
          <label>Telefone com DDD</label>
          <input name="telefone" required
            inputmode="tel" autocomplete="tel"
            placeholder="11999998888">
        </div>

        <button type="submit">Cadastrar cliente</button>
      </form>`)
    : '';

  const linhas = clientes.map(c => {
    const saldo = Number(c.total_gasto||0);
    const progresso = saldo%350;

    return `<tr>
      <td>${esc(c.nome)}</td>
      <td>${esc(c.telefone)}</td>
      <td>${reais(saldo)}</td>
      <td>${reais(progresso)} / R$ 350,00</td>
      <td>${Number(c.cortesias_avisadas||0)}</td>
    </tr>`;
  }).join('');

  container(
    cadastro +
    cartao('Clientes da doceria',`
      <p class="muted">
        O total é acumulado quando os pedidos são entregues.
        Cada R$ 350 gera uma notificação no Painel DEV/ADM.
        Nenhum bolo é entregue automaticamente.
      </p>

      ${tabela(
        ['Cliente','Telefone','Compras entregues','Progresso no próximo aviso','Bolos avisados'],
        linhas
      )}
    `)
  );

  form('novo-cliente',async el => {
    await rpc('api_criar_cliente',{
      p_doceria:tenant,
      p_nome:el.elements.nome.value,
      p_telefone:el.elements.telefone.value
    });

    aviso('Cliente cadastrado!');
    await carregarClientes();
  });
}

// PEDIDOS

async function carregarPedidos() {
  const podeCriar = pode('adm','atendente');

  const [produtos,pedidos,itens,clientes] = await Promise.all([
    selecionar('produtos'),
    selecionar('pedidos'),
    selecionar('pedido_itens'),
    podeCriar
      ? selecionar('clientes','id,nome,telefone')
      : Promise.resolve([])
  ]);

  const criar = podeCriar
    ? cartao('Novo pedido',`
      <p class="muted">
        Escolha um cliente cadastrado para acumular corretamente
        suas compras e emitir avisos de cortesia.
      </p>

      <form id="novo-pedido">
        <div class="formgrid">
          <div>
            <label>Cliente cadastrado</label>
            <select name="cliente_id" required>
              <option value="">Selecione um cliente</option>
              ${selectOpcoes(
                clientes,
                c=>c.id,
                c=>`${c.nome} · ${c.telefone}`
              )}
            </select>

            <p class="mini">
              <a href="clientes.html">Cadastrar cliente novo</a>
            </p>
          </div>

          <div>
            <label>Produto</label>
            <select id="produto-carrinho">
              ${selectOpcoes(
                produtos.filter(p=>p.ativo&&p.estoque>p.reservado),
                p=>p.id,
                p=>`${p.nome} · disponível ${p.estoque-p.reservado} · ${reais(p.preco)}`
              )}
            </select>
          </div>

          <div>
            <label>Quantidade</label>
            <input id="qtd-carrinho" type="number" min="1" value="1">
          </div>

          <button type="button" id="adicionar-item" class="sec">
            Adicionar item
          </button>
        </div>

        <div id="itens-carrinho" class="card muted">
          Nenhum item adicionado.
        </div>

        <button type="submit" ${clientes.length?'':'disabled'}>
          Criar pedido e reservar produtos
        </button>
      </form>`)
    : '';

  pedidos.sort((a,b)=>b.created_at.localeCompare(a.created_at));

  const linhas = pedidos.map(p => {
    const descricao = itens
      .filter(i=>i.pedido_id===p.id)
      .map(i=>`${i.quantidade}× ${nomeProduto(i.produto_id,produtos)}`)
      .join(', ');

    const acoes = [];

    if (p.status==='novo' && pode('adm','atendente','confeiteiro')) {
      acoes.push(['preparando','Preparando']);
    }

    if (
      ['novo','preparando'].includes(p.status) &&
      pode('adm','vitrine','atendente','confeiteiro')
    ) {
      acoes.push(['pronto','Pronto']);
    }

    if (
      p.status==='pronto' &&
      pode('adm','atendente','vitrine')
    ) {
      acoes.push(['entregue','Entregar']);
    }

    if (
      ['novo','preparando','pronto'].includes(p.status) &&
      pode('adm','atendente')
    ) {
      acoes.push(['cancelado','Cancelar']);
    }

    return `<tr>
      <td>${dataBR(p.created_at)}</td>
      <td>${esc(p.cliente)}</td>
      <td>${esc(descricao)}</td>
      <td>${reais(p.total)}</td>
      <td>${badge(p.status)}</td>
      <td>
        <div class="acoes">
          ${acoes.map(([st,label])=>`
            <button class="small ${st==='cancelado'?'danger':''}"
              data-pedido="${p.id}"
              data-status="${st}">
              ${label}
            </button>
          `).join('')}
        </div>
      </td>
    </tr>`;
  }).join('');

  container(
    criar +
    cartao('Pedidos registrados',`
      <p>
        <button class="sec" id="recarregar-pedidos">
          Atualizar
        </button>
      </p>

      ${tabela(
        ['Data','Cliente','Itens','Total','Status','Ações'],
        linhas
      )}
    `)
  );

  carrinho = [];
  atualizarCarrinho(produtos);

  on('recarregar-pedidos','click',()=>{
    carregarPedidos().catch(falha);
  });

  on('adicionar-item','click',()=>{
    const id = $('produto-carrinho').value;
    const qtd = Number($('qtd-carrinho').value);

    if (!id || !Number.isInteger(qtd) || qtd<1) {
      aviso('Escolha produto e quantidade válida.',true);
      return;
    }

    const produto = produtos.find(p=>p.id===id);
    const antigo = carrinho.find(x=>x.produto_id===id);
    const novoTotal = (antigo?.quantidade||0)+qtd;

    if (novoTotal>produto.estoque-produto.reservado) {
      aviso('Quantidade excede o estoque disponível.',true);
      return;
    }

    if (antigo) {
      antigo.quantidade = novoTotal;
    } else {
      carrinho.push({produto_id:id,quantidade:qtd});
    }

    atualizarCarrinho(produtos);
  });

  form('novo-pedido',async el => {
    if (carrinho.length===0) {
      throw new Error('Adicione ao menos um produto.');
    }

    if (!el.elements.cliente_id.value) {
      throw new Error('Escolha um cliente cadastrado.');
    }

    await rpc('api_criar_pedido_cliente',{
      p_doceria:tenant,
      p_cliente_id:el.elements.cliente_id.value,
      p_itens:carrinho
    });

    aviso('Pedido registrado. Produtos reservados.');
    await carregarPedidos();
  });

  document.querySelectorAll('[data-pedido]')
    .forEach(b=>b.addEventListener('click',async () => {
      if (!confirm(`Alterar pedido para ${b.dataset.status}?`)) {
        return;
      }

      try {
        aviso(await rpc('api_status_pedido',{
          p_pedido:b.dataset.pedido,
          p_status:b.dataset.status
        }));

        await carregarPedidos();

      } catch(err) {
        falha(err);
      }
    }));
}

function atualizarCarrinho(produtos) {
  const el = $('itens-carrinho');
  if (!el) return;

  if (!carrinho.length) {
    el.textContent = 'Nenhum item adicionado.';
    return;
  }

  el.innerHTML = carrinho.map(c => `
    <div>
      ${c.quantidade} × ${esc(nomeProduto(c.produto_id,produtos))}
      —
      ${reais(
        (produtos.find(p=>p.id===c.produto_id)?.preco||0)
        * c.quantidade
      )}
    </div>
  `).join('') + `
    <p>
      <strong>
        Total:
        ${reais(carrinho.reduce(
          (v,c)=>v+c.quantidade*Number(
            produtos.find(p=>p.id===c.produto_id)?.preco||0
          ),0
        ))}
      </strong>
    </p>

    <button type="button" id="limpar-carrinho" class="sec small">
      Limpar itens
    </button>
  `;

  on('limpar-carrinho','click',()=>{
    carrinho = [];
    atualizarCarrinho(produtos);
  });
}

// PRODUÇÃO

async function carregarProducao() {
  const [produtos,ingredientes,receitas,ordens] = await Promise.all([
    selecionar('produtos'),
    selecionar('ingredientes'),
    selecionar('receitas'),
    selecionar('ordens_producao')
  ]);

  const editar = pode('adm','confeiteiro');

  const alterarReceita = editar
    ? cartao('Ficha técnica — por 1 unidade de produto',`
      <form class="formgrid" id="ficha">
        <div>
          <label>Produto</label>
          <select name="produto">
            ${selectOpcoes(produtos,x=>x.id,x=>x.nome)}
          </select>
        </div>

        <div>
          <label>Ingrediente</label>
          <select name="ingrediente">
            ${selectOpcoes(
              ingredientes,
              x=>x.id,
              x=>`${x.nome} (${x.unidade})`
            )}
          </select>
        </div>

        <div>
          <label>Quantidade (0 para remover)</label>
          <input name="quantidade" type="number"
            step="0.001" min="0" required>
        </div>

        <button type="submit">Salvar ficha técnica</button>
      </form>`)
    : '';

  const criar = editar
    ? cartao('Nova ordem de produção',`
      <form id="nova-ordem" class="formgrid">
        <div>
          <label>Produto</label>
          <select name="produto">
            ${selectOpcoes(produtos,x=>x.id,x=>x.nome)}
          </select>
        </div>

        <div>
          <label>Unidades a produzir</label>
          <input name="quantidade" type="number"
            min="1" step="1" required>
        </div>

        <button type="submit">Criar ordem</button>
      </form>`)
    : '';

  const recLinhas = receitas.map(r => {
    const i = ingredientes.find(x=>x.id===r.ingrediente_id);

    return `<tr>
      <td>${esc(nomeProduto(r.produto_id,produtos))}</td>
      <td>${esc(i?.nome||'Não encontrado')}</td>
      <td>${r.quantidade} ${esc(i?.unidade||'')}</td>
    </tr>`;
  }).join('');

  ordens.sort((a,b)=>b.created_at.localeCompare(a.created_at));

  const ordLinhas = ordens.map(o => {
    const acoes = o.status==='pendente'&&editar
      ? [
          ['iniciada','Iniciar'],
          ['concluida','Concluir'],
          ['cancelada','Cancelar']
        ]
      : o.status==='iniciada'&&editar
        ? [
            ['concluida','Concluir'],
            ['cancelada','Cancelar']
          ]
        : [];

    return `<tr>
      <td>${dataBR(o.created_at)}</td>
      <td>${esc(nomeProduto(o.produto_id,produtos))}</td>
      <td>${o.quantidade}</td>
      <td>${badge(o.status)}</td>
      <td>
        <div class="acoes">
          ${acoes.map(([st,label])=>`
            <button class="small ${st==='cancelada'?'danger':''}"
              data-ordem="${o.id}"
              data-status="${st}">
              ${label}
            </button>
          `).join('')}
        </div>
      </td>
    </tr>`;
  }).join('');

  container(
    alterarReceita +
    cartao('Fichas técnicas cadastradas',tabela(
      ['Produto','Ingrediente','Quantidade por unidade'],
      recLinhas
    )) +
    criar +
    cartao('Ordens de produção',tabela(
      ['Data','Produto','Unidades','Status','Ações'],
      ordLinhas
    ))
  );

  form('ficha',async el => {
    if (
      !el.elements.produto.value ||
      !el.elements.ingrediente.value
    ) {
      throw new Error('Cadastre produtos e ingredientes primeiro.');
    }

    aviso(await rpc('api_definir_receita',{
      p_produto:el.elements.produto.value,
      p_ingrediente:el.elements.ingrediente.value,
      p_quantidade:Number(el.elements.quantidade.value)
    }));

    await carregarProducao();
  });

  form('nova-ordem',async el => {
    aviso('Ordem criada: '+await rpc('api_criar_producao',{
      p_doceria:tenant,
      p_produto:el.elements.produto.value,
      p_quantidade:Number(el.elements.quantidade.value)
    }));

    await carregarProducao();
  });

  document.querySelectorAll('[data-ordem]')
    .forEach(b=>b.addEventListener('click',async () => {
      if (!confirm(`Atualizar produção para ${b.dataset.status}?`)) {
        return;
      }

      try {
        aviso(await rpc('api_status_producao',{
          p_ordem:b.dataset.ordem,
          p_status:b.dataset.status
        }));

        await carregarProducao();

      } catch(err) {
        falha(err);
      }
    }));
}

// VITRINE

async function carregarVitrine() {
  const [produtos,pedidos] = await Promise.all([
    selecionar('produtos'),
    selecionar('pedidos')
  ]);

  const linhas = produtos
    .filter(p=>p.ativo)
    .map(p=>`
      <tr>
        <td>${esc(p.nome)}</td>
        <td>${reais(p.preco)}</td>
        <td>${p.estoque}</td>
        <td>${p.reservado}</td>
        <td><strong>${p.estoque-p.reservado}</strong></td>
      </tr>
    `).join('');

  const pedidosAtivos = pedidos
    .filter(p=>!['entregue','cancelado'].includes(p.status))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at));

  const lp = pedidosAtivos.map(p => `
    <tr>
      <td>${esc(p.cliente)}</td>
      <td>${reais(p.total)}</td>
      <td>${badge(p.status)}</td>
      <td>
        <div class="acoes">
          ${p.status!=='pronto'
            ? `<button data-pedido="${p.id}"
                 data-status="pronto" class="small sec">
                 Marcar pronto
               </button>`
            : ''}

          ${p.status==='pronto'
            ? `<button data-pedido="${p.id}"
                 data-status="entregue" class="small">
                 Entregar
               </button>`
            : ''}
        </div>
      </td>
    </tr>
  `).join('');

  container(
    cartao('Produtos da vitrine',tabela(
      ['Produto','Preço','Físico','Reservado','Disponível'],
      linhas
    )) +
    cartao('Separação e entrega',tabela(
      ['Cliente','Total','Status','Ações'],
      lp
    ))
  );

  document.querySelectorAll('[data-pedido]')
    .forEach(b=>b.addEventListener('click',async () => {
      try {
        aviso(await rpc('api_status_pedido',{
          p_pedido:b.dataset.pedido,
          p_status:b.dataset.status
        }));

        await carregarVitrine();

      } catch(err) {
        falha(err);
      }
    }));
}

// INICIAR

window.addEventListener('DOMContentLoaded',()=>{
  if (!window.supabase || !window.SALAMANDRAS_CONFIG) {
    aviso(
      'Biblioteca ou configuração não carregou. Confira config.js.',
      true
    );
    return;
  }

  (
    pagina==='login'
      ? iniciarLogin()
      : iniciarApp()
  ).catch(falha);
});
