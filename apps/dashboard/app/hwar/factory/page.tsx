"use client";
import { makeClient } from "@project/api-client";
import { useQuery } from "@tanstack/react-query";

const api = makeClient();

export default function FactoryPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["hwar-harvests"],
    queryFn: () => api.hwar.listHarvests()
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Factory · Harvests</h1>
      {isLoading && <div>Loading harvests...</div>}
      {error && <pre className="text-red-600">{String(error)}</pre>}
      {data && (
        <div>
          <p className="mb-2">Total harvests: {data.harvests?.length || 0}</p>
          <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
