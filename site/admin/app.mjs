import {mountAdmin} from './controller.mjs?v=3-account';
import {mountAccounts} from './accounts.mjs?v=2-account';
mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
