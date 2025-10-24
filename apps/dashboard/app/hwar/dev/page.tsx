"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function DevPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const healthQuery = useQuery({
    queryKey: ["health-db", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/health/db");
      return res.json();
    },
  });

  const harvestsQuery = useQuery({
    queryKey: ["hwar-harvests", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/hwar/harvests");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">HWAR Dev Smoke Test</h1>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          Refresh All
        </button>
      </div>

      {/* DB Health Check */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-medium mb-2">Database Health</h2>
        <div className="text-sm text-gray-600 mb-2">
          Endpoint: <code className="bg-gray-100 px-1 py-0.5 rounded">GET /api/health/db</code>
        </div>
        {healthQuery.isLoading && (
          <div className="text-gray-500">Loading...</div>
        )}
        {healthQuery.isError && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800">
            Error: {String(healthQuery.error)}
          </div>
        )}
        {healthQuery.data && (
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto">
            {JSON.stringify(healthQuery.data, null, 2)}
          </pre>
        )}
      </div>

      {/* Harvests List */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-medium mb-2">HWAR Harvests</h2>
        <div className="text-sm text-gray-600 mb-2">
          Endpoint: <code className="bg-gray-100 px-1 py-0.5 rounded">GET /api/hwar/harvests</code>
        </div>
        {harvestsQuery.isLoading && (
          <div className="text-gray-500">Loading...</div>
        )}
        {harvestsQuery.isError && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800">
            Error: {String(harvestsQuery.error)}
          </div>
        )}
        {harvestsQuery.data && (
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto">
            {JSON.stringify(harvestsQuery.data, null, 2)}
          </pre>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Test Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>DB Health should show <code>ok: true</code> with current timestamp</li>
          <li>Harvests should return an array (may be empty initially)</li>
          <li>Create a scenario via <a href="/hwar/create" className="underline">/hwar/create</a></li>
          <li>Refresh to verify data persistence</li>
        </ul>
      </div>
    </div>
  );
}
