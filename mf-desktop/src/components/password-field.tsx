"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  /** Extra class on the outer InputGroup (height, auth chrome, etc.). */
  groupClassName?: string;
};

/**
 * Shared secret field with show/hide — auth password + Settings GitHub PAT.
 */
export function PasswordField({
  id,
  value,
  onChange,
  disabled,
  className,
  groupClassName,
  placeholder = "••••••••",
  autoComplete,
  required,
  minLength,
  name,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const revealId = id ? `${id}-reveal` : undefined;

  return (
    <InputGroup
      className={cn(
        "h-10 bg-muted/60 has-[[data-slot=input-group-control]:focus-visible]:bg-background",
        groupClassName,
      )}
    >
      <InputGroupInput
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        disabled={disabled}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn("h-full", className)}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          id={revealId}
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
