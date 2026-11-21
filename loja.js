/* Salamandras: loja publica multi-doceria. Sem acesso direto às tabelas privadas. */
'use strict';

const LOJA_PADRAO = 'doceria-teste';
const FRASE_BOT = 'Olá, boa tarde, tenho interesse nos seus produtos!!';
const IMG_BOLO = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85';
const IMG_CHOCO = 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85';
const IMG_CENOURA = 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=900&q=85';
const IMG_PUDIM = 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85';
const IMG_COPO = 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85';
const IMG_BRIGADEIRO = 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=900&q=85';

const $ = id => document.getElementById(id);
let catalogoAtual = [];
let carrinhoAtual = [];
let whatsappAtual = '';
const brl = valor => Number(valor || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const escapeHTML = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function urlSegura(valor) {
  try {
    const u = new URL(String(valor || ''));
    return ['https:','http:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}
// Resolve a foto enviada no Salamandras Storage (ou uma URL antiga segura).
function resolverFoto(caminho) {
  const valor=String(caminho||'');
  if (/^[0-9a-f-]{36}\/(produtos|capa|local)\/[a-zA-Z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/.test(valor)) {
    const base=String(window.SALAMANDRAS_CONFIG?.url||'').replace(/\/$/,'');
    if(!base.startsWith('https://')) return '';
    return base+'/storage/v1/object/public/salamandras-publico/'+valor.split('/').map(encodeURIComponent).join('/');
  }
  return urlSegura(valor);
}
function fotoExemplo(nome) {
  const s = String(nome).toLocaleLowerCase('pt-BR');
  if (s.includes('cenoura')) return IMG_CENOURA;
  if (s.includes('pudim') || s.includes('flan')) return IMG_PUDIM;
  if (s.includes('copo') || s.includes('taça')) return IMG_COPO;
  if (s.includes('brigadeiro') || s.includes('chocolate')) return IMG_CHOCO;
  if (s.includes('morango')) return IMG_BRIGADEIRO;
  return IMG_BOLO;
}
function whatsappUrl(telefone, mensagem=FRASE_BOT) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (digitos.length < 12 || digitos.length > 13) return '';
  return 'https://wa.me/' + digitos + '?text=' + encodeURIComponent(mensagem);
}
function definirWhatsapp(telefone) {
  whatsappAtual = telefone || '';
  const link = whatsappUrl(telefone);
  document.querySelectorAll('[data-whatsapp]').forEach(a => {
    a.href = link || '#contato';
    if (link) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.classList.remove('desabilitado');
      a.removeAttribute('aria-disabled');
    } else {
      a.removeAttribute('target');
      a.classList.add('desabilitado');
      a.setAttribute('aria-disabled', 'true');
    }
  });
  $('telefone-visivel').textContent = link ? 'WhatsApp: +' + telefone : 'WhatsApp ainda não configurado';
}
function aviso(texto) {
  const el = $('aviso-catalogo');
  el.textContent = texto;
  el.hidden = false;
}
function esconderAviso() { $('aviso-catalogo').hidden = true; }

function desenharProdutos(produtos, telefone) {
  catalogoAtual = Array.isArray(produtos) ? produtos : [];
  carrinhoAtual = [];
  atualizarCarrinho();
  const grade = $('grade-produtos');
  grade.replaceChildren();
  if (!Array.isArray(produtos) || produtos.length === 0) {
    grade.innerHTML = '<div class="vazio"><h3>Novidades chegando 🍰</h3><p>Esta doceria ainda não publicou produtos ativos no cardápio.</p></div>';
    return;
  }
  produtos.forEach(produto => {
    const nome = String(produto.nome || 'Produto');
    const foto = resolverFoto(produto.imagem) || fotoExemplo(nome);
    const descricao = produto.descricao || 'Feito com carinho. Converse com a doceria para saber mais.';
    const link = whatsappUrl(telefone, FRASE_BOT + '\nTenho interesse em: ' + nome + '.');
    const card = document.createElement('article');
    card.className = 'produto';
    card.innerHTML = `
      <div class="produto-foto"><img alt="${escapeHTML(nome)}" loading="lazy" src="${escapeHTML(foto)}"></div>
      <div class="produto-corpo">
        <div class="produto-categoria">${escapeHTML(produto.categoria || 'Doce artesanal')}</div>
        <h3>${escapeHTML(nome)}</h3>
        ${produto.peso_tamanho ? `<span class="produto-peso">${escapeHTML(produto.peso_tamanho)}</span>` : ''}
        <p>${escapeHTML(descricao)}</p>
        <div class="preco-linha">
          <span class="preco">${brl(produto.preco)}</span>
          ${link ? `<a class="produto-link" target="_blank" rel="noopener noreferrer" href="${escapeHTML(link)}">Pedir ↗</a>` : ''}
        </div>
        <button type="button" class="adicionar-sacola" data-adicionar="${escapeHTML(produto.id || '')}">+ Adicionar à sacola</button>
      </div>`;
    const img = card.querySelector('img');
    img.addEventListener('error', () => {
      if (!img.dataset.tentouFallback) {
        img.dataset.tentouFallback = '1';
        img.src = IMG_BOLO;
      } else {
        img.hidden = true;
        img.parentElement.style.background = 'linear-gradient(140deg, #f7b8b4, #fce8b6)';
      }
    });
    grade.append(card);
  });
  colocarIconesSociais(grade);
}


function atualizarCarrinho() {
  const contador = $('carrinho-contagem');
  if (!contador) return;
  const qtd = carrinhoAtual.reduce((s,item)=>s+item.quantidade,0);
  contador.textContent = String(qtd);
  const linhas = $('linhas-carrinho');
  if (!linhas) return;
  if (!carrinhoAtual.length) {
    linhas.innerHTML = '<p class="muted">Sua sacola está vazia. Adicione um doce do cardápio.</p>';
  } else {
    linhas.innerHTML = carrinhoAtual.map(item => {
      const produto = catalogoAtual.find(p=>String(p.id)===String(item.id));
      if (!produto) return '';
      return `<div class="cart-item">
        <div><h3>${escapeHTML(produto.nome)}</h3>
        <small>${brl(produto.preco)} por unidade</small></div>
        <div class="cart-stepper">
          <button type="button" data-mudar="-1" data-id="${escapeHTML(item.id)}" aria-label="Diminuir ${escapeHTML(produto.nome)}">−</button>
          <strong>${item.quantidade}</strong>
          <button type="button" data-mudar="1" data-id="${escapeHTML(item.id)}" aria-label="Aumentar ${escapeHTML(produto.nome)}">+</button>
        </div>
      </div>`;
    }).join('');
  }
  const soma = carrinhoAtual.reduce((total,item)=>{
    const produto=catalogoAtual.find(p=>String(p.id)===String(item.id));
    return total+(Number(produto?.preco)||0)*item.quantidade;
  },0);
  $('total-carrinho').textContent=brl(soma);
  $('enviar-carrinho').disabled=!qtd || !whatsappUrl(whatsappAtual);
}
function abrirCarrinho() {
  $('painel-carrinho').hidden=false;
  document.body.style.overflow='hidden';
  $('titulo-carrinho').focus?.();
}
function fecharCarrinho() {
  $('painel-carrinho').hidden=true;
  document.body.style.overflow='';
}
function iniciarCarrinho() {
  $('abrir-carrinho').addEventListener('click',abrirCarrinho);
  document.querySelectorAll('[data-fechar-carrinho]').forEach(b=>b.addEventListener('click',fecharCarrinho));
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape') fecharCarrinho();
  });
  $('grade-produtos').addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-adicionar]');
    if (!btn) return;
    const p=catalogoAtual.find(x=>String(x.id)===btn.dataset.adicionar);
    if (!p) return;
    const item=carrinhoAtual.find(x=>String(x.id)===String(p.id));
    if (item) item.quantidade+=1;
    else carrinhoAtual.push({id:String(p.id),quantidade:1});
    atualizarCarrinho();
    abrirCarrinho();
  });
  $('linhas-carrinho').addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-mudar]');
    if (!btn) return;
    const item=carrinhoAtual.find(x=>x.id===btn.dataset.id);
    if (!item) return;
    item.quantidade+=Number(btn.dataset.mudar);
    if(item.quantidade<=0)carrinhoAtual=carrinhoAtual.filter(x=>x!==item);
    atualizarCarrinho();
  });
  $('enviar-carrinho').addEventListener('click',()=>{
    if(!carrinhoAtual.length)return;
    const linhas=carrinhoAtual.map(item=>{
      const p=catalogoAtual.find(x=>String(x.id)===item.id);
      return p?`${item.quantidade}x ${p.nome} (${brl(item.quantidade*Number(p.preco||0))})`:'';
    }).filter(Boolean);
    const total=carrinhoAtual.reduce((s,item)=>{
      const p=catalogoAtual.find(x=>String(x.id)===item.id);
      return s+(Number(p?.preco)||0)*item.quantidade;
    },0);
    const mensagem=FRASE_BOT+'\n\nQuero encomendar:\n'+linhas.join('\n')+
      '\nTotal estimado: '+brl(total)+'\nPodemos combinar a data e o horário de retirada?';
    const url=whatsappUrl(whatsappAtual,mensagem);
    if(url)window.open(url,'_blank','noopener,noreferrer');
  });
}

