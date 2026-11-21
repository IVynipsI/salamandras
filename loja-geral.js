'use strict';
(async()=>{
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
 const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const slug=new URL(location.href).searchParams.get('loja')||'';
 const db=window.supabase?.createClient(window.SALAMANDRAS_CONFIG?.url,window.SALAMANDRAS_CONFIG?.key);
 const cart=[];let produtos=[],doceria={};$('ano').textContent=new Date().getFullYear();
 if(!db||!slug){$('status').textContent='Loja não configurada.';return}
 try{
  const {data,error}=await db.rpc('api_vitrine_publica',{p_slug:slug});if(error)throw error;
  if(!data?.doceria)throw new Error('Esta loja não está publicada ou não existe.');
  doceria=data.doceria;produtos=data.produtos||[];document.title=doceria.nome+' | Loja virtual';
  $('marca').textContent=doceria.nome;$('rodape-marca').textContent=doceria.nome;
  $('titulo-principal').textContent='Conheça nossa seleção de produtos';
  $('descricao-loja').textContent=doceria.descricao||'Qualidade e praticidade em cada compra.';
  $('sobre').textContent=doceria.descricao||'Veja nossos produtos e entre em contato.';
  if(/^#[0-9a-fA-F]{6}$/.test(doceria.cor_site||''))document.documentElement.style.setProperty('--acento',doceria.cor_site);
  if(doceria.imagem_capa && /^[0-9a-f-]{36}\/capa\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(doceria.imagem_capa)){
   const url=db.storage.from('salamandras-publico').getPublicUrl(doceria.imagem_capa).data.publicUrl;
   $('banner-imagem').style.backgroundImage=`linear-gradient(90deg,#143a2810,#15372558),url("${url}")`;
  }
  const links=[];
  const tel=String(doceria.whatsapp||'').replace(/\D/g,'');
  if(tel.length>=12&&tel.length<=15)links.push(`<a target="_blank" rel="noopener" href="https://wa.me/${tel}">WhatsApp ↗</a>`);
  if(/^https:\/\/(www\.)?instagram\.com\//i.test(doceria.instagram||''))links.push(`<a target="_blank" rel="noopener" href="${esc(doceria.instagram)}">Instagram ↗</a>`);
  $('contatos').innerHTML=links.join(' · ');
  $('status').textContent=produtos.length+' produto(s)';
  const categorias=[...new Set(produtos.map(p=>p.categoria).filter(Boolean))].sort();
  $('categoria').innerHTML='<option value="">Todas as categorias</option>'+categorias.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  function foto(p){
   if(!p.imagem||!/^[0-9a-f-]{36}\/produtos\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(p.imagem))return '<div class="produto-placeholder">▣</div>';
   const url=db.storage.from('salamandras-publico').getPublicUrl(p.imagem).data.publicUrl;
   return `<img class="produto-imagem" loading="lazy" src="${esc(url)}" alt="${esc(p.nome)}">`;
  }
  function desenhar(){
   const busca=$('pesquisar').value.trim().toLocaleLowerCase('pt-BR'),cat=$('categoria').value;
   const itens=produtos.filter(p=>(!cat||p.categoria===cat)&&(!busca||String(p.nome+' '+(p.descricao||'')).toLocaleLowerCase('pt-BR').includes(busca)));
   $('lista-produtos').innerHTML=itens.map(p=>`<article class="produto">${foto(p)}<div class="produto-detalhes">
     <small>${esc(p.categoria||'Produto')}</small><h3>${esc(p.nome)}</h3><p>${esc(p.descricao||p.peso_tamanho||'')}</p>
     <strong>${money(p.preco)}</strong><button type="button" data-adicionar="${esc(p.id)}">Adicionar ao carrinho</button></div></article>`).join('')||'<p>Nenhum produto encontrado.</p>';
   document.querySelectorAll('[data-adicionar]').forEach(b=>b.addEventListener('click',()=>{
     const p=produtos.find(x=>x.id===b.dataset.adicionar);if(!p)return;
     const atual=cart.find(x=>x.id===p.id);if(atual)atual.qtd++;else cart.push({id:p.id,nome:p.nome,preco:Number(p.preco),qtd:1});
     mostrarCarrinho();
   }));
  }
  function mostrarCarrinho(){
    $('contagem').textContent=cart.reduce((s,x)=>s+x.qtd,0);
    $('carrinho-itens').innerHTML=cart.map((p,i)=>`<div class="item-carrinho"><div class="texto"><b>${esc(p.nome)} × ${p.qtd}</b><small>${money(p.preco*p.qtd)}</small></div>
     <button type="button" data-remover="${i}" aria-label="Remover um item">−</button></div>`).join('')||'<p>Seu carrinho está vazio.</p>';
    $('total-carrinho').textContent=money(cart.reduce((s,p)=>s+p.preco*p.qtd,0));
    document.querySelectorAll('[data-remover]').forEach(b=>b.addEventListener('click',()=>{
      const i=Number(b.dataset.remover);if(cart[i]){cart[i].qtd--;if(cart[i].qtd<=0)cart.splice(i,1)}mostrarCarrinho();
    }));
  }
  $('abrir-carrinho').addEventListener('click',()=>{$('carrinho').showModal();mostrarCarrinho()});
  $('fechar-carrinho').addEventListener('click',()=>$('carrinho').close());
  $('enviar-carrinho').addEventListener('click',()=>{
    if(!cart.length){alert('Adicione algum produto.');return}
    if(!(tel.length>=12&&tel.length<=15)){alert('Esta loja ainda não cadastrou WhatsApp.');return}
    const soma=cart.reduce((s,p)=>s+p.preco*p.qtd,0);
    const texto=`Olá! Gostaria de consultar a disponibilidade destes produtos da ${doceria.nome}:\n\n${cart.map(x=>`${x.qtd}× ${x.nome} — ${money(x.qtd*x.preco)}`).join('\n')}\n\nTotal informado: ${money(soma)}`;
    window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(texto),'_blank','noopener,noreferrer');
  });
  $('pesquisar').addEventListener('input',desenhar);$('categoria').addEventListener('change',desenhar);desenhar();
 }catch(err){$('status').textContent=err?.message||'Erro ao carregar a loja.';console.error(err)}
})();