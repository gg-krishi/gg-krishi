import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"

interface PremiumStatCardProps {
  title: string
  subtitle?: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  iconBgColor?: string
  isLoading?: boolean
  compact?: boolean
  className?: string
}

export function PremiumStatCard({
  title,
  subtitle,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  isLoading = false,
  compact = false,
  className,
}: PremiumStatCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("transition-all duration-200 bg-background/50 backdrop-blur-md", className)}>
        <CardContent className={cn(compact ? "p-3" : "p-5")}>
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={cn(compact ? "h-6 w-16" : "h-9 w-28")} />
            </div>
            <Skeleton className={cn(compact ? "h-8 w-8 rounded-xl" : "h-11 w-11 rounded-xl")} />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-xl border-border/40 dark:border-border/20",
        className
      )}
    >
      {/* Animated Gradient Mesh Background */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-700"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 20, ease: "linear", repeat: Infinity }}
        style={{
          backgroundSize: "200% 200%",
          backgroundImage: "radial-gradient(circle at top left, rgba(120, 119, 198, 0.1) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.1) 0%, transparent 40%)"
        }}
      />

      {/* Dynamic Soft Glowing Radial Fade Behind Icon */}
      <div
        className={cn(
          "absolute -right-12 -top-12 -bottom-12 w-[60%] blur-[60px] z-0 pointer-events-none transition-all duration-700",
          "opacity-30 dark:opacity-20 group-hover:opacity-40 dark:group-hover:opacity-30 group-hover:scale-105 bg-current",
          iconColor
        )}
      />

      <CardContent className={cn("relative z-10 flex flex-col h-full justify-between", compact ? "p-3" : "p-5")}>
        <div className={cn("flex items-start justify-between", compact ? "mb-1" : "mb-2")}>
          <div className={cn("space-y-0.5 mr-2 min-w-0", !compact && "space-y-1 mr-4")}>
            <p className={cn("font-semibold text-muted-foreground/80 tracking-wide uppercase truncate", compact ? "text-[10px]" : "text-sm")}>
              {title}
            </p>
            {subtitle && !compact && (
              <p className="text-xs text-muted-foreground/60 whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">
                {subtitle}
              </p>
            )}
          </div>

          <div
            className={cn(
              "rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-[5deg] bg-current shadow-lg shadow-current/20 ring-1 ring-inset ring-foreground/5 shrink-0",
              compact ? "p-1.5" : "p-2.5 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]",
              iconColor
            )}
          >
            <Icon className={cn("text-white", compact ? "w-3.5 h-3.5" : "w-5 h-5")} />
          </div>
        </div>

        <div className={cn("flex items-baseline gap-2", compact ? "mt-0.5" : "mt-1")}>
          <div className={cn("font-extrabold text-foreground tracking-tight", compact ? "text-2xl" : "text-4xl")}>
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PremiumStatCardGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div className={cn("grid gap-4 w-full", gridCols[columns], className)}>
      {children}
    </div>
  )
}
