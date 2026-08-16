import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFamilyBoard } from '../../server/family-sharing/http.js';
export default (request: VercelRequest, response: VercelResponse) => handleFamilyBoard(request, response);
