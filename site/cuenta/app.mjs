import {mountAdmin} from '../admin/controller.mjs?v=7-listing-rules';
import * as client from './client.mjs';
mountAdmin({document,window,api:client,owner:true});
