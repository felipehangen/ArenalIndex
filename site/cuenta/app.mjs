import {mountAdmin} from '../admin/controller.mjs?v=4-workflow';
import * as client from './client.mjs';
mountAdmin({document,window,api:client,owner:true});