// Marca visual oficial nos links das redes (sem dependência de bibliotecas).
const ICONE_WHATSAPP = `<svg class="icone-social" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.48 0 .12 5.35.12 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.25-1.64a11.9 11.9 0 0 0 5.8 1.48h.01c6.59 0 11.96-5.36 11.96-11.95a11.87 11.87 0 0 0-3.5-8.41ZM12.06 21.8a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.7.97.99-3.6-.24-.37a9.8 9.8 0 0 1-1.5-5.25c0-5.42 4.42-9.83 9.85-9.83a9.76 9.76 0 0 1 6.97 2.9 9.77 9.77 0 0 1 2.89 6.96c0 5.43-4.42 9.83-9.9 9.8Zm5.4-7.35c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.66.15-.2.3-.77.97-.95 1.16-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.39-1.48-.88-.78-1.48-1.75-1.65-2.04-.17-.3-.02-.46.13-.6.14-.13.3-.34.44-.51.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.66-1.6-.9-2.18-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.52.07-.79.36-.27.3-1.04 1.02-1.04 2.48s1.06 2.87 1.2 3.07c.15.2 2.09 3.19 5.06 4.47.7.3 1.25.48 1.68.62.7.22 1.34.2 1.85.12.56-.08 1.77-.72 2.01-1.41.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.56-.35Z"/></svg>`;
const ICONE_INSTAGRAM = `<svg class="icone-social" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6.4" r="1.2" fill="currentColor"/></svg>`;
function colocarIconesSociais(raiz=document){
  raiz.querySelectorAll('a[data-whatsapp],a.produto-link').forEach(a=>{
    if(!a.querySelector('.icone-social'))a.insertAdjacentHTML('afterbegin',ICONE_WHATSAPP);
    a.classList.add('link-social');
  });
  raiz.querySelectorAll('#topo-instagram,#instagram-link,.nav-links a[href="#instagram"]').forEach(a=>{
    if(!a.querySelector('.icone-social'))a.insertAdjacentHTML('afterbegin',ICONE_INSTAGRAM);
    a.classList.add('link-social');
  });
}
function aplicarCorDoceria(cor){
  if(!/^#[0-9a-fA-F]{6}$/.test(String(cor||'')))return;
  document.documentElement.style.setProperty('--rosa',cor);
  const rgb=[1,3,5].map(i=>parseInt(cor.slice(i,i+2),16));
  const escura='#'+rgb.map(v=>Math.max(0,Math.round(v*.78)).toString(16).padStart(2,'0')).join('');
  document.documentElement.style.setProperty('--rosa-escuro',escura);
}

function configurarDoceria(doceria) {
  aplicarCorDoceria(doceria.cor_site);
  const nome = String(doceria.nome || 'Doceria');
  document.title = nome + ' | Bolos, doces e encomendas';
  $('marca-nome').textContent = nome;
  $('nome-contato').textContent = nome;
  $('rodape-nome').textContent = nome + ' • Confeitaria artesanal';
  if (doceria.descricao) $('descricao-hero').textContent = String(doceria.descricao);
  const capa = resolverFoto(doceria.imagem_capa);
  if (capa) $('foto-capa').src = capa;
  const local = resolverFoto(doceria.imagem_local);
  if (local) $('foto-local').src = local;
  if (doceria.endereco) {
    $('endereco-texto').textContent = String(doceria.endereco);
    $('mapa-link').hidden = false;
    $('mapa-link').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(doceria.endereco);
  }
  if (doceria.horario) $('horario-texto').textContent = String(doceria.horario);
  const instagram = urlSegura(doceria.instagram);
  if (instagram && /(^|\.)instagram\.com$/.test(new URL(instagram).hostname)) {
    $('topo-instagram').href = instagram;
    $('topo-instagram').hidden = false;
    $('instagram-link').href = instagram;
    $('instagram-link').target = '_blank';
    $('instagram-link').rel = 'noopener noreferrer';
    $('instagram-link').textContent = 'Seguir no Instagram';
    $('instagram-handle').textContent = '@' + new URL(instagram).pathname.split('/').filter(Boolean)[0];
    $('instagram-info').textContent = 'Acompanhe as novidades da nossa confeitaria!';
  } else {
    $('topo-instagram').hidden = true;
    $('instagram-link').hidden = true;
  }
  definirWhatsapp(doceria.whatsapp);
  colocarIconesSociais();
}

const produtosDemo = [
  {nome:'Bolo Vulcão de Chocolate',preco:85,descricao:'Bolo de chocolate com cobertura cremosa.',imagem:IMG_BOLO,categoria:'Bolos'},
  {nome:'Bolo de Aniversário',preco:65,descricao:'Feito para celebrar momentos especiais.',imagem:IMG_CENOURA,categoria:'Encomendas'},
  {nome:'Copo da Felicidade',preco:20,descricao:'Camadas deliciosas em uma sobremesa de copo.',imagem:IMG_COPO,categoria:'Sobremesas'},
  {nome:'Fatia de Bolo de Brigadeiro',preco:12,descricao:'Uma fatia para adoçar a tarde.',imagem:IMG_CHOCO,categoria:'Fatias'},
  {nome:'Pudim de Leite Condensado',preco:50,descricao:'Pudim cremoso com calda de caramelo.',imagem:IMG_PUDIM,categoria:'Sobremesas'},
  {nome:'Coxinha de Morango com Brigadeiro',preco:10,descricao:'Morango com brigadeiro e granulado.',imagem:IMG_BRIGADEIRO,categoria:'Docinhos'}
];

async function iniciar() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') {
    configurarDoceria({nome:'Doceria Teste',whatsapp:'5511966128275'});
    desenharProdutos(produtosDemo,'5511966128275');
    aviso('MODO DEMONSTRAÇÃO: estes produtos e valores são fictícios. Retire ?demo=1 para consultar o Supabase.');
    return;
  }

  const slug = (params.get('loja') || LOJA_PADRAO).toLowerCase().trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 90) {
    aviso('Endereço de doceria inválido.');
    return;
  }

  if (!window.supabase || !window.SALAMANDRAS_CONFIG?.url || !window.SALAMANDRAS_CONFIG?.key) {
    aviso('Não foi possível carregar a conexão. Confira o arquivo config.js.');
    return;
  }

  try {
    const db = window.supabase.createClient(
      window.SALAMANDRAS_CONFIG.url,
      window.SALAMANDRAS_CONFIG.key,
      { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } }
    );
    const {data,error} = await db.rpc('api_vitrine_publica',{p_slug:slug});
    if (error) throw error;
    if (!data?.doceria) {
      aviso('Esta página ainda não foi publicada. Confira o slug e a publicação da doceria no Supabase.');
      return;
    }
    configurarDoceria(data.doceria);
    desenharProdutos(data.produtos || [],data.doceria.whatsapp);
    esconderAviso();
  } catch(err) {
    console.error('Erro ao carregar vitrine:',err);
    aviso('Não foi possível carregar o catálogo agora. Confira a configuração do Supabase e o SQL 04.');
  }
}

document.addEventListener('DOMContentLoaded',()=>{colocarIconesSociais();iniciarCarrinho();iniciar();});