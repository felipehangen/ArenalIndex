import {mountAdmin} from './controller.mjs?v=4-workflow';
import {mountAccounts} from './accounts.mjs?v=2-account';
import {mountListingActions} from './actions.mjs?v=1';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});
