import {mountAdmin} from './controller.mjs?v=6-google-locale';
import {mountAccounts} from './accounts.mjs?v=2-account';
import {mountListingActions} from './actions.mjs?v=2-editor';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});
