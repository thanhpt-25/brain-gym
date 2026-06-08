import * as React from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/ui/MarkdownContent";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const value = (props.value as string) ?? "";

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-end border border-input rounded-t-md px-1.5 py-0.5 border-b-0 bg-muted/30">
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded-sm transition-colors",
              mode === "write"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded-sm transition-colors",
              mode === "preview"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Preview
          </button>
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-b-md rounded-t-none border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
            "rounded-t-none"
          )}
          ref={ref}
          {...props}
        />
      ) : (
        <div
          className={cn(
            "flex min-h-[80px] w-full rounded-b-md rounded-t-none border border-input bg-background px-3 py-2 text-sm overflow-auto",
            className,
            "rounded-t-none"
          )}
        >
          {value.trim() ? (
            <MarkdownContent>{value}</MarkdownContent>
          ) : (
            <span className="text-muted-foreground">{props.placeholder}</span>
          )}
        </div>
      )}
    </div>
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
