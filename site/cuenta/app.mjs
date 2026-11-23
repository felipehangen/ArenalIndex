import {mountAgreements} from './agreements.mjs?v=1';
import {mountOffers} from './offers.mjs?v=6';
import {mountAdmin} from '../admin/controller.mjs?v=18-owner-agreements';
import {mountBrokerResources} from './resources.mjs?v=2';
import * as client from './client.mjs';
const offers=mountOffers({document,window,api:client,onUnauthorized:()=>controller.expire()});
const agreements=mountAgreements({document,window,api:client,onUnauthorized:()=>controller.expire()});
const resources=mountBrokerResources({document,window});
const controller=mountAdmin({
  document,window,api:client,owner:true,
  onRecords:records=>{offers.setListings(records);agreements.setListings(records);},
  onSignedIn(identity){
    resources.setIdentity(identity);
    agreements.setIdentity(identity);
    offers.setIdentity(identity);
    if(window.location.hash==='#acuerdos')document.querySelector('[data-owner-panel="agreements"]').click();
    else if(window.location.hash==='#ofertas')document.querySelector('[data-owner-panel="offers"]').click();
    else offers.refresh();
  }
});
