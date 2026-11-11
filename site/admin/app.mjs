import {mountAnalytics} from './analytics.mjs?v=1';
import {mountAdmin} from './controller.mjs?v=13-simple-workflow';
import {mountAccounts} from './accounts.mjs?v=5-account-pages';
import {mountListingActions} from './actions.mjs?v=6-simple-workflow';
import {mountResources} from './resources.mjs?v=1';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});

mountAnalytics({document,window,controller});
mountResources({document,window});
