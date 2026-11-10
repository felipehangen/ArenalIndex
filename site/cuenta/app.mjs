import {mountAdmin} from '../admin/controller.mjs?v=6-google-locale';
import * as client from './client.mjs';
mountAdmin({document,window,api:client,owner:true});
