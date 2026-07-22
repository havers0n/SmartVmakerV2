"use client";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import type { Format } from "./api";
export type FormValue = Partial<Format>;
const fields: Array<[keyof FormValue, string, boolean]> = [["description","Description",true],["hookPattern","Hook pattern",true],["structurePattern","Structure pattern",true],["visualPattern","Visual pattern",true],["pacingPattern","Pacing pattern",true],["notes","Notes",true]];
export function ContentFormatForm({ initial = {}, disabled, submitLabel, saving, onSubmit, onCancel }: { initial?: FormValue; disabled?: boolean; submitLabel: string; saving?: boolean; onSubmit: (value: FormValue) => void; onCancel?: () => void }) {
 const [value, setValue] = useState<FormValue>(initial); const [error, setError] = useState<string>();
 const update = (key: keyof FormValue, next: unknown) => setValue((old) => ({...old, [key]: next}));
 return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!String(value.name || "").trim()) return setError("Name is required"); const min=Number(value.targetDurationMinSeconds), max=Number(value.targetDurationMaxSeconds); if ((min && min < 0) || (max && max < 0) || (min && max && min > max)) return setError("Minimum duration cannot exceed maximum duration"); setError(undefined); onSubmit(value); }}>
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  <div><Label htmlFor="format-name">Name</Label><Input id="format-name" required disabled={disabled} value={value.name || ""} onChange={(e) => update("name", e.target.value)} /></div>
  <div><Label htmlFor="format-type">Format type</Label><select id="format-type" disabled={disabled} className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={value.formatType || "mixed"} onChange={(e) => update("formatType", e.target.value)}><option value="mixed">Mixed</option><option value="short_form">Short form</option><option value="long_form">Long form</option></select></div>
  {fields.map(([key,label,multiline]) => <div key={String(key)}><Label htmlFor={String(key)}>{label}</Label>{multiline ? <Textarea id={String(key)} disabled={disabled} value={String(value[key] || "")} onChange={(e) => update(key, e.target.value || null)} /> : null}</div>)}
  <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="min-duration">Minimum duration (seconds)</Label><Input id="min-duration" type="number" min="0" disabled={disabled} value={value.targetDurationMinSeconds ?? ""} onChange={(e) => update("targetDurationMinSeconds", e.target.value ? Number(e.target.value) : null)} /></div><div><Label htmlFor="max-duration">Maximum duration (seconds)</Label><Input id="max-duration" type="number" min="0" disabled={disabled} value={value.targetDurationMaxSeconds ?? ""} onChange={(e) => update("targetDurationMaxSeconds", e.target.value ? Number(e.target.value) : null)} /></div></div>
  {!disabled && <div className="flex gap-3"><Button type="submit" disabled={saving}>{saving ? "Saving…" : submitLabel}</Button>{onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}</div>}
 </form>;
}
