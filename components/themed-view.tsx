import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/utils";

export interface ThemedViewProps extends ViewProps {
  className?: string;
}

/**
 * Komponenta View s automatickým pozadím s ohledem na téma.
 * Pro stylování používá NativeWind – pro další styly předejte className.
 */
export function ThemedView({ className, ...otherProps }: ThemedViewProps) {
  return <View className={cn("bg-background", className)} {...otherProps} />;
}
