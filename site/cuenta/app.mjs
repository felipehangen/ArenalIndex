import {mountOffers} from './offers.mjs?v=2';
import {mountAdmin} from '../admin/controller.mjs?v=16-simple-offers';
import {mountBrokerResources} from './resources.mjs?v=1';
import * as client from './client.mjs';
const offers=mountOffers({document,window,api:client,onUnauthorized:()=>controller.expire()});
const resources=mountBrokerResources({document,window});
const controller=mountAdmin({document,window,api:client,owner:true,onRecords:records=>offers.setListings(records),onSignedIn:identity=>{resources.setIdentity(identity);offers.setIdentity(identity);}});
