#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createSequenceViewerAppMounter } from "./model-host-app-mount.mjs";
import {
  connectSequenceViewerClient,
  createSequenceViewerProxyServer,
  readProxyConfiguration,
  validateProxyRoots,
} from "./model-host-root-proxy-lib.mjs";

const configuration = readProxyConfiguration(process.argv.slice(2));
const roots = await validateProxyRoots(configuration);
const downstream = await connectSequenceViewerClient(roots);
const appMounter = roots.autoMountApp
  ? await createSequenceViewerAppMounter({
      client: downstream.client,
      runtimeRoot: roots.runtimeRoot,
      screenshotPath: roots.screenshotPath,
    })
  : undefined;
const server = createSequenceViewerProxyServer(
  downstream.client,
  roots.manifest,
  { appMounter },
);

let closing;
async function close() {
  if (closing == null) {
    closing = (async () => {
      await server.close().catch(() => undefined);
      await appMounter?.close();
      await downstream.close();
    })();
  }
  await closing;
}

server.onclose = () => {
  void (async () => {
    await appMounter?.close();
    await downstream.close();
  })();
};
server.onerror = (error) => {
  process.stderr.write(`Sequence Viewer qualification proxy: ${error.message}\n`);
};
downstream.client.onerror = (error) => {
  process.stderr.write(`Bundled Sequence Viewer server: ${error.message}\n`);
};
downstream.client.onclose = () => void server.close();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void close().finally(() => process.exit(0));
  });
}

await server.connect(new StdioServerTransport());
