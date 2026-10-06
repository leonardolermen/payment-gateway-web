import type { ComponentProps } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonClasses";

type Props = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className = "", type = "button", ...button }: Props) {
  return (
    <button type={type} className={`${buttonClasses(variant, size)} ${className}`} {...button} />
  );
}
