import {mountAdmin} from './controller.mjs?v=5-editor';
import {mountAccounts} from './accounts.mjs?v=2-account';
import {mountListingActions} from './actions.mjs?v=2-editor';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});
