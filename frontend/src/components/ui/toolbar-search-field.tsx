import { Search } from "lucide-react";
import type { ChangeEventHandler } from "react";
import { InputControl } from "./form-controls";

export function ToolbarSearchField({
  id,
  label,
  onChange,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 content-start gap-[.45rem]">
      <label htmlFor={id}>{label}</label>
      <div className="relative grid items-center">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 z-[1] text-ink-muted" size={17} />
        <InputControl
          className="pl-10"
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          type="search"
          value={value}
        />
      </div>
    </div>
  );
}
