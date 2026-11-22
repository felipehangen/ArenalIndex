const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createMailer({key,from,to,fetcher=fetch}){
  async function deliver(payload,idempotencyKey,timeout=20000){
    const response=await fetcher('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
      body:JSON.stringify({from,...payload}),
      signal:AbortSignal.timeout(timeout)
    });
    if(!response.ok)throw Error('Email delivery request failed');
    return response.json();
  }
  return {
    async send(message){
      return deliver({
        to:[to],subject:'Lista para revisión de publicación · '+message.title,
        text:message.title+'\nVersión '+message.version+' · '+message.fileCount+' archivos.\n\nRevisá la ficha y el anuncio preparado antes de aprobar:\n'+message.url+'\n\nEl enlace es privado y vence en 7 días. Abrirlo no aprueba ni publica la ficha.',
        html:'<h2>Lista para revisión de publicación</h2><p>'+escape(message.title)+'</p><p>Versión '+message.version+' · '+message.fileCount+' archivos.</p><p><a href="'+escape(message.url)+'">Revisar la ficha y decidir</a></p><p>El enlace es privado y vence en 7 días. Abrirlo no aprueba ni publica la ficha.</p>'
      },message.idempotencyKey);
    },
    async sendOfferNotice({recipient,property,amount,url,idempotencyKey}){
      const subject='Nueva oferta · '+property;
      return deliver({
        to:[recipient],subject,
        text:'Recibiste una oferta de '+amount+' por '+property+'.\n\nAbrí Ofertas en tu cuenta para ver los detalles y responderle al comprador.\n'+url,
        html:'<h2>Recibiste una nueva oferta</h2><p>Ofrecen <strong>'+escape(amount)+'</strong> por '+escape(property)+'.</p><p><a href="'+escape(url)+'">Ver ofertas en mi cuenta</a></p>'
      },idempotencyKey,5000);
    }
  };
}
