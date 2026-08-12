import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-muted/60 px-2.5 py-2 text-base text-foreground transition-[color,box-shadow,background-color,border-color] outline-none",
        "placeholder:text-muted-foreground/80",
        "hover:border-foreground/25 hover:bg-background",
        "focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/35",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "md:text-sm dark:bg-input/30 dark:hover:bg-input/40 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
