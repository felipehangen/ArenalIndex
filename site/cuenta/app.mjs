import {mountAdmin} from '../admin/controller.mjs?v=5-editor';
import * as client from './client.mjs';
mountAdmin({document,window,api:client,owner:true});
