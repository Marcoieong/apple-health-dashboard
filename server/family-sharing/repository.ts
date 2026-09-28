import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { FamilySession } from '../family-auth/session.js';
import type {
  HouseholdSnapshot,
  SharingScope
} from './contract.js';
import type { SharingGrant } from './access.js';

type Row = Record<string, unknown>;

function value(row: Row, key: string): string {
  const result = row[key];
  if (typeof result !== 'string') throw new Error('Unexpected database value.');
  return result;
}

function displayName(session: FamilySession): string {
  return (session.name?.trim() || session.email.split('@')[0] || '家庭成員').slice(0, 60);
}

function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function scopeArray(value: unknown): SharingScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SharingScope =>
    ['score', 'activity_status', 'sleep_status', 'weekly_direction', 'advice'].includes(
      String(item)
    )
  );
}

export class FamilySharingRepository {
  constructor(private readonly sql: NeonQueryFunction<false, false>) {}

  async snapshot(session: FamilySession): Promise<HouseholdSnapshot | undefined> {
    const membershipRows = await this.sql.query(
      `select h.id::text, h.name, me.role
       from family_household_members me
       join family_households h on h.id = me.household_id
       where me.owner_id = $1`,
      [session.ownerId]
    ) as Row[];
    const membership = membershipRows[0];
    if (!membership) return undefined;

    const householdId = value(membership, 'id');
    const role = value(membership, 'role') as 'owner' | 'member';
    const [members, invitations] = await Promise.all([
      this.sql.query(
        `select m.public_id::text as member_id, m.owner_id, m.display_name, m.role,
                coalesce(array_agg(g.scope) filter (where g.scope is not null), '{}') as shared_by_me
         from family_household_members m
         left join family_sharing_grants g
           on g.household_id = m.household_id
          and g.subject_owner_id = $2
          and g.viewer_owner_id = m.owner_id
         where m.household_id = $1::uuid
         group by m.public_id, m.owner_id, m.display_name, m.role, m.joined_at
         order by m.joined_at asc`,
        [householdId, session.ownerId]
      ),
      role === 'owner'
        ? this.sql.query(
            `select id::text, email, expires_at::text
             from family_household_invitations
             where household_id = $1::uuid
               and accepted_at is null and revoked_at is null and expires_at > now()
             order by created_at desc`,
            [householdId]
          )
        : Promise.resolve([])
    ]);

    return {
      household: { id: householdId, name: value(membership, 'name'), role },
      members: (members as Row[]).map((member) => ({
        memberId: value(member, 'member_id'),
        displayName: value(member, 'display_name'),
        role: value(member, 'role') as 'owner' | 'member',
        sharedByMe: scopeArray(member.shared_by_me),
        isCurrentUser: value(member, 'owner_id') === session.ownerId
      })),
      invitations: (invitations as Row[]).map((invitation) => ({
        id: value(invitation, 'id'),
        email: value(invitation, 'email'),
        expiresAt: new Date(value(invitation, 'expires_at')).toISOString()
      }))
    };
  }

  async createHousehold(session: FamilySession, name: string): Promise<HouseholdSnapshot> {
    const householdId = randomUUID();
    const result = await this.sql.transaction((tx) => [
      tx.query(
        `insert into family_households (id, name, created_by_owner_id)
         select $1::uuid, $2, $3
         where not exists (
           select 1 from family_household_members where owner_id = $3
         )
         returning id::text`,
        [householdId, name, session.ownerId]
      ),
      tx.query(
        `insert into family_household_members (
           household_id, owner_id, email, display_name, role
         )
         select $1::uuid, $2, $3, $4, 'owner'
         where exists (select 1 from family_households where id = $1::uuid)
         on conflict (owner_id) do nothing`,
        [householdId, session.ownerId, session.email.toLowerCase(), displayName(session)]
      )
    ]);
    if ((result[0] as Row[]).length !== 1) throw new Error('already_in_household');
    const snapshot = await this.snapshot(session);
    if (!snapshot) throw new Error('household_create_failed');
    return snapshot;
  }

  async createInvitation(
    session: FamilySession,
    email: string
  ): Promise<{ invitationId: string; token: string; expiresAt: string }> {
    const snapshot = await this.snapshot(session);
    if (!snapshot || snapshot.household.role !== 'owner') throw new Error('forbidden');
    if (email === session.email.toLowerCase()) throw new Error('invalid_invitation');

    const token = randomBytes(32).toString('base64url');
    const invitationId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.sql.query(
      `insert into family_household_invitations (
         id, household_id, email, token_hash, invited_by_owner_id, expires_at
       ) values ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz)`,
      [
        invitationId,
        snapshot.household.id,
        email,
        tokenDigest(token),
        session.ownerId,
        expiresAt
      ]
    );
    return { invitationId, token, expiresAt };
  }

  async acceptInvitation(session: FamilySession, token: string): Promise<HouseholdSnapshot> {
    const results = await this.sql.transaction((tx) => [
      tx.query(
        `select id::text, household_id::text, email
         from family_household_invitations
         where token_hash = $1 and accepted_at is null and revoked_at is null
           and expires_at > now()
         for update`,
        [tokenDigest(token)]
      ),
      tx.query(
        `insert into family_household_members (
           household_id, owner_id, email, display_name, role
         )
         select household_id, $2, $3, $4, 'member'
         from family_household_invitations
         where token_hash = $1 and lower(email) = lower($3)
           and accepted_at is null and revoked_at is null and expires_at > now()
         on conflict (owner_id) do nothing
         returning household_id::text`,
        [tokenDigest(token), session.ownerId, session.email, displayName(session)]
      ),
      tx.query(
        `update family_household_invitations
         set accepted_at = now()
         where token_hash = $1 and lower(email) = lower($2)
           and accepted_at is null and revoked_at is null and expires_at > now()
           and exists (
             select 1 from family_household_members
             where owner_id = $3
               and household_id = family_household_invitations.household_id
           )
         returning id::text`,
        [tokenDigest(token), session.email, session.ownerId]
      )
    ]);
    if ((results[1] as Row[]).length !== 1 || (results[2] as Row[]).length !== 1) {
      throw new Error('invitation_invalid_or_email_mismatch');
    }
    const snapshot = await this.snapshot(session);
    if (!snapshot) throw new Error('invitation_accept_failed');
    return snapshot;
  }

  async revokeInvitation(session: FamilySession, invitationId: string): Promise<void> {
    const result = await this.sql.query(
      `update family_household_invitations i
       set revoked_at = now()
       where i.id = $1::uuid and i.accepted_at is null and i.revoked_at is null
         and exists (
           select 1 from family_household_members m
           where m.household_id = i.household_id and m.owner_id = $2 and m.role = 'owner'
         )
       returning i.id::text`,
      [invitationId, session.ownerId]
    ) as Row[];
    if (result.length !== 1) throw new Error('not_found');
  }

  async updateSharing(
    session: FamilySession,
    viewerMemberId: string,
    scopes: SharingScope[]
  ): Promise<void> {
    const viewerRows = await this.sql.query(
      `select subject.household_id::text, viewer.owner_id
       from family_household_members subject
       join family_household_members viewer
         on viewer.household_id = subject.household_id
       where subject.owner_id = $1 and viewer.public_id = $2::uuid`,
      [session.ownerId, viewerMemberId]
    ) as Row[];
    const viewer = viewerRows[0];
    if (!viewer) throw new Error('forbidden');
    const householdId = value(viewer, 'household_id');
    const viewerOwnerId = value(viewer, 'owner_id');
    if (viewerOwnerId === session.ownerId) throw new Error('invalid_viewer');
    await this.sql.transaction((tx) => [
      tx.query(
        `delete from family_sharing_grants
         where household_id = $1::uuid and subject_owner_id = $2 and viewer_owner_id = $3`,
        [householdId, session.ownerId, viewerOwnerId]
      ),
      ...scopes.map((scope) => tx.query(
        `insert into family_sharing_grants (
           household_id, subject_owner_id, viewer_owner_id, scope
         ) values ($1::uuid, $2, $3, $4)`,
        [householdId, session.ownerId, viewerOwnerId, scope]
      ))
    ]);
  }

  async boardAccess(session: FamilySession): Promise<{
    household: { id: string; name: string };
    members: Array<{
      ownerId: string;
      memberId: string;
      displayName: string;
      isCurrentUser: boolean;
    }>;
    grants: SharingGrant[];
  } | undefined> {
    const snapshot = await this.snapshot(session);
    if (!snapshot) return undefined;
    const [memberRows, grants] = await Promise.all([
      this.sql.query(
        `select owner_id, public_id::text as member_id, display_name
         from family_household_members
         where household_id = $1::uuid
         order by joined_at asc`,
        [snapshot.household.id]
      ),
      this.sql.query(
        `select subject_owner_id, viewer_owner_id, scope
         from family_sharing_grants
         where household_id = $1::uuid and viewer_owner_id = $2`,
        [snapshot.household.id, session.ownerId]
      )
    ]) as [Row[], Row[]];
    return {
      household: { id: snapshot.household.id, name: snapshot.household.name },
      members: memberRows.map((member) => ({
        ownerId: value(member, 'owner_id'),
        memberId: value(member, 'member_id'),
        displayName: value(member, 'display_name'),
        isCurrentUser: value(member, 'owner_id') === session.ownerId
      })),
      grants: grants.map((grant) => ({
        subjectOwnerId: value(grant, 'subject_owner_id'),
        viewerOwnerId: value(grant, 'viewer_owner_id'),
        scope: value(grant, 'scope') as SharingScope
      }))
    };
  }
}

export function createFamilySharingRepository(databaseUrl: string): FamilySharingRepository {
  return new FamilySharingRepository(neon(databaseUrl));
}
