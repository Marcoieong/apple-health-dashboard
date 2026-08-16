import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { loadHealthReadConfig } from '../health-sync/config.js';
import { listPrivateHealthDays } from '../health-sync/productionRepository.js';
import { assertSameOriginJsonMutation, requireFamilySession } from '../family-auth/request.js';
import { boardDateRange, buildFamilyBoardMember, makeFamilyBoardResponse } from './board.js';
import {
  acceptInvitationInputSchema,
  createHouseholdInputSchema,
  createInvitationInputSchema,
  revokeInvitationInputSchema,
  updateSharingInputSchema
} from './contract.js';
import { createFamilySharingRepository } from './repository.js';

function sendError(response: VercelResponse, reason: unknown): void {
  const code = reason instanceof Error ? reason.message : 'server_error';
  if (reason instanceof ZodError || code.startsWith('invalid_')) {
    response.status(400).json({ error: 'invalid_input' });
  } else if (code === 'unauthorized') {
    response.status(401).json({ error: 'unauthorized' });
  } else if (code === 'forbidden') {
    response.status(403).json({ error: 'forbidden' });
  } else if (code === 'not_found') {
    response.status(404).json({ error: 'not_found' });
  } else if (code === 'already_in_household') {
    response.status(409).json({ error: 'already_in_household' });
  } else if (code === 'invitation_invalid_or_email_mismatch') {
    response.status(400).json({ error: code });
  } else {
    response.status(500).json({ error: 'server_error' });
  }
}

function method(request: VercelRequest): string {
  return request.method?.toUpperCase() ?? '';
}

export async function handleHousehold(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  try {
    const { config, session } = await requireFamilySession(request);
    const repository = createFamilySharingRepository(loadHealthReadConfig().databaseUrl);
    if (method(request) === 'GET') {
      const snapshot = await repository.snapshot(session);
      response.status(snapshot ? 200 : 404).json(snapshot ?? { error: 'household_not_found' });
      return;
    }
    if (method(request) === 'POST') {
      assertSameOriginJsonMutation(request, config);
      response.status(201).json(await repository.createHousehold(
        session, createHouseholdInputSchema.parse(request.body).name
      ));
      return;
    }
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ error: 'method_not_allowed' });
  } catch (reason) { sendError(response, reason); }
}

export async function handleInvitations(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  try {
    const { config, session } = await requireFamilySession(request);
    assertSameOriginJsonMutation(request, config);
    const repository = createFamilySharingRepository(loadHealthReadConfig().databaseUrl);
    if (method(request) === 'POST') {
      const input = createInvitationInputSchema.parse(request.body);
      response.status(201).json(await repository.createInvitation(session, input.email));
      return;
    }
    if (method(request) === 'DELETE') {
      const input = revokeInvitationInputSchema.parse(request.body);
      await repository.revokeInvitation(session, input.invitationId);
      response.status(204).end();
      return;
    }
    response.setHeader('Allow', 'POST, DELETE');
    response.status(405).json({ error: 'method_not_allowed' });
  } catch (reason) { sendError(response, reason); }
}

export async function handleAcceptInvitation(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  try {
    if (method(request) !== 'POST') {
      response.setHeader('Allow', 'POST'); response.status(405).json({ error: 'method_not_allowed' }); return;
    }
    const { config, session } = await requireFamilySession(request);
    assertSameOriginJsonMutation(request, config);
    const repository = createFamilySharingRepository(loadHealthReadConfig().databaseUrl);
    response.status(200).json(await repository.acceptInvitation(
      session, acceptInvitationInputSchema.parse(request.body).token
    ));
  } catch (reason) { sendError(response, reason); }
}

export async function handleSharing(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  try {
    if (method(request) !== 'PUT') {
      response.setHeader('Allow', 'PUT'); response.status(405).json({ error: 'method_not_allowed' }); return;
    }
    const { config, session } = await requireFamilySession(request);
    assertSameOriginJsonMutation(request, config);
    const input = updateSharingInputSchema.parse(request.body);
    const repository = createFamilySharingRepository(loadHealthReadConfig().databaseUrl);
    await repository.updateSharing(session, input.viewerMemberId, input.scopes);
    response.status(200).json({ updated: true });
  } catch (reason) { sendError(response, reason); }
}

export async function handleFamilyBoard(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  try {
    if (method(request) !== 'GET') {
      response.setHeader('Allow', 'GET'); response.status(405).json({ error: 'method_not_allowed' }); return;
    }
    const { session } = await requireFamilySession(request);
    const healthConfig = loadHealthReadConfig();
    const repository = createFamilySharingRepository(healthConfig.databaseUrl);
    const access = await repository.boardAccess(session);
    if (!access) { response.status(404).json({ error: 'household_not_found' }); return; }
    const range = boardDateRange();
    const members = (await Promise.all(access.members.map(async (member) => {
      const visible = member.isCurrentUser || access.grants.some(
        (grant) => grant.subjectOwnerId === member.ownerId && grant.viewerOwnerId === session.ownerId
      );
      if (!visible) return undefined;
      const days = await listPrivateHealthDays(member.ownerId, range.from, range.to, healthConfig);
      return buildFamilyBoardMember({
        ...member,
        viewerOwnerId: session.ownerId,
        grants: access.grants,
        days
      });
    }))).filter((member): member is NonNullable<typeof member> => Boolean(member));
    response.status(200).json(makeFamilyBoardResponse({ household: access.household, members }));
  } catch (reason) { sendError(response, reason); }
}
