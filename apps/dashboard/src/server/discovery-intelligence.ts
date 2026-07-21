import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type DiscoveryIntelligenceVideo = {
  videoId: string; title: string; channelId: string; channelTitle: string | null;
  subscriberCount: number | null; viewCount: number | null; publishedAt: string | null;
  durationSeconds?: number | null; queryEvidence?: string[]; embedding?: number[]; embeddingProvider?: string;
};
export type DiscoveryClusterLanguageOptions = {
  allowedLanguages?: string[];
  includeMultilingual?: boolean;
  semanticThreshold?: number;
  linkage?: "complete" | "average";
};
export type ComputedDiscoveryCluster = {
  videoIds: string[]; label: string; rawTokenLabel: string; summary: string;
  contentFormat: string; audience: string; suggestedQueries: string[]; whyResearchable: string;
  researchScore: number; adjustedResearchScore: number; labelQualityScore: number;
  semanticCohesion: number; repeatedFormatEvidence: number; isOutlier: boolean;
  dominantLanguage: string; languageMatchScore: number; videoCount: number; channelCount: number;
  medianViewsPerDay: number; smallChannelCount: number; representativeTitles: string[];
  formatDetails?: DiscoveryFormatDetails;
};
export type DiscoveryCandidateSignals = {
  shortsEvidenceRatio: number; longFormRatio: number; kidsContentRatio: number;
  repeatableFormatCount: number; languageScriptScore: number; rankingDelta: number; eligible: boolean;
  whyBoosted: string[]; whyPenalized: string[];
};
export type DiscoveryFormatDetails = {
  formatName: string; confidenceScore: number; formatSummary: string;
  commonHooks: string[]; commonTitlePatterns: string[]; commonEmotions: string[];
  typicalDurationRange: string; likelyVisualStyle: string; repeatabilityScore: number;
  exampleVideos: string[]; exampleChannels: string[];
};

const STOPWORDS = new Set(["a","an","and","are","at","for","from","how","in","is","it","of","on","or","the","to","video","what","when","with","you"]);
const GENERIC = new Set(["viral","short","shorts","story","stories","fact","facts","true","real","amazing","interesting","unbelievable","most","ever","heard","who","one","part","bizarre","crazy","things"]);
const SMALL = 100_000;
const LONG_FORM = /\b(movie|trailer|full|compilation|episode)\b|\b[13]\s+hours?\b/i;
const KIDS = /\b(kids?|children|cartoon|nursery|chuchu)\b/i;
const SHORTS = /#shorts\b|\bshorts\b/i;
const REPEATABLE_FORMATS: Array<{ name: string; pattern: RegExp }> = [
  { name: "weird facts", pattern: /\b(weird|strange|crazy|unbelievable)\b.{0,30}\bfacts?\b|\bfacts?\b.{0,30}\b(weird|strange|crazy|unbelievable)\b/i },
  { name: "history facts", pattern: /\bhistory\b.{0,30}\bfacts?\b|\bfacts?\b.{0,30}\bhistory\b/i },
  { name: "internet horror stories", pattern: /\binternet\b.{0,40}\b(horror|scary|creepy)\b.{0,40}\bstories?\b/i },
  { name: "body facts", pattern: /\b(body|human body|ears?|brain|health)\b.{0,30}\bfacts?\b|\bfacts?\b.{0,30}\b(body|human body|ears?|brain|health)\b/i },
  { name: "animal facts", pattern: /\b(animal|wildlife|fish|eggs?|octopus)\b.{0,30}\bfacts?\b|\bfacts?\b.{0,30}\b(animal|wildlife|fish|eggs?|octopus)\b/i },
  { name: "science explainers", pattern: /\b(science|physics|space|earth)\b.{0,35}\b(explained|explain|why|how|what if)\b/i },
  { name: "crime or mystery facts", pattern: /\b(crime|mystery|mysteries|unsolved)\b.{0,35}\bfacts?\b|\bfacts?\b.{0,35}\b(crime|mystery|mysteries|unsolved)\b/i },
];
const GENERIC_CANDIDATE_LABEL = /\bviral (news|videos?)\b|\bcreative\b.{0,40}\bvideography\b|\bbased on a true story\b|^(viral|news|stories?)\b/i;
const tokens = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(x => x.length > 2 && !STOPWORDS.has(x)) ?? [];
const median = (xs: number[]) => { const a = [...xs].sort((a,b)=>a-b); return a.length ? (a[(a.length-1)>>1] + a[a.length>>1]) / 2 : 0; };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const round = (n: number) => Number(n.toFixed(4));

