import {createRemoteJWKSet,jwtVerify} from 'jose';

const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function createGoogleVerifier({clientId,keys=googleKeys,now=()=>new Date()}){
  return async (credential,nonce)=>{
    const {payload}=await jwtVerify(credential,keys,{
      audience:clientId,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],
      requiredClaims:['sub','iat','exp','email','email_verified','nonce'],maxTokenAge:'10m',currentDate:now()
    });
    if(payload.email_verified!==true||payload.nonce!==nonce||typeof payload.email!=='string'||
      typeof payload.sub!=='string'||!payload.sub||payload.azp&&payload.azp!==clientId)throw Error('Invalid Google identity');
    return {subject:payload.sub,email:payload.email.toLowerCase()};
  };
}
