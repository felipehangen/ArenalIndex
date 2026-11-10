import {mountAnalytics} from './analytics.mjs?v=1';
import {mountAdmin} from './controller.mjs?v=11-workspace-demos';
import {mountAccounts} from './accounts.mjs?v=5-account-pages';
import {mountListingActions} from './actions.mjs?v=5-workspace-demos';
import {mountResources} from './resources.mjs?v=1';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});

mountAnalytics({document,window,controller});
mountResources({document,window});
