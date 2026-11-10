import {createOwnerHandler} from '../server/portal/core.mjs';
import {portalOptions,serve} from '../server/portal/config.mjs';
export const application=(env=process.env)=>createOwnerHandler(portalOptions(env));
export default async function handler(req,res){return serve(req,res,application);}
