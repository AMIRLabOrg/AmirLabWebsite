"use client";

import { useEffect } from "react";

const ERROR_CLASS = "field-error";
const ERROR_ID_ATTR = "data-inline-validation-error-id";
const TOUCHED_ATTR = "data-inline-validation-touched";

export function FormValidation() {
  useEffect(() => {
    function controlFromEvent(event: Event): ValidatedControl | null {
      const target = event.target;
      if (!isValidatedControl(target)) return null;
      return target;
    }

    function handleInvalid(event: Event) {
      const control = controlFromEvent(event);
      if (!control) return;
      event.preventDefault();
      control.setAttribute(TOUCHED_ATTR, "true");
      renderError(control);
    }

    function handleBlur(event: Event) {
      const control = controlFromEvent(event);
      if (!control) return;
      control.setAttribute(TOUCHED_ATTR, "true");
      renderError(control);
    }

    function handleInput(event: Event) {
      const control = controlFromEvent(event);
      if (!control || !control.hasAttribute(TOUCHED_ATTR)) return;
      renderError(control);
    }

    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("blur", handleBlur, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);

    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("blur", handleBlur, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
    };
  }, []);

  return null;
}

type ValidatedControl =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatedControl(
  value: EventTarget | null,
): value is ValidatedControl {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLSelectElement ||
    value instanceof HTMLTextAreaElement
  );
}

function renderError(control: ValidatedControl) {
  const message = control.validationMessage;
  const existing = errorElement(control);
  control.toggleAttribute("aria-invalid", Boolean(message));

  if (!message) {
    existing?.remove();
    removeErrorDescription(control);
    return;
  }

  const error = existing ?? document.createElement("p");
  error.className = `${ERROR_CLASS} m-0 text-[.78rem] leading-[1.45] text-danger`;
  error.id ||= `${control.id || control.name || "field"}-error-${randomId()}`;
  error.setAttribute("role", "alert");
  error.textContent = message;
  control.setAttribute(ERROR_ID_ATTR, error.id);
  addErrorDescription(control, error.id);

  if (!existing) {
    const field = control.closest("label, .field");
    if (field) field.append(error);
    else control.insertAdjacentElement("afterend", error);
  }
}

function errorElement(control: ValidatedControl): HTMLElement | null {
  const id = control.getAttribute(ERROR_ID_ATTR);
  if (!id) return null;
  const element = document.getElementById(id);
  return element?.classList.contains(ERROR_CLASS) ? element : null;
}

function addErrorDescription(control: ValidatedControl, errorId: string) {
  const ids = describedByIds(control);
  if (!ids.includes(errorId)) ids.push(errorId);
  control.setAttribute("aria-describedby", ids.join(" "));
}

function removeErrorDescription(control: ValidatedControl) {
  const errorId = control.getAttribute(ERROR_ID_ATTR);
  if (!errorId) return;
  const ids = describedByIds(control).filter((id) => id !== errorId);
  if (ids.length) control.setAttribute("aria-describedby", ids.join(" "));
  else control.removeAttribute("aria-describedby");
  control.removeAttribute(ERROR_ID_ATTR);
}

function describedByIds(control: ValidatedControl): string[] {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 9);
}
