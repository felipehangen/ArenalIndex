import {mountAdmin} from './controller.mjs?v=2-portal';
import {mountInvitations} from './invitations.mjs';
import {mountAccounts} from './accounts.mjs';
mountAdmin({document,window,onSignedIn:async()=>{mountAccounts();await mountInvitations();}});
