import { ActionFunction, LoaderFunction, json } from "remix";
import { SourceMapConsumer } from "source-map";
import { CORSResponse } from "./utils";
import { readFile } from "fs/promises";
import axios from "axios";

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

  axios("https://jsonplaceholder.typicode.com/todos/1")
    .then((response) => response.data)
    .then((data) => console.log(data));

  const url = new URL(request.url);
  const root = process.cwd();

  const bundledFile = url.searchParams.get("file");
  const line = url.searchParams.get("line");
  const column = url.searchParams.get("column");

  if (!bundledFile || !line || !column) {
    throw new Response(null, { status: 422 });
  }

  const data = await readFile(bundledFile, { encoding: "utf-8" });

  const sourceMapResult = new RegExp(
    /\n\/\/\# sourceMappingURL\=data\:application\/json\;base64\,(.*)/,
    "g"
  ).exec(data);

  if (!sourceMapResult) {
    return json({
      root,
      file: bundledFile.replace(root, ""),
      sourceContent: data,
      line: line ? parseInt(line) : null,
      column: column ? parseInt(column) : null,
    });
  }

  const [_, base64SourceMap] = sourceMapResult;

  const rawSourceMap = JSON.parse(
    Buffer.from(base64SourceMap, "base64").toString("utf-8")
  );

  const consumer = await new SourceMapConsumer(rawSourceMap);

  if (!line || !column) {
    throw new Error("Failed to load source map");
  }

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

  return json({
    root,
    file: file.replace(root, ""),
    sourceContent,
    line: sourcePosition.line,
    column: sourcePosition.column,
  });
};
