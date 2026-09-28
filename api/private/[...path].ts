import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleAcceptInvitation,
  handleFamilyBoard,
  handleHousehold,
  handleInvitations,
  handleSharing
} from '../../server/family-sharing/http.js';
import { handlePrivateApi } from '../../server/private-api/router.js';

type PrivateHandler = (
  request: VercelRequest,
  response: VercelResponse
) => Promise<void>;

const FAMILY_ROUTES: Readonly<Record<string, PrivateHandler>> = {
  'family-board': handleFamilyBoard,
  household: handleHousehold,
  'household/invitations': handleInvitations,
  'household/invitations/accept': handleAcceptInvitation,
  'household/sharing': handleSharing
};

function routePath(request: VercelRequest): string {
  const path = request.query.path;
  if (Array.isArray(path)) return path.join('/');
  return typeof path === 'string' ? path : '';
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  const familyHandler = FAMILY_ROUTES[routePath(request)];
  if (familyHandler) {
    await familyHandler(request, response);
    return;
  }
  await handlePrivateApi(request, response);
}
