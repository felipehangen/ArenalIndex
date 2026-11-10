import {mountAdmin} from '../admin/controller.mjs?v=7-listing-rules';
import * as client from './client.mjs';
mountAdmin({document,window,api:client,owner:true,onSignedIn(identity){const link=document.getElementById('account-public-page');link.hidden=!identity.publicPage;if(identity.publicPage)link.href=identity.publicPage.url;else link.removeAttribute('href');}});
