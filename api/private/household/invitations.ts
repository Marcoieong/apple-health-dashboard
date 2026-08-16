import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleInvitations } from '../../../server/family-sharing/http.js';
export default (request: VercelRequest, response: VercelResponse) => handleInvitations(request, response);
