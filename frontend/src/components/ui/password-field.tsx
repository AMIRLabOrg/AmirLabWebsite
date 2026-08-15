"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { IconButton } from "./icon-button";
import { InputControl } from "./form-controls";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

export function PasswordField({ id, label, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const buttonLabel = visible ? "Hide password" : "Show password";

  return (
    <div className="grid gap-[.38rem]">
      <label className="font-mono text-[.62rem] font-semibold uppercase tracking-[.045em]" htmlFor={id}>{label}</label>
      <div className="relative">
        <InputControl className="pr-[3.2rem]" id={id} {...props} type={visible ? "text" : "password"} />
        <IconButton aria-label={buttonLabel} className="absolute right-[5px] top-1/2 -translate-y-1/2 focus-visible:shadow-[var(--focus-ring)]" shape="round" size="md" title={buttonLabel} onClick={() => setVisible((current) => !current)}>
          {visible ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
        </IconButton>
      </div>
    </div>
  );
}
