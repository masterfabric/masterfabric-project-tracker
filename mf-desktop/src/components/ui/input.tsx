import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-muted/60 px-2.5 py-1 text-base text-foreground shadow-none transition-[color,box-shadow,background-color,border-color] outline-none",
        "placeholder:text-muted-foreground/80",
        "hover:border-foreground/25 hover:bg-background",
        "focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/35",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "md:text-sm dark:bg-input/30 dark:hover:bg-input/40 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
