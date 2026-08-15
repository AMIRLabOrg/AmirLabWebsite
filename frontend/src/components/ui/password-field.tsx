"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { ButtonControl } from "./button-control";
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
        <ButtonControl aria-label={buttonLabel} className="absolute right-[3px] top-[3px] h-[42px] min-h-0 w-[42px] rounded-full border-0 p-0 text-ink-muted hover:bg-transparent hover:text-brand" title={buttonLabel} onClick={() => setVisible((current) => !current)} variant="secondary">
          {visible ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
        </ButtonControl>
      </div>
    </div>
  );
}
