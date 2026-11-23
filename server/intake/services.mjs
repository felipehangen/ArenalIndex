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
    async sendAgreement({recipient,replyTo,kind,language,property,broker,url,text,reference,version,termsHash,acceptance,acceptedAt,expiresAt,idempotencyKey}){
      const en=language==='en',invitation=kind==='invitation';
      const heading=invitation?(en?'Review our property agreement':'Revisá nuestro acuerdo para tu propiedad'):(en?'Your accepted agreement':'Tu acuerdo aceptado');
      const intro=invitation?(en?`${broker} invites you to review the terms for ${property}. Opening this email or link does not accept anything. Please review the complete terms before choosing to accept. The invitation expires on ${expiresAt}.`:`${broker} te invita a revisar los términos para ${property}. Abrir este correo o enlace no acepta nada. Revisá los términos completos antes de elegir aceptar. La invitación vence el ${expiresAt}.`):(en?`Acceptance recorded for ${property} on ${acceptedAt}. Name: ${acceptance.name}. Role: ${acceptance.capacity}. ${acceptance.consent}`:`Aceptación registrada para ${property} el ${acceptedAt}. Nombre: ${acceptance.name}. Rol: ${acceptance.capacity}. ${acceptance.consent}`);
      const footer=(en?'Private reference: ':'Referencia privada: ')+reference+'\n'+(en?'Version: ':'Versión: ')+version+'\nSHA-256: '+termsHash;
      return deliver({to:[recipient],reply_to:replyTo,subject:heading+' · '+property,text:intro+'\n\n'+url+'\n\n'+text+'\n\n'+footer,html:'<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#16352b;line-height:1.6"><p>arenal INDEX</p><h1>'+escape(heading)+'</h1><p>'+escape(intro)+'</p><p><a style="display:inline-block;padding:14px 22px;background:#175d46;color:#fff;border-radius:10px" href="'+escape(url)+'">'+(invitation?(en?'Review the agreement':'Revisar el acuerdo'):(en?'View and save your copy':'Ver y guardar tu copia'))+'</a></p><div style="white-space:pre-wrap">'+escape(text)+'</div><hr><p style="overflow-wrap:anywhere;font-size:12px;white-space:pre-wrap">'+escape(footer)+'</p></div>'},idempotencyKey,5000);
    },
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
