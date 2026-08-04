# mcp-opentreeoflife

Open Tree of Life MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `match_names` | Resolve scientific (Latin binomial) names to Open Tree of Life taxon IDs (ott_id). The ott_id is the key needed by taxon_info and common_ancestor — start here. Returns the best match per name with its ott_id, accepted name, rank, and synonym/approximate flags. Keyless. |
| `taxon_info` | Get full details for an Open Tree of Life taxon by ott_id (from match_names) — accepted name, rank, unique name, synonyms, source taxonomy, and the complete ancestry lineage from this taxon up to the root of life. Keyless. |
| `common_ancestor` | Find the most recent common ancestor (MRCA) of 2-10 taxa in the synthetic Tree of Life, by ott_id (from match_names). Returns the common-ancestor taxon (ott_id, name, rank). Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "opentreeoflife": {
      "url": "https://gateway.pipeworx.io/opentreeoflife/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Opentreeoflife data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
