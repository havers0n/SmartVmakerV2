export interface CompileKeyframePromptInput {
  scene: { phase: string; description: string; cameraCommands?: string[] };
  frameRole: "first" | "last";
  productionPlan?: { cameraMovement?: string } | null;
  settings: { aspectRatio?: string; negativePrompt?: string; style?: string };
  compilerVersion: string;
}

const STYLE_DEFAULT =
  "Ultra realistic, cinematic still frame, 8k, shallow depth of field, natural lighting.";
const NEGATIVE_DEFAULT =
  "no text, no captions, no subtitles, no watermarks, no titles, no interface elements, no logos, no numbers on the image, no graphic overlays";

function cleanDescription(raw: string): string {
  if (!raw) return "";
  let cleaned = raw
    .replace(/^scene\s*\d+(?:\/\d+)?\s*[:\-]\s*/i, "")
    .replace(/\bframe\s*\d+(?:\/\d+)?\s*[:\-]?\s*/gi, "")
    .replace(/\b(opening|closing|final)\s*frame\s*[:\-]?\s*/gi, "")
    .replace(/\bphase\s*[:\-]\s*\w+\b/gi, "")
    .replace(/text on screen:[^.]+/gi, "")
    .trim();
  if (!cleaned) cleaned = raw.trim();
  return cleaned;
}

export function compileKeyframePrompt(
  input: CompileKeyframePromptInput,
): string {
  const { scene, frameRole, settings } = input;
  const visual = cleanDescription(scene.description);
  const style = settings.style ?? STYLE_DEFAULT;
  const negative = settings.negativePrompt ?? NEGATIVE_DEFAULT;
  const camera = scene.cameraCommands?.length
    ? ` Camera: ${scene.cameraCommands.join("; ")}.`
    : "";
  const base = `${visual}. ${style}.${camera}`;

  const frameHint =
    frameRole === "first"
      ? "Opening moment, initial state."
      : "Closing moment, final state or result.";
  return `${base} ${frameHint} Avoid any written text or titles on the image. Negative prompt: ${negative}.`;
}
