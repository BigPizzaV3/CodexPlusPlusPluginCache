function buildSemanticGraph(sampleCatalog, engine = "sqlserver", database, schema = "public") {
  const data = sampleCatalog?.[engine]?.schemas?.[database]?.[schema]?.tables || {};
  const nodes = [];
  const edges = [];

  Object.entries(data).forEach(([table, meta]) => {
    nodes.push({
      id: `${engine}.${database}.${schema}.${table}`,
      type: "table",
      containsPII: Boolean(meta.containsPII),
      rowCountHint: meta.rowCountHint,
    });
    for (const rel of meta.relationships || []) {
      edges.push({
        from: table,
        to: rel.target,
        via: rel.via,
        cardinality: rel.cardinality || "unknown",
        criticality: meta.containsPII ? "high" : "medium",
      });
    }
  });

  return { engine, database, schema, nodes, edges };
}

function rankCriticalPaths(graph) {
  return graph.edges
    .slice()
    .sort((a, b) => (a.criticality === "high" ? -1 : 1))
    .map((edge) => ({
      ...edge,
      riskHint: `${edge.from} -> ${edge.to} (${edge.cardinality || "unknown"})`,
    }));
  }

function summarize(graph) {
  const piiNodes = graph.nodes.filter((x) => x.containsPII).length;
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    piiNodeCount: piiNodes,
    criticalPaths: rankCriticalPaths(graph),
  };
}

module.exports = {
  buildSemanticGraph,
  rankCriticalPaths,
  summarize,
};

