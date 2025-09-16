import * as React from "react"
import { cn } from "@/lib/utils"

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "shrink-0 bg-border",
          orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
          className
        )}
        aria-hidden={decorative}
        role={decorative ? "none" : "separator"}
        {...props}
      />
    )
  }
)
Separator.displayName = "Separator"

export { Separator }
