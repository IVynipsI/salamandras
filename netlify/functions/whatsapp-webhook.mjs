import {createHmac,timingSafeEqual} from 'node:crypto';
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function signatureOK(body,value,secret){
 if(!secret||!value||!value.startsWith('sha256='))return false;
 const received=value.slice(7);
 if(!/^[a-f0-9]{64}$/i.test(received))return false;
 const expected=createHmac('sha256',secret).update(body).digest('hex');
 return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(received,'hex'));
}
async function rpc(name,args){
 const u=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(u.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!r.ok)throw Error('Supabase RPC HTTP '+r.status);
 return r.json();
}
async function send(phone,to,message){
 const token=process.env.META_WHATSAPP_TOKEN;
 const r=await fetch('https://graph.facebook.com/v23.0/'+encodeURIComponent(phone)+'/messages',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:message}})});
 if(!r.ok)throw Error('Meta send HTTP '+r.status);
}
export async function handler(event){
 if(event.httpMethod==='GET'){
  const p=event.queryStringParameters||{};
  if(p['hub.mode']==='subscribe'&&process.env.META_WEBHOOK_VERIFY_TOKEN&&
   p['hub.verify_token']===process.env.META_WEBHOOK_VERIFY_TOKEN)
   return {statusCode:200,headers:{'Content-Type':'text/plain'},body:p['hub.challenge']||''};
  return json(403,{error:'Invalid token'});
 }
 if(event.httpMethod!=='POST')return json(405,{error:'Method'});
 const body=event.body||'';
 if(!signatureOK(body,event.headers?.['x-hub-signature-256']||event.headers?.['X-Hub-Signature-256'],process.env.META_APP_SECRET))
  return json(403,{error:'Invalid signature'});
 if(!process.env.META_WHATSAPP_TOKEN||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_URL)
  return json(503,{error:'Configuration pending'});
 let payload;try{payload=JSON.parse(body)}catch{return json(400,{error:'Invalid JSON'})}
 for(const entry of payload.entry||[])for(const change of entry.changes||[]){
  for(const msg of change.value?.messages||[]){
   const from=msg.from,phone=change.value?.metadata?.phone_number_id;
   if(!from||!phone||!msg.id)continue;
   try{
    const state=await rpc('api_14_wa_inbound',{p_phone:String(phone),p_cliente:String(from)});
    if(!state?.empresa_id)continue;
    const message=String(msg.text?.body||msg.interactive?.button_reply?.id||'').trim();
    const cfg=await rpc('api_15_wa_resposta',{p_empresa:state.empresa_id});
    const choices=Array.isArray(cfg.menu)?cfg.menu:[];
    const menu=choices.map(o=>String(o.numero)+' — '+String(o.titulo||'')).join('\\n');
    const welcome=String(cfg.boas_vindas||'Olá! Seja bem-vindo(a)!');
    let answer='';
    if(state.responder) answer=welcome+'\\n\\n'+menu;
    else {
      const option=choices.find(o=>String(o.numero)===message);
      if(!option)answer=String(cfg.mensagem_invalida||'Digite uma opção do menu.')+'\\n\\n'+menu;
      else if(option.tipo==='menu')answer=welcome+'\\n\\n'+menu;
      else if(option.tipo==='humano')answer=String(option.resposta||cfg.mensagem_humano||'Um atendente continuará o atendimento.');
      else if(option.tipo==='catalogo'){
       const itens=Array.isArray(cfg.produtos)?cfg.produtos:[];
       const list=itens.map((p,i)=>(i+1)+'. '+String(p.nome)+' — R$ '+Number(p.preco||0).toFixed(2).replace('.',',')).join('\\n');
       const link=String(cfg.slug||'')?'\\nLoja: https://salamandras-sistem.netlify.app/loja.html?loja='+encodeURIComponent(cfg.slug):'';
       answer=String(option.resposta||'Nosso catálogo:')+'\\n'+(list||'Nenhum produto selecionado para o WhatsApp.')+link;
      } else answer=String(option.resposta||'Nossa equipe dará continuidade ao atendimento.');
    }
    if(answer)await send(phone,from,answer.slice(0,4096));
   }catch(e){console.error('WhatsApp handler failed:',e.message)}
  }
 }
 return json(200,{received:true});
}