import {mountAnalytics} from './analytics.mjs?v=1';
import {mountAdmin} from './controller.mjs?v=8-analytics';
import {mountAccounts} from './accounts.mjs?v=3-listing-rules';
import {mountListingActions} from './actions.mjs?v=3-analytics';
const controller=mountAdmin({document,window,onSignedIn:()=>mountAccounts()});
mountListingActions({document,window,controller});

mountAnalytics({document,window,controller});