const TITLE_EMOTIONS: Array<[string, RegExp]> = [
  ["curiosity", /\b(fact|facts|why|how|what|secret|hidden|unknown|explained)\b/i],
  ["surprise", /\b(crazy|weird|strange|unbelievable|shocking|mind.?blowing)\b/i],
  ["awe", /\b(amazing|incredible|beautiful|largest|deepest)\b/i],
  ["tension", /\b(scary|danger|deadly|warning|horror)\b/i],
  ["humor", /\b(funny|lol|fail)\b/i],
];
function titleHook(title: string) {
  return title.replace(/#\w+/g, "").split(/[.!?:|—-]/)[0].trim().split(/\s+/).slice(0, 8).join(" ");
}
function titlePattern(title: string) {
  return title.replace(/#\w+/g, "").replace(/\b\d+\b/g, "{number}").replace(/\s+/g, " ").trim();
}
/** Metadata-only format inference; deliberately does not inspect audio, frames, or transcripts. */
export function deriveDiscoveryFormatDetails(cluster: Pick<ComputedDiscoveryCluster, "videoCount" | "channelCount" | "semanticCohesion" | "repeatedFormatEvidence" | "medianViewsPerDay" | "representativeTitles">, members: DiscoveryIntelligenceVideo[]): DiscoveryFormatDetails {
  const titles = members.map(member => member.title).filter(Boolean);
  const corpus = titles.join(" ");
  const shortRatio = members.length ? members.filter(member => SHORTS.test(`${member.title} ${(member.queryEvidence ?? []).join(" ")}`) || (member.durationSeconds ?? Infinity) <= 90).length / members.length : 0;
  const facts = /\bfacts?\b/i.test(corpus);
  const explainers = /\b(explained|why|how|what if)\b/i.test(corpus);
  const stories = /\b(story|stories)\b/i.test(corpus);
  const formatName = facts && shortRatio >= .5 ? "Short Viral Facts" : facts ? "Viral Facts" : explainers && shortRatio >= .5 ? "Short Explainers" : explainers ? "Explainers" : stories && shortRatio >= .5 ? "Short Storytelling" : stories ? "Storytelling" : shortRatio >= .5 ? "Short-Form Title Pattern" : "Repeatable Video Format";
  const hooks = [...new Set(titles.map(titleHook).filter(hook => hook.length >= 3))].slice(0, 3);
  const patterns = [...new Set(titles.map(titlePattern).filter(pattern => pattern.length >= 3))].slice(0, 3);
  const emotions = TITLE_EMOTIONS.filter(([, pattern]) => pattern.test(corpus)).map(([emotion]) => emotion);
  if (!emotions.length && facts) emotions.push("curiosity");
  const durations = members.map(member => member.durationSeconds).filter((value): value is number => typeof value === "number" && value > 0).sort((a, b) => a - b);
  const duration = durations.length ? `${Math.floor(durations[0] / 60)}:${String(durations[0] % 60).padStart(2, "0")}–${Math.floor(durations[durations.length - 1] / 60)}:${String(durations[durations.length - 1] % 60).padStart(2, "0")}` : "Unavailable";
  const repeatabilityScore = Math.round(clamp(
    clamp((cluster.videoCount - 1) / 5) * .45 +
      clamp(cluster.channelCount / 4) * .25 +
      clamp(cluster.repeatedFormatEvidence) * .3,
  ) * 100);
  const confidenceScore = Math.round(clamp(cluster.semanticCohesion * .45 + clamp(cluster.videoCount / 6) * .25 + clamp(cluster.channelCount / 4) * .2 + shortRatio * .1) * 100);
  return {
    formatName, confidenceScore,
    formatSummary: `${cluster.videoCount} videos across ${cluster.channelCount} channels repeat a ${formatName.toLowerCase()} pattern; titles provide the evidence, not transcripts.`,
    commonHooks: hooks, commonTitlePatterns: patterns, commonEmotions: emotions,
    typicalDurationRange: duration,
    likelyVisualStyle: shortRatio >= .5 ? "Fast-paced caption-led short-form (title/duration estimate)" : "Visual style unavailable from title and duration metadata",
    repeatabilityScore, exampleVideos: titles.slice(0, 3),
    exampleChannels: [...new Set(members.map(member => member.channelTitle).filter((title): title is string => Boolean(title)))].slice(0, 3),
  };
}

const LANGUAGE_SCRIPTS: Array<{ language: string; pattern: RegExp }> = [
  { language: "ar", pattern: /\p{Script=Arabic}/gu }, { language: "he", pattern: /\p{Script=Hebrew}/gu },
  { language: "ru", pattern: /\p{Script=Cyrillic}/gu }, { language: "ja", pattern: /[\p{Script=Hiragana}\p{Script=Katakana}]/gu },
  { language: "zh", pattern: /\p{Script=Han}/gu }, { language: "ko", pattern: /\p{Script=Hangul}/gu },
];
export function detectDiscoveryTextLanguage(text: string) { const found = LANGUAGE_SCRIPTS.map(x => ({ ...x, count: text.match(x.pattern)?.length ?? 0 })).filter(x => x.count); return found.length ? found.sort((a,b)=>b.count-a.count)[0].language : "en"; }
function language(group: DiscoveryIntelligenceVideo[]) { const c = new Map<string,number>(); group.forEach(v => c.set(detectDiscoveryTextLanguage(v.title), (c.get(detectDiscoveryTextLanguage(v.title)) ?? 0)+1)); const r=[...c].sort((a,b)=>b[1]-a[1]); return !r.length ? "unknown" : r[1]?.[1] === r[0][1] ? "multilingual" : r[0][0]; }
function vpd(v: DiscoveryIntelligenceVideo, now: Date) { return Number(v.viewCount ?? 0) / (v.publishedAt ? Math.max(1,(now.getTime()-new Date(v.publishedAt).getTime())/86400000) : 1); }
export function getDiscoveryCandidateSignals(videos: DiscoveryIntelligenceVideo[], nicheName = "", nicheLanguage = "en", label = ""): DiscoveryCandidateSignals {
  const count = videos.length || 1;
  const titleAndQueries = (video: DiscoveryIntelligenceVideo) => `${video.title} ${(video.queryEvidence ?? []).join(" ")}`;
  const shorts = videos.filter(video => SHORTS.test(titleAndQueries(video)) || (video.durationSeconds ?? Infinity) <= 90).length / count;
  const longForm = videos.filter(video => LONG_FORM.test(video.title)).length / count;
  const kidsAllowed = KIDS.test(nicheName);
  const kids = kidsAllowed ? 0 : videos.filter(video => KIDS.test(video.title)).length / count;
  const corpus = videos.map(titleAndQueries).join(" ");
  const boostedFormats = REPEATABLE_FORMATS.filter(format => format.pattern.test(corpus)).map(format => format.name);
  const repeatable = boostedFormats.length;
  const letters = (videos.map(video => video.title).join(" ").match(/\p{L}/gu) ?? []).length;
  const latin = (videos.map(video => video.title).join(" ").match(/\p{Script=Latin}/gu) ?? []).length;
  const languageScriptScore = letters ? latin / letters : 1;
  const genericLabel = GENERIC_CANDIDATE_LABEL.test(label);
  const whyBoosted = [
    ...(shorts >= .5 ? [`${Math.round(shorts * 100)}% Shorts evidence`] : []),
    ...boostedFormats,
  ];
  const whyPenalized = [
    ...(longForm ? [`${Math.round(longForm * 100)}% long-form evidence`] : []),
    ...(kids ? [`${Math.round(kids * 100)}% kids-content evidence`] : []),
    ...(genericLabel ? ["generic candidate label"] : []),
    ...(repeatable === 0 ? ["no recognized repeatable Shorts format"] : []),
    ...(nicheLanguage.toLowerCase() === "en" && languageScriptScore < .85 ? [`non-Latin script share ${Math.round((1 - languageScriptScore) * 100)}%`] : []),
  ];
  const rankingDelta = round(shorts * .12 + Math.min(repeatable, 3) * .08 - longForm * .35 - kids * .25 - (genericLabel ? .45 : 0) - (repeatable === 0 ? .18 : 0));
  // A discovery run can intentionally contain long-form videos (or videos whose
  // duration is not available yet). Shorts evidence is a useful ranking signal,
  // but treating it as a hard gate made the entire candidate list disappear for
  // otherwise valid, repeated multi-channel clusters.
  const eligible = nicheLanguage.toLowerCase() !== "en" || languageScriptScore >= .85;
  return { shortsEvidenceRatio: round(shorts), longFormRatio: round(longForm), kidsContentRatio: round(kids), repeatableFormatCount: repeatable, languageScriptScore: round(languageScriptScore), rankingDelta, eligible, whyBoosted, whyPenalized };
}
export function embeddingInput(v: DiscoveryIntelligenceVideo) { return `Title: ${v.title}\nChannel: ${v.channelTitle ?? "Unknown"}\nDiscovery queries: ${(v.queryEvidence ?? []).sort().join(" | ") || "Unknown"}`; }
export function embeddingFingerprint(v: DiscoveryIntelligenceVideo) { return createHash("sha256").update(embeddingInput(v)).digest("hex"); }

/** Stable local fallback: signed hashed n-gram vector, never a token-label clustering rule. */
export function deterministicEmbedding(text: string, dimensions = 256) {
  const vector = Array<number>(dimensions).fill(0); const normalized = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ")} `;
  for (const token of normalized.match(/[\p{L}\p{N}]{2,}/gu) ?? []) for (const gram of [token, ...Array.from({length: Math.max(0,token.length-2)},(_,i)=>token.slice(i,i+3))]) {
    const hash = createHash("sha256").update(gram).digest(); const i = hash.readUInt16BE(0) % dimensions; vector[i] += hash[2] & 1 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1; return vector.map(x => x/norm);
}
export async function generateDiscoveryEmbedding(video: DiscoveryIntelligenceVideo): Promise<{ embedding: number[]; provider: string; model: string }> {
  const fallback = () => ({ embedding: deterministicEmbedding(embeddingInput(video)), provider: "deterministic", model: "hashed-ngram-v1" });
  if (!process.env.GEMINI_API_KEY) return fallback();
  try {
    const modelName = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: modelName });
    const response = await model.embedContent(embeddingInput(video));
    const values = response.embedding.values;
    return values?.length ? { embedding: values, provider: "gemini", model: modelName } : fallback();
  } catch { return fallback(); }
}

/** Batches BAAI/bge-m3 locally; the Python helper picks CUDA when PyTorch exposes it. */
export async function generateLocalDiscoveryEmbeddings(videos: DiscoveryIntelligenceVideo[]) {
  if (!videos.length) return undefined;
  const candidates = [
    resolve(process.cwd(), "src/server/discovery-local-embeddings.py"),
    resolve(process.cwd(), "apps/dashboard/src/server/discovery-local-embeddings.py"),
  ];
  const script = candidates.find(existsSync);
  if (!script) return undefined;
  try {
    const stdout = await new Promise<string>((resolveOutput, reject) => {
      const child = spawn(process.env.DISCOVERY_LOCAL_EMBEDDING_PYTHON || "python", [script], { stdio: ["pipe", "pipe", "pipe"] });
      let output = ""; let error = "";
      const timeout = setTimeout(() => { child.kill(); reject(new Error("Local embedding timed out")); }, Number(process.env.DISCOVERY_LOCAL_EMBEDDING_TIMEOUT_MS || 600_000));
      child.stdout.on("data", chunk => { output += chunk; });
      child.stderr.on("data", chunk => { error += chunk; });
      child.on("error", reject);
      child.on("close", code => { clearTimeout(timeout); code === 0 ? resolveOutput(output) : reject(new Error(error || `Local embedding exited ${code}`)); });
      child.stdin.end(JSON.stringify({ texts: videos.map(embeddingInput) }));
    });
    const response = JSON.parse(stdout) as { embeddings?: number[][]; model?: string };
    if (!response.embeddings || response.embeddings.length !== videos.length || response.embeddings.some(vector => !vector.length)) return undefined;
    return { embeddings: response.embeddings, provider: "local", model: response.model || "BAAI/bge-m3" };
  } catch (error) {
    console.warn("Discovery local embeddings unavailable", error instanceof Error ? error.message : error);
    return undefined;
  }
}
function cosine(a: number[], b: number[]) { let d=0, an=0, bn=0; for(let i=0;i<Math.min(a.length,b.length);i++){d+=a[i]*b[i]; an+=a[i]*a[i]; bn+=b[i]*b[i];} return d/(Math.sqrt(an)*Math.sqrt(bn)||1); }

/** Embedding-first graph clustering. Singletons are retained only as explicitly marked outliers. */
export function computeDiscoveryClusters(videos: DiscoveryIntelligenceVideo[], now = new Date(), options: DiscoveryClusterLanguageOptions = {}) {
  const vectors = videos.map(v => v.embedding?.length ? v.embedding : deterministicEmbedding(embeddingInput(v)));
  // Average linkage admits related variants without allowing transitive graph components.
  const threshold = options.semanticThreshold ?? (videos.some(video => video.embeddingProvider === "local") ? 0.66 : 0.72);
  const linkage = options.linkage ?? "average";
  const groups: number[][] = [];
  for (let index = 0; index < videos.length; index++) {
    const eligible = groups
      .filter(group => {
        if (group.length >= 50) return false;
        const similarities = group.map(member => cosine(vectors[index], vectors[member]));
        return linkage === "complete"
          ? similarities.every(value => value >= threshold)
          : similarities.reduce((sum, value) => sum + value, 0) / similarities.length >= threshold;
      })
      .sort((a, b) => median(a.map(member => cosine(vectors[index], vectors[member])))-median(b.map(member => cosine(vectors[index], vectors[member]))));
    if (eligible.length) eligible.at(-1)!.push(index); else groups.push([index]);
  }
  const allowed = new Set(options.allowedLanguages?.map(x=>x.toLowerCase()) ?? ["en"]);
  return groups.map(indices => {
    const group=indices.map(i=>videos[i]); const counts=new Map<string,number>(); group.forEach(v=>tokens(v.title).forEach(t=>counts.set(t,(counts.get(t)??0)+1)));
    const top=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3); const raw=top.map(x=>x[0]).join(" · ") || "unclassified discovery pattern";
    const channels=new Set(group.map(v=>v.channelId)); const velocities=group.map(v=>vpd(v,now)); const small=new Set(group.filter(v=>v.subscriberCount!==null&&v.subscriberCount<=SMALL).map(v=>v.channelId)).size;
    const pairSimilarities=indices.flatMap((i,a)=>indices.slice(a+1).map(j=>cosine(vectors[i],vectors[j]))); const cohesion=pairSimilarities.length ? median(pairSimilarities) : 0;
    const repeated=clamp((group.length-1)/4) * (channels.size > 1 ? 1 : .5); const med=median(velocities); const lang=language(group); const langScore=allowed.has(lang) ? 1 : (lang === "multilingual" && options.includeMultilingual ? .5 : 0);
    const quality=top.length ? (top.filter(([t])=>!GENERIC.has(t)).length/top.length) : 0; const diversity=clamp(channels.size/Math.max(3,group.length)); const smallOpportunity=channels.size?small/channels.size:0; const velocity=clamp(med/10_000);
    const score=round(cohesion*.25 + repeated*.2 + velocity*.2 + diversity*.15 + smallOpportunity*.1 + quality*.1);
    const outlier=group.length===1; const evidencePenalty=group.length < 3 || channels.size < 2 ? .12 : 0; const adjusted=round(score - (outlier ? .55 : 0) - evidencePenalty - (langScore === 0 ? .25 : langScore < 1 ? .08 : 0));
    const reps=[...group].sort((a,b)=>vpd(b,now)-vpd(a,now)).slice(0,5).map(v=>v.title);
    return { videoIds:group.map(v=>v.videoId), label: raw, rawTokenLabel:raw, summary:`${group.length} videos across ${channels.size} channels.`, contentFormat:"Unknown", audience:"Unknown", suggestedQueries:[], whyResearchable:"Pending semantic label generation.", researchScore:score, adjustedResearchScore:adjusted, labelQualityScore:round(quality), semanticCohesion:round(cohesion), repeatedFormatEvidence:round(repeated), isOutlier:outlier, dominantLanguage:lang, languageMatchScore:langScore, videoCount:group.length, channelCount:channels.size, medianViewsPerDay:med, smallChannelCount:small, representativeTitles:reps } satisfies ComputedDiscoveryCluster;
  }).sort((a,b)=>b.adjustedResearchScore-a.adjustedResearchScore||b.videoCount-a.videoCount);
}

