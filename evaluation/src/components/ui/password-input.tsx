import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle. Forwards its ref and all props to the
 * underlying Input, so it drops into react-hook-form's `{...register(...)}` in
 * place of a plain <Input type="password" />. The toggle sits on the inline-end
 * (left in RTL) and is skipped by Tab so it never interrupts form entry.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      {/* Physical left positioning (not logical `end`) so the toggle and its
          reserved padding always line up: the field is dir=ltr while its RTL
          wrapper flips `end`, which used to drop the icon onto the text. The
          value is right-aligned so it reads clearly beside the icon. */}
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn("pl-10 text-right", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        className="absolute inset-y-0 left-2 my-auto flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
