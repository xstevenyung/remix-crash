import { ActionFunction, LoaderFunction, json } from "remix";
import { SourceMapConsumer } from "source-map";
import { CORSResponse } from "./utils";
import { readFile } from "fs/promises";
import axios from "axios";

async function getFileContent(pathOrURL: string): Promise<string> {
  const isRemote = new RegExp(/^http(s)?:\/\//).test(pathOrURL);

  if (isRemote) {
    return axios.get(pathOrURL).then((response) => response.data);
  }

  return readFile(pathOrURL, { encoding: "utf-8" });
}

async function extractSourceMap(data: string, pathOrURL: string) {
  let sourceMapResult;

  sourceMapResult = new RegExp(
    /\n\/\/\# sourceMappingURL\=data\:application\/json\;base64\,(.*)/,
    "g"
  ).exec(data);

  if (sourceMapResult?.length) {
    const [_, base64SourceMap] = sourceMapResult;

    return JSON.parse(Buffer.from(base64SourceMap, "base64").toString("utf-8"));
  }

  sourceMapResult = new RegExp(
    /\/\/\# sourceMappingURL\=(\/(.*)\.map)/,
    "g"
  ).exec(data);

  if (sourceMapResult?.length) {
    const bundledFileURL = new URL(pathOrURL);
    const [_, sourceMapPath] = sourceMapResult;

    const rawSourceMap = await axios
      .get(sourceMapPath, { baseURL: bundledFileURL.origin })
      .then((response) => response.data);

    return rawSourceMap;
  }

  return null;
}

export const loader: LoaderFunction = () => {
  if (process.env.NODE_ENV !== "development") {
    throw new Response(null, { status: 404 });
  }

  return new CORSResponse();
};

export const action: ActionFunction = async ({ request }) => {
  if (process.env.NODE_ENV !== "development") {
    throw new Response(null, { status: 404 });
  }

  const url = new URL(request.url);
  const root = process.cwd();

  let bundledFile = url.searchParams.get("file");

  // The bundledFile path i get here is wrong on some files (because it is composed by 2 file urls)
  // and the first is the evil one, ex: process.cwd() + 'build\\route:'
  // console.log(bundledFile) yelds:
  // C:\Users\daviz\remix-jokes\build\route:C:\daviz\remix-jokes\app\routes\index.tsx
  // The stacktrace seems malformed (first line in this example):
  /**
   *
   * Error: stfghdhg
    at Index (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\build\route:C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\app\routes\index.tsx:22:9)
    at processChild (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\react-dom\cjs\react-dom-server.node.development.js:3353:14)
    at resolve (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\react-dom\cjs\react-dom-server.node.development.js:3270:5)
    at ReactDOMServerRenderer.render (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\react-dom\cjs\react-dom-server.node.development.js:3753:22)
    at ReactDOMServerRenderer.read (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\react-dom\cjs\react-dom-server.node.development.js:3690:29)
    at renderToString (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\react-dom\cjs\react-dom-server.node.development.js:4298:27)
    at handleRequest (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\app\entry.server.tsx:11:18)
    at renderDocumentRequest (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\@remix-run\server-runtime\server.js:404:18)
    at requestHandler (C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\@remix-run\server-runtime\server.js:55:20)
    at C:\Users\Win 10\Documents\coding\playground\remix\remix-jokes\node_modules\@remix-run\express\server.js:43:22
   */
  if (bundledFile) {
    bundledFile = bundledFile.replace(`${process.cwd()}\\build\\route:`, "");
  }
  const line = url.searchParams.get("line");
  const column = url.searchParams.get("column");

  if (!bundledFile || !line || !column) {
    throw new Response(null, { status: 422 });
  }

  const data = await getFileContent(bundledFile);

  const rawSourceMap = await extractSourceMap(data, bundledFile);

  if (!rawSourceMap) {
    return json({
      root,
      file: bundledFile.replace(root, ""),
      sourceContent: data,
      line: line ? parseInt(line) : null,
      column: column ? parseInt(column) : null,
    });
  }

  const sm : any = SourceMapConsumer;

  /*
  /* Without this i have error asking to configure 'source-map' like on the Web:
  /* Error: You must provide the URL of lib/mappings.wasm by calling SourceMapConsumer.initialize({ 'lib/mappings.wasm': ... }) before using SourceMapConsumer
    at readWasm (C:\Users\daviz\remix\node_modules\source-map\lib\read-wasm.js:8:13)
    at wasm (C:\Users\daviz\remix-jokes\node_modules\source-map\lib\wasm.js:25:16)
    at C:\Users\daviz\remix-jokes\node_modules\source-map\lib\source-map-consumer.js:264:14
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at action (C:\Users\daviz\remix-jokes\app\lib\remix-crash\server\endpoints.server.ts:98:20)
    at Object.callRouteAction (C:\Users\daviz\remix-jokes\node_modules\@remix-run\server-runtime\data.js:36:14)
    at handleResourceRequest (C:\Users\daviz\remix-jokes\node_modules\@remix-run\server-runtime\server.js:451:14)
    at requestHandler (C:\Users\daviz\remix-jokes\node_modules\@remix-run\server-runtime\server.js:66:20)
    at C:\Users\daviz\remix-jokes\node_modules\@remix-run\express\server.js:43:22
  */
  sm.initialize({
    "lib/mappings.wasm": "https://unpkg.com/source-map@0.7.3/lib/mappings.wasm"
  });

  const consumer = await new SourceMapConsumer(rawSourceMap);

  const sourcePosition = consumer.originalPositionFor({
    line: +line,
    column: +column ?? 0,
  });

  if (!sourcePosition.source) {
    throw new Error("Failed to load source map");
  }

  const sourceContent =
    consumer.sourceContentFor(
      sourcePosition.source,
      /* returnNullOnMissing */ true
    ) ?? null;

  const file = sourcePosition.source.replace("route-module:", "");

  consumer.destroy();

  return json({
    root,
    file: file.replace(root, ""),
    sourceContent,
    line: sourcePosition.line,
    column: sourcePosition.column,
  });
};