/** Conservative compatibility path when Gemini embeddings are unavailable. */
export function computeTokenDiscoveryClusters(videos: DiscoveryIntelligenceVideo[], now = new Date(), options: DiscoveryClusterLanguageOptions = {}) {
  const unassigned = new Set(videos.map(video => video.videoId));
  const byId = new Map(videos.map(video => [video.videoId, video]));
  const groups: DiscoveryIntelligenceVideo[][] = [];
  while (unassigned.size) {
    const id = unassigned.values().next().value as string;
    const seed = byId.get(id)!;
    const seedTokens = new Set(tokens(seed.title).filter(token => !GENERIC.has(token)));
    const group = [seed]; unassigned.delete(id);
    for (const candidateId of [...unassigned]) {
      const candidate = byId.get(candidateId)!;
      const candidateTokens = new Set(tokens(candidate.title).filter(token => !GENERIC.has(token)));
      const overlap = [...seedTokens].filter(token => candidateTokens.has(token)).length;
      if (overlap >= 1 && group.length < 50) { group.push(candidate); unassigned.delete(candidateId); }
    }
    groups.push(group);
  }
  // Grouping is token-only; the reused scorer only computes existing metrics/cohesion.
  return groups.flatMap(group => computeDiscoveryClusters(group, now, options));
}

