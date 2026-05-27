// NativeWind + Pressable: className může spolknout onPress. Globálně zakázat mapování className.
import { Pressable } from "react-native";
import { remapProps } from "nativewind";

remapProps(Pressable, { className: false });
