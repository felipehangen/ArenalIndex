const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createMailer({key,from,to,fetcher=fetch}){
  return {async send(message){
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':message.idempotencyKey},body:JSON.stringify({
      from,to:[to],subject:'Lista para revisión de publicación · '+message.title,
      text:message.title+'\nVersión '+message.version+' · '+message.fileCount+' archivos.\n\nRevisá la ficha y el anuncio preparado antes de aprobar:\n'+message.url+'\n\nEl enlace es privado y vence en 7 días. Abrirlo no aprueba ni publica la ficha.',
      html:'<h2>Lista para revisión de publicación</h2><p>'+escape(message.title)+'</p><p>Versión '+message.version+' · '+message.fileCount+' archivos.</p><p><a href="'+escape(message.url)+'">Revisar la ficha y decidir</a></p><p>El enlace es privado y vence en 7 días. Abrirlo no aprueba ni publica la ficha.</p>'
    }),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Email delivery request failed');
    return response.json();
  }};
}
