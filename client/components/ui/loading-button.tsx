import * as React from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  isLoading?: boolean;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ isLoading, children, disabled, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }
