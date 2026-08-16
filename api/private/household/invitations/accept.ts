import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAcceptInvitation } from '../../../../server/family-sharing/http.js';
export default (request: VercelRequest, response: VercelResponse) => handleAcceptInvitation(request, response);
