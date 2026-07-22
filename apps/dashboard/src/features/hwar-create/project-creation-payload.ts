export type ProjectSource = "prompt" | "story_template" | "content_format";
export type ProjectCreationState = {
  source: ProjectSource;
  title: string;
  ratio: "16:9" | "9:16" | "4:3" | "3:4";
  lang: string;
  prompt: string;
  textModelId: string | null;
  imageModelId: string | null;
  contentFormatId: string | null;
  templateId: string | null;
};
export type ProjectCreationPayload =
  | {
      source: "prompt";
      prompt: string;
      title: string;
      ratio: ProjectCreationState["ratio"];
      lang: string;
      textModelId?: string;
      imageModelId?: string;
    }
  | {
      source: "story_template";
      templateId: string;
      prompt: string;
      title: string;
      ratio: ProjectCreationState["ratio"];
      lang: string;
      textModelId?: string;
      imageModelId?: string;
    }
  | {
      source: "content_format";
      contentFormatId: string;
      templateId?: string;
      prompt: string;
      title: string;
      ratio: ProjectCreationState["ratio"];
      lang: string;
      textModelId?: string;
      imageModelId?: string;
    };
export function buildProjectCreationPayload(
  state: ProjectCreationState,
): ProjectCreationPayload | null {
  const prompt = state.prompt.trim();
  if (!prompt) return null;
  const common = {
    title: state.title.trim() || "Untitled Project",
    ratio: state.ratio,
    lang: state.lang,
    ...(state.textModelId ? { textModelId: state.textModelId } : {}),
    ...(state.imageModelId ? { imageModelId: state.imageModelId } : {}),
  };
  if (state.source === "prompt") return { source: "prompt", prompt, ...common };
  if (state.source === "story_template" && state.templateId)
    return {
      source: "story_template",
      templateId: state.templateId,
      prompt,
      ...common,
    };
  if (state.source === "content_format" && state.contentFormatId)
    return {
      source: "content_format",
      contentFormatId: state.contentFormatId,
      ...(state.templateId ? { templateId: state.templateId } : {}),
      prompt,
      ...common,
    };
  return null;
}
