import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /**
   * Okraje SafeArea k použití. Výchozí nastavení je ["top", "left", "right"].
   * Spodní část je obvykle ovládána panelem karet.
   */
  edges?: Edge[];
  /**
   * Název třídy Tailwind pro oblast obsahu.
   */
  className?: string;
  /**
   * Další název třídy pro vnější kontejner (vrstva pozadí).
   */
  containerClassName?: string;
  /**
   * Další název třídy pro SafeAreaView (vrstva obsahu).
   */
  safeAreaClassName?: string;
}

/**
 * Komponenta kontejneru, která správně zpracovává SafeArea a barvy pozadí.
 *
 * Vnější pohled se rozšíří na celou obrazovku (včetně oblasti stavového řádku) s barvou pozadí,
 * zatímco vnitřní SafeAreaView zajišťuje, že obsah je v bezpečných mezích.
 *
 * Používání:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Vítejte
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={style}
      >
        <View className={cn("flex-1", className)}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
