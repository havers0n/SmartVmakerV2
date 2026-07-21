import { describe, expect, it } from "vitest";
import { parseYouTubeChannelResource } from "./youtube";
import type { YouTubeChannelResource } from "./youtube";

describe("parseYouTubeChannelResource", () => {
  it("deduplicates channel IDs (function is pure)", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-test",
      snippet: {
        title: "Test Channel",
        description: "A test",
        customUrl: "@testchannel",
        publishedAt: "2020-01-01T00:00:00Z",
        country: "US",
        thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
      },
      statistics: {
        subscriberCount: "5000",
        hiddenSubscriberCount: false,
        videoCount: "100",
        viewCount: "500000",
      },
    };
    const result = parseYouTubeChannelResource("UC-test", resource);
    expect(result.youtubeChannelId).toBe("UC-test");
    expect(result.title).toBe("Test Channel");
    expect(result.handle).toBe("@testchannel");
  });

  it("returns null subscriberCount when statistics.subscriberCount is missing", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-nosubs",
      snippet: { title: "No Subs" },
      statistics: { videoCount: "10", viewCount: "1000" },
    };
    const result = parseYouTubeChannelResource("UC-nosubs", resource);
    expect(result.subscriberCount).toBeNull();
  });

  it("returns null subscriberCount when hiddenSubscriberCount is true", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-hidden",
      snippet: { title: "Hidden Subs" },
      statistics: {
        subscriberCount: "999999",
        hiddenSubscriberCount: true,
        videoCount: "50",
        viewCount: "99999999",
      },
    };
    const result = parseYouTubeChannelResource("UC-hidden", resource);
    expect(result.subscriberCount).toBeNull();
    expect(result.hiddenSubscriberCount).toBe(true);
  });

  it("keeps subscriberCount as number when known and not hidden", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-known",
      snippet: { title: "Known Subs" },
      statistics: {
        subscriberCount: "12345",
        hiddenSubscriberCount: false,
        videoCount: "200",
        viewCount: "1000000",
      },
    };
    const result = parseYouTubeChannelResource("UC-known", resource);
    expect(result.subscriberCount).toBe(12345);
    expect(result.hiddenSubscriberCount).toBe(false);
  });

  it("does not convert null to 0 when subscriberCount is absent", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-nulltest",
      snippet: { title: "Null Test" },
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-nulltest", resource);
    expect(result.subscriberCount).toBeNull();
    expect(result.videoCount).toBe(0);
    expect(result.viewCount).toBe(0);
  });

  it("parses handle from customUrl correctly", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-handle",
      snippet: { title: "Handle Test", customUrl: "@myhandle" },
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-handle", resource);
    expect(result.handle).toBe("@myhandle");
  });

  it("prepends @ to customUrl if missing", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-rawhandle",
      snippet: { title: "Raw Handle", customUrl: "myhandle" },
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-rawhandle", resource);
    expect(result.handle).toBe("@myhandle");
  });

  it("returns null handle when customUrl is absent", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-nohandle",
      snippet: { title: "No Handle" },
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-nohandle", resource);
    expect(result.handle).toBeNull();
  });

  it("extracts thumbnail from medium first, then default", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-thumbs",
      snippet: {
        title: "Thumbs",
        thumbnails: {
          medium: { url: "https://example.com/medium.jpg" },
          default: { url: "https://example.com/default.jpg" },
        },
      },
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-thumbs", resource);
    expect(result.thumbnailUrl).toBe("https://example.com/medium.jpg");
  });

  it("falls back to default thumbnail when medium is absent", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-thumbs2",
      snippet: {
        title: "Thumbs2",
        thumbnails: {
          default: { url: "https://example.com/default.jpg" },
        },
      },
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-thumbs2", resource);
    expect(result.thumbnailUrl).toBe("https://example.com/default.jpg");
  });

  it("returns null thumbnailUrl when no thumbnails", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-nothumbs",
      snippet: { title: "No Thumbs" },
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-nothumbs", resource);
    expect(result.thumbnailUrl).toBeNull();
  });

  it("handles completely empty snippet and statistics", () => {
    const resource: YouTubeChannelResource = {
      id: "UC-empty",
      snippet: {},
      statistics: {},
    };
    const result = parseYouTubeChannelResource("UC-empty", resource);
    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
    expect(result.country).toBeNull();
    expect(result.subscriberCount).toBeNull();
    expect(result.hiddenSubscriberCount).toBeNull();
    expect(result.videoCount).toBe(0);
    expect(result.viewCount).toBe(0);
    expect(result.publishedAt).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
    expect(result.handle).toBeNull();
  });
});
