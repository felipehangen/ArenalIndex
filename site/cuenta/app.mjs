import {mountAdmin} from '../admin/controller.mjs?v=14-broker-tools';
import {mountBrokerResources} from './resources.mjs?v=1';
import * as client from './client.mjs';
const resources=mountBrokerResources({document,window});
mountAdmin({document,window,api:client,owner:true,onSignedIn:identity=>resources.setIdentity(identity)});
