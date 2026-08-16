import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleHousehold } from '../../server/family-sharing/http.js';
export default (request: VercelRequest, response: VercelResponse) => handleHousehold(request, response);
