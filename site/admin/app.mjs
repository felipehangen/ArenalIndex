import {mountAdmin} from './controller.mjs?v=7-listing-rules';
import {mountAccounts} from './accounts.mjs?v=3-listing-rules';
import {mountListingActions} from './actions.mjs?v=2-editor';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});
