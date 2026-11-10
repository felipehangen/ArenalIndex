import {mountAnalytics} from './analytics.mjs?v=1';
import {mountAdmin} from './controller.mjs?v=9-resources';
import {mountAccounts} from './accounts.mjs?v=4-unique-names';
import {mountListingActions} from './actions.mjs?v=4-resources';
import {mountResources} from './resources.mjs?v=1';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});

mountAnalytics({document,window,controller});
mountResources({document,window});
