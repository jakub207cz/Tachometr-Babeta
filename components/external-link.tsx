import { Href, Link } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { type ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== "web") {
          // Zabránit výchozímu chování odkazu na výchozí prohlížeč na nativní.
          event.preventDefault();
          // Otevřete odkaz v prohlížeči v aplikaci.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
