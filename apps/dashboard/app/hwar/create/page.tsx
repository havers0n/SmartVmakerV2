"use client";
import { makeClient } from "@project/api-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

const api = makeClient();

export default function CreatePage() {
  const [topic, setTopic] = useState("");
  const [durationSec, setDurationSec] = useState(30);
  const [tags, setTags] = useState<string>("rescue,animals");

  const m = useMutation({
    mutationFn: (body: any) => api.hwar.createScenario(body)
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Create · Scenario</h1>
      <div className="space-y-2">
        <input className="border p-2 w-full" placeholder="Topic" value={topic} onChange={e => setTopic(e.target.value)} />
        <input className="border p-2 w-full" type="number" value={durationSec} onChange={e => setDurationSec(Number(e.target.value))} />
        <input className="border p-2 w-full" placeholder="comma tags" value={tags} onChange={e => setTags(e.target.value)} />
        <button
          className="border px-3 py-2"
          onClick={() => m.mutate({ topic, durationSec, tags: tags.split(",").map(s => s.trim()).filter(Boolean) })}
        >
          Create
        </button>
      </div>
      {m.isPending && <div>Creating…</div>}
      {m.isError && <pre className="text-red-600">{String(m.error)}</pre>}
      {m.isSuccess && <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(m.data, null, 2)}</pre>}
    </div>
  );
}
