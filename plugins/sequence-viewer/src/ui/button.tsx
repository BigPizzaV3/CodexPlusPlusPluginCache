import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactElement } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  color?: "ghost" | "outline" | "secondary";
  size?: "toolbar";
  uniform?: boolean;
};

export function Button({
  className,
  color = "outline",
  size = "toolbar",
  uniform = false,
  ...props
}: ButtonProps): ReactElement {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-md border text-token-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "toolbar" && "h-7 px-2 text-xs",
        uniform && "w-7 px-0",
        color === "outline" &&
          "border-token-border bg-token-main-surface-primary hover:bg-token-main-surface-secondary",
        color === "secondary" &&
          "border-token-border bg-token-main-surface-secondary hover:bg-token-main-surface-primary",
        color === "ghost" &&
          "border-transparent bg-transparent hover:bg-token-main-surface-secondary",
        className,
      )}
      {...props}
    />
  );
}
