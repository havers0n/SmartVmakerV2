"use client";

import React from "react";
import type {
  ContentFormatInputSchema,
  FormatInputs,
} from "@scrimspec/shared-types";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export function FormatInputsRenderer({
  schema,
  values,
  errors = {},
  onChange,
}: {
  schema: ContentFormatInputSchema;
  values: FormatInputs;
  errors?: Record<string, string>;
  onChange: (values: FormatInputs) => void;
}) {
  const update = (name: string, value: string | number | boolean) =>
    onChange({ ...values, [name]: value });

  return (
    <div className="space-y-4">
      {Object.entries(schema.properties).map(([name, field]) => {
        const id = `format-input-${name}`;
        const required = schema.required.includes(name);
        const describedBy = `${id}-help${errors[name] ? ` ${id}-error` : ""}`;
        return (
          <div key={name}>
            <Label htmlFor={id}>
              {field.title ?? name}
              {required ? " *" : ""}
            </Label>
            {field.type === "boolean" ? (
              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={Boolean(values[name])}
                  onCheckedChange={(checked) => update(name, checked === true)}
                  aria-describedby={describedBy}
                />
                <span className="text-sm">Enabled</span>
              </div>
            ) : field.type === "string" && field.enum ? (
              <Select
                value={
                  typeof values[name] === "string"
                    ? String(values[name])
                    : undefined
                }
                onValueChange={(value) => update(name, value)}
              >
                <SelectTrigger
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={Boolean(errors[name])}
                >
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent>
                  {field.enum.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "string" && field.format === "multiline" ? (
              <Textarea
                id={id}
                value={
                  typeof values[name] === "string" ? String(values[name]) : ""
                }
                onChange={(event) => update(name, event.target.value)}
                aria-describedby={describedBy}
                aria-invalid={Boolean(errors[name])}
              />
            ) : (
              <Input
                id={id}
                type={field.type === "string" ? "text" : "number"}
                step={field.type === "integer" ? 1 : "any"}
                min={field.type !== "string" ? field.minimum : undefined}
                max={field.type !== "string" ? field.maximum : undefined}
                value={values[name] === undefined ? "" : String(values[name])}
                onChange={(event) =>
                  update(
                    name,
                    field.type === "string"
                      ? event.target.value
                      : event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                  )
                }
                aria-describedby={describedBy}
                aria-invalid={Boolean(errors[name])}
              />
            )}
            {field.description && (
              <p
                id={`${id}-help`}
                className="mt-1 text-xs text-muted-foreground"
              >
                {field.description}
              </p>
            )}
            {errors[name] && (
              <p
                id={`${id}-error`}
                role="alert"
                className="mt-1 text-sm text-destructive"
              >
                {errors[name]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
