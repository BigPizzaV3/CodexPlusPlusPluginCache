import clsx from "clsx";
import type { ReactNode } from "react";

export function RichPreviewLoadingContent({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div className={clsx("text-token-text-secondary", className)} role="status">
      Loading…
    </div>
  );
}

export function RichPreviewMessage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={clsx(
        "rounded-lg border border-token-border bg-token-main-surface-secondary p-4 text-sm text-token-text-primary",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-token-main-surface-primary p-6 text-token-text-primary">
      <section className="max-w-md rounded-lg border border-token-border bg-token-main-surface-secondary p-5">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="mt-2 text-sm text-token-text-secondary">{children}</div>
      </section>
    </main>
  );
}