function fallbackLabel(cluster: ComputedDiscoveryCluster) { const title=cluster.representativeTitles[0] ?? "Discovery Pattern"; return { human_readable_label: title.replace(/\s*[-|:].*$/, "").slice(0,80), summary: `${cluster.videoCount} semantically related videos across ${cluster.channelCount} channels.`, content_format:"Unknown", audience:"Unknown", suggested_queries:[], why_researchable:"Repeated semantic evidence with measurable performance and channel diversity." }; }
export async function labelDiscoveryCluster(cluster: ComputedDiscoveryCluster, members: DiscoveryIntelligenceVideo[]) {
  const fallback=fallbackLabel(cluster); if(!process.env.GEMINI_API_KEY || cluster.isOutlier) return fallback;
  try { const model=new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model:process.env.GEMINI_MODEL||"gemini-2.0-flash", generationConfig:{temperature:0.1,responseMimeType:"application/json"} });
    const evidence=members.slice(0,8).map(v=>({title:v.title,channel:v.channelTitle,queries:v.queryEvidence}));
    const result=await model.generateContent(`Label one semantic YouTube discovery cluster. Return ONLY JSON with human_readable_label, summary, content_format, audience, suggested_queries (max 5), why_researchable. Use concise human-readable category names, never token lists. Do not infer facts beyond titles/channels/queries. Evidence: ${JSON.stringify(evidence)}`);
    const parsed=JSON.parse(result.response.text()); return { ...fallback, ...parsed, suggested_queries:Array.isArray(parsed.suggested_queries)?parsed.suggested_queries.slice(0,5):[] };
  } catch { return fallback; }
}
export function buildDiscoverySummary(clusters: ComputedDiscoveryCluster[]) { if(!clusters.length)return "No videos were found in this discovery run."; const top=clusters[0]; return `${clusters.length} semantic groups were found. The leading research candidate is “${top.label}” (${top.videoCount} videos across ${top.channelCount} channels). ${top.summary}`; }
export async function generateDiscoveryRunSummary(clusters: ComputedDiscoveryCluster[]) { return buildDiscoverySummary(clusters); }
