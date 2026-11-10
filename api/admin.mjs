import {createAdminHandler} from '../server/admin/core.mjs';
import {portalOptions,serve} from '../server/portal/config.mjs';
export const application=(env=process.env)=>createAdminHandler(portalOptions(env));
export default async function handler(req,res){return serve(req,res,application);}
