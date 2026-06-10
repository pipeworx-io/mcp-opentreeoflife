interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Open Tree of Life MCP.
 *
 * Keyless phylogenetics from the Open Tree of Life synthetic Tree of Life
 * (api.opentreeoflife.org/v3). Resolve scientific names to OTT taxon IDs,
 * pull a taxon's full ancestry lineage, and find the most recent common
 * ancestor (MRCA) of a set of taxa across the entire tree of life.
 */


const BASE = 'https://api.opentreeoflife.org/v3';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'match_names',
    description:
      "Resolve scientific (Latin binomial) names to Open Tree of Life taxon IDs (ott_id). The ott_id is the key needed by taxon_info and common_ancestor — start here. Returns the best match per name with its ott_id, accepted name, rank, and synonym/approximate flags. Keyless.",
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Scientific names to resolve, e.g. ["Quercus alba","Panthera leo"]. Max 20.',
        },
      },
      required: ['names'],
    },
  },
  {
    name: 'taxon_info',
    description:
      'Get full details for an Open Tree of Life taxon by ott_id (from match_names) — accepted name, rank, unique name, synonyms, source taxonomy, and the complete ancestry lineage from this taxon up to the root of life. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        ott_id: {
          type: 'number',
          description: 'OTT taxon id, e.g. 770315. Get it from match_names.',
        },
      },
      required: ['ott_id'],
    },
  },
  {
    name: 'common_ancestor',
    description:
      'Find the most recent common ancestor (MRCA) of 2-10 taxa in the synthetic Tree of Life, by ott_id (from match_names). Returns the common-ancestor taxon (ott_id, name, rank). Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        ott_ids: {
          type: 'array',
          items: { type: 'number' },
          description:
            'OTT taxon ids to find the common ancestor of, e.g. [770315,417950]. 2-10 ids, from match_names.',
        },
      },
      required: ['ott_ids'],
    },
  },
];

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { __error: `opentreeoflife: ${res.status} ${(await res.text()).slice(0, 200)}` };
  }
  return res.json();
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'match_names':
        return matchNames(args);
      case 'taxon_info':
        return taxonInfo(args);
      case 'common_ancestor':
        return commonAncestor(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

async function matchNames(args: Record<string, unknown>): Promise<unknown> {
  const raw = Array.isArray(args.names) ? args.names : [];
  const names = raw.map((n) => String(n).trim()).filter(Boolean).slice(0, 20);
  if (names.length === 0) return { error: 'provide a non-empty names array of scientific names' };

  const data = await post('/tnrs/match_names', { names });
  const obj = asObj(data);
  if (!obj) return { error: 'unexpected response' };
  if (obj.__error) return { error: obj.__error };

  const results = Array.isArray(obj.results) ? obj.results : [];
  const matches = results.map((r) => {
    const result = asObj(r) ?? {};
    const query = result.name;
    const ms = Array.isArray(result.matches) ? result.matches : [];
    const first = asObj(ms[0]);
    if (!first) return { query, matched: null };
    const taxon = asObj(first.taxon) ?? {};
    return {
      query,
      matched: {
        ott_id: taxon.ott_id,
        name: taxon.name,
        rank: taxon.rank,
        is_synonym: first.is_synonym,
        is_approximate: first.is_approximate_match,
        score: first.score,
        unique_name: taxon.unique_name,
      },
    };
  });

  return {
    count: matches.length,
    matches,
    unmatched: Array.isArray(obj.unmatched_names) ? obj.unmatched_names : [],
  };
}

async function taxonInfo(args: Record<string, unknown>): Promise<unknown> {
  const ottId = typeof args.ott_id === 'number' ? args.ott_id : Number(args.ott_id);
  if (!Number.isFinite(ottId)) return { error: 'provide a numeric ott_id (get it from match_names)' };

  const data = await post('/taxonomy/taxon_info', { ott_id: ottId, include_lineage: true });
  const obj = asObj(data);
  if (!obj) return { error: 'unexpected response' };
  if (obj.__error) return { error: obj.__error };

  const lineageRaw = Array.isArray(obj.lineage) ? obj.lineage : [];
  const synonyms = Array.isArray(obj.synonyms) ? obj.synonyms : [];

  return {
    ott_id: obj.ott_id,
    name: obj.name,
    rank: obj.rank,
    unique_name: obj.unique_name,
    synonyms: synonyms.slice(0, 15),
    source: obj.source,
    lineage: lineageRaw.map((a) => {
      const anc = asObj(a) ?? {};
      return { ott_id: anc.ott_id, name: anc.name, rank: anc.rank };
    }),
    tax_sources: obj.tax_sources,
  };
}

async function commonAncestor(args: Record<string, unknown>): Promise<unknown> {
  const raw = Array.isArray(args.ott_ids) ? args.ott_ids : [];
  const ottIds = raw.map((n) => Number(n)).filter((n) => Number.isFinite(n)).slice(0, 10);
  if (ottIds.length < 2) {
    return { error: 'provide 2-10 numeric ott_ids (get them from match_names)' };
  }

  const data = await post('/tree_of_life/mrca', { ott_ids: ottIds });
  const obj = asObj(data);
  if (!obj) return { error: 'unexpected response' };
  if (obj.__error) return { error: obj.__error };

  const mrca = asObj(obj.mrca) ?? {};
  // When the MRCA node is itself a named taxon, it's under mrca.taxon.
  // When the MRCA is an unnamed internal node, the nearest named ancestor is
  // returned at the top level as nearest_taxon.
  const mrcaTaxon = asObj(mrca.taxon);
  const nearest = asObj(obj.nearest_taxon);
  const t = mrcaTaxon ?? nearest;

  return {
    input_ott_ids: ottIds,
    mrca: t
      ? {
          ott_id: t.ott_id,
          name: t.name,
          rank: t.rank,
          unique_name: t.unique_name,
        }
      : null,
    // true when the MRCA node has no named taxon and we fell back to the
    // nearest named ancestor (mrca is a more recent unnamed internal node).
    nearest_named_fallback: !mrcaTaxon && !!nearest,
    node_id: mrca.node_id,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
