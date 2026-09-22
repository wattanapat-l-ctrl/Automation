"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-950" style={{ margin: 0 }}>
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-slate-900 p-6">
            <h2 className="text-lg font-bold text-white">This page couldn&apos;t load</h2>
            <p className="mt-1 text-sm text-slate-400">
              Error details below (copied from the browser) — share this text with your developer.
            </p>
            <button
              onClick={reset}
              className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Reload to try again
            </button>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-rose-300">
              {error.message}

              digest: {error.digest ?? "n/a"}

              URL: {typeof window !== "undefined" ? window.location.href : "n/a"}
            </pre>
            {error.stack && (
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-300">
                {error.stack.split("\n").slice(0, 25).join("\n")}
              </pre>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}