import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSharing } from '../../../server/family-sharing/http.js';
export default (request: VercelRequest, response: VercelResponse) => handleSharing(request, response);
