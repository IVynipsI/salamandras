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
const brl = valor => Number(valor || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const escapeHTML = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function urlSegura(valor) {
  try {
    const u = new URL(String(valor || ''));
    return ['https:','http:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
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
  const grade = $('grade-produtos');
  grade.replaceChildren();
  if (!Array.isArray(produtos) || produtos.length === 0) {
    grade.innerHTML = '<div class="vazio"><h3>Novidades chegando 🍰</h3><p>Esta doceria ainda não publicou produtos ativos no cardápio.</p></div>';
    return;
  }
  produtos.forEach(produto => {
    const nome = String(produto.nome || 'Produto');
    const foto = urlSegura(produto.imagem) || fotoExemplo(nome);
    const descricao = produto.descricao || 'Feito com carinho. Converse com a doceria para saber mais.';
    const link = whatsappUrl(telefone, FRASE_BOT + '\nTenho interesse em: ' + nome + '.');
    const card = document.createElement('article');
    card.className = 'produto';
    card.innerHTML = `
      <div class="produto-foto"><img alt="${escapeHTML(nome)}" loading="lazy" src="${escapeHTML(foto)}"></div>
      <div class="produto-corpo">
        <div class="produto-categoria">${escapeHTML(produto.categoria || 'Doce artesanal')}</div>
        <h3>${escapeHTML(nome)}</h3>
        <p>${escapeHTML(descricao)}</p>
        <div class="preco-linha">
          <span class="preco">${brl(produto.preco)}</span>
          ${link ? `<a class="produto-link" target="_blank" rel="noopener noreferrer" href="${escapeHTML(link)}">Pedir ↗</a>` : ''}
        </div>
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
}

function configurarDoceria(doceria) {
  const nome = String(doceria.nome || 'Doceria');
  document.title = nome + ' | Bolos, doces e encomendas';
  $('marca-nome').textContent = nome;
  $('nome-contato').textContent = nome;
  $('rodape-nome').textContent = nome + ' • Confeitaria artesanal';
  if (doceria.descricao) $('descricao-hero').textContent = String(doceria.descricao);
  const capa = urlSegura(doceria.imagem_capa);
  if (capa) $('foto-capa').src = capa;
  const local = urlSegura(doceria.imagem_local);
  if (local) $('foto-local').src = local;
  if (doceria.endereco) {
    $('endereco-texto').textContent = String(doceria.endereco);
    $('mapa-link').hidden = false;
    $('mapa-link').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(doceria.endereco);
  }
  if (doceria.horario) $('horario-texto').textContent = String(doceria.horario);
  const instagram = urlSegura(doceria.instagram);
  if (instagram && /(^|\.)instagram\.com$/.test(new URL(instagram).hostname)) {
    $('instagram-link').href = instagram;
    $('instagram-link').target = '_blank';
    $('instagram-link').rel = 'noopener noreferrer';
    $('instagram-link').textContent = 'Seguir no Instagram';
    $('instagram-handle').textContent = '@' + new URL(instagram).pathname.split('/').filter(Boolean)[0];
    $('instagram-info').textContent = 'Acompanhe as novidades da nossa confeitaria!';
  } else {
    $('instagram-link').hidden = true;
  }
  definirWhatsapp(doceria.whatsapp);
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

document.addEventListener('DOMContentLoaded',iniciar);