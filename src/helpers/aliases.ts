const HUB_URL = process.env.HUB_URL || 'https://hub.snapshot.org/graphql';

const HUB_TIMEOUT_MS = 3e3;
// Must match the sequencer's DEFAULT_ALIAS_EXPIRY_DAYS (helpers/alias.ts). also same as UI
const ALIAS_EXPIRY_DAYS = 90;

const ALIASES_QUERY = `
  query Aliases($address: String!, $alias: String!, $created_gt: Int) {
    aliases(
      where: { address: $address, alias: $alias, created_gt: $created_gt }
    ) {
      address
      alias
    }
  }`;

export async function isAliasOf(
  address: string,
  alias: string
): Promise<boolean> {
  const createdGt =
    Math.floor(Date.now() / 1e3) - ALIAS_EXPIRY_DAYS * 24 * 60 * 60;

  const res = await fetch(HUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ALIASES_QUERY,
      variables: { address, alias, created_gt: createdGt }
    }),
    signal: AbortSignal.timeout(HUB_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Hub responded with ${res.status}`);

  const body = await res.json();
  if (body.errors)
    throw new Error(body.errors[0]?.message || 'Hub returned GraphQL errors');
  if (!body.data) throw new Error('Hub returned no data');

  return (body.data.aliases?.length ?? 0) > 0;
}
