import {
  createContext,
  FunctionComponent,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Links, LiveReload, Meta, Scripts, ScrollRestoration } from "remix";
import codeStyles from "highlight.js/styles/github-dark.css";
// @ts-ignore
import styleInject from "style-inject";
import styles from "./index.css";

export type Stacktrace = Array<string>;

export type SanitizedStacktrace = Array<{
  methodName: string;
  file: string;
  line: number;
  column: number;
} | null>;

export type ErrorState = {
  loading: boolean;
  stacktrace: Stacktrace;
  sanitizedStacktrace: SanitizedStacktrace;
  convertedStacktrace: Array<{
    file: string;
    sourceContent: string;
    line: number;
  }>;
  selectedIndex: number | null;
  setSelectedIndex: (value: number | null) => void;
};

export const defaultErrorState: ErrorState = {
  stacktrace: [],
  sanitizedStacktrace: [],
  loading: true,
  convertedStacktrace: [],
  setSelectedIndex: () => {},
  selectedIndex: null,
};

export const ErrorContext = createContext(defaultErrorState);

export const ErrorContextProvider: FunctionComponent<{
  stacktrace: Stacktrace;
}> = ({ children, stacktrace }) => {
  const sanitizedStacktrace = useMemo(() => {
    return stacktrace.map((line) => {
      const sanitizedLine = line.replace("at", "").trim();

      let result = null;

      result = new RegExp(/(.+) \((.+):(\d+):(\d+)\)/, "g").exec(sanitizedLine);

      if (result) {
        const [, methodName, file, line, column] = result;

        return {
          methodName,
          file,
          line,
          column,
        };
      }

      result = new RegExp(/^(\/.+):(\d+):(\d+)/, "g").exec(sanitizedLine);

      if (result) {
        const [, file, line, column] = result;

        return {
          file,
          line,
          column,
        };
      }
    });
  }, [stacktrace]);

  const [convertedStacktrace, setConvertedStacktrace] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      sanitizedStacktrace.map(async (sanitizedStacktraceLine) => {
        if (!sanitizedStacktraceLine) return null;

        // @ts-ignore
        const params = new URLSearchParams(sanitizedStacktraceLine);

        return fetch(`/_remix-crash?${params.toString()}`, {
          method: "POST",
        }).then((response) => {
          if (!response.ok) return null;
          return response.json();
        });
      })
    )
      .then((data) => {
        // @ts-ignore
        setConvertedStacktrace(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sanitizedStacktrace]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(stacktrace.length ? 0 : null);
  }, [stacktrace]);

  return (
    <ErrorContext.Provider
      value={{
        stacktrace,
        // @ts-ignore
        sanitizedStacktrace,
        convertedStacktrace,
        selectedIndex,
        setSelectedIndex,
        loading,
      }}
    >
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  return useContext(ErrorContext);
};

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  if (process.env.NODE_ENV !== "development") {
    return <ProdErrorBoundary error={error} />;
  }

  return <DevErrorBoundary error={error} />;
}

export function ProdErrorBoundary({ error }: { error: Error }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>

      <body>
        <main
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100vw",
            height: "100vh",
            gap: "1rem",
          }}
        >
          <h1>500</h1>
          <span
            style={{
              height: "2.5rem",
              width: "2px",
              backgroundColor: "rgb(75, 85, 99)",
            }}
          />
          <span>Internal Server Error.</span>
        </main>

        <ScrollRestoration />

        <Scripts />
      </body>
    </html>
  );
}

export function DevErrorBoundary({ error }: { error: Error }) {
  useLayoutEffect(() => {
    styleInject(styles);
    styleInject(codeStyles);
  }, []);

  const [firstLine, ...stacktrace] = useMemo(() => {
    if (!error.stack) return [];
    return error.stack.split("\n");
  }, [error.stack]);

  const [type, message] = useMemo(() => {
    return firstLine?.split(": ") || ["", error.message];
  }, [firstLine, error.message]);

  return (
    <html lang="en">
      <head>
        <title>{`💥 ${type}: ${message}`}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap"
          rel="stylesheet"
        />
      </head>

      <body
        className="bg-black text-white"
        style={{ fontFamily: "Jetbrains Mono" }}
      >
        <main className="w-screen h-screen grid grid-rows-4 grid-cols-3">
          <div className="flex flex-col justify-center bg-slate-900 px-12 col-span-3">
            <div className="text-2xl font-thin text-gray-400">{type}</div>
            <div className="text-4xl font-semibold">{message}</div>
          </div>

          <ErrorContextProvider stacktrace={stacktrace}>
            <div className="overflow-y-scroll row-span-3">
              <StacktraceList />
            </div>

            <div className="col-span-2 row-span-3 overflow-y-scroll">
              <CodeFrame />
            </div>
          </ErrorContextProvider>
        </main>

        <ScrollRestoration />

        <Scripts />

        <LiveReload />
      </body>
    </html>
  );
}

const StacktraceList = () => {
  const { stacktrace, loading } = useError();

  if (loading) return null;

  return (
    <ul className="h-screen max-h-screen overflow-y-scroll">
      {stacktrace.map((line, index) => {
        return (
          <StackTraceLine key={index} index={index}>
            {line}
          </StackTraceLine>
        );
      })}
    </ul>
  );
};

export const StackTraceLine: FunctionComponent<{ index: number }> = ({
  index,
  children,
}) => {
  const { convertedStacktrace, setSelectedIndex, loading, selectedIndex } =
    useError();

  if (loading) return null;

  const line = convertedStacktrace[index];

  return (
    <li>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setSelectedIndex(index);
        }}
        className={[
          "p-8 border border-slate-900 w-full text-left break-words",
          selectedIndex === index ? "bg-gray-700 bg-opacity-40" : "",
        ].join(" ")}
      >
        {line ? <span>{line.file}</span> : children}
      </button>
    </li>
  );
};

// import Prism from 'prismjs'
// import Highlight from 'react-highlight'
import hljs from "highlight.js";

const CodeFrame = () => {
  const { convertedStacktrace, selectedIndex } = useError();
  // const selectedLine = useRef(null)

  const convertedStacktraceLine =
    selectedIndex !== null ? convertedStacktrace[selectedIndex] : null;

  useLayoutEffect(() => {
    document.querySelector(".selected")?.scrollIntoView({ block: "center" });
  }, [convertedStacktraceLine]);

  if (!convertedStacktraceLine) return null;

  return (
    <pre>
      <code>
        {hljs
          .highlight(convertedStacktraceLine.sourceContent, {
            language: "tsx",
          })
          .value.split("\n")
          .map((line, index) => {
            const selected = index + 1 === convertedStacktraceLine.line;

            return (
              <div
                key={index}
                className={[
                  "flex items-center rounded px-4 h-7 w-full min-w-max",
                  selected ? "selected bg-amber-500 bg-opacity-30" : "",
                ].join(" ")}
                data-line={index + 1}
              >
                <span
                  className={[
                    "font-mono opacity-75 text-right px-2",
                    selected ? "text-amber-300" : "text-gray-500",
                  ].join(" ")}
                  style={{ width: "4em" }}
                >
                  {index + 1}
                </span>
                <div
                  dangerouslySetInnerHTML={{ __html: line }}
                  className={[
                    "px-4",
                    selected ? "border-l-4 border-amber-700" : "",
                  ].join(" ")}
                />
              </div>
            );
          })}
      </code>
    </pre>
  );
};
