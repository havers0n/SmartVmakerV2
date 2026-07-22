import { describe, expect, it } from "vitest";
import {
  buildProjectCreationPayload,
  type ProjectCreationState,
} from "./project-creation-payload";
const state: ProjectCreationState = {
  source: "prompt",
  title: "Title",
  ratio: "16:9",
  lang: "en",
  prompt: " Idea ",
  textModelId: null,
  imageModelId: null,
  contentFormatId: null,
  templateId: null,
};
describe("buildProjectCreationPayload", () => {
  it("builds canonical prompt payload without legacy fields", () =>
    expect(buildProjectCreationPayload(state)).toEqual({
      source: "prompt",
      prompt: "Idea",
      title: "Title",
      ratio: "16:9",
      lang: "en",
    }));
  it("builds story template payload", () =>
    expect(
      buildProjectCreationPayload({
        ...state,
        source: "story_template",
        templateId: "template",
      }),
    ).toMatchObject({
      source: "story_template",
      templateId: "template",
      prompt: "Idea",
    }));
  it("builds content format payload with optional template", () =>
    expect(
      buildProjectCreationPayload({
        ...state,
        source: "content_format",
        contentFormatId: "format",
        templateId: "template",
      }),
    ).toMatchObject({
      source: "content_format",
      contentFormatId: "format",
      templateId: "template",
      prompt: "Idea",
    }));
  it("rejects missing idea, template, or format", () => {
    expect(buildProjectCreationPayload({ ...state, prompt: " " })).toBeNull();
    expect(
      buildProjectCreationPayload({ ...state, source: "story_template" }),
    ).toBeNull();
    expect(
      buildProjectCreationPayload({ ...state, source: "content_format" }),
    ).toBeNull();
  });
});
