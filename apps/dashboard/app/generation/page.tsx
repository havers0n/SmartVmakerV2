'use client';

import { FormEvent, useState, useEffect } from 'react';

interface Short {
  id: string;
  templateId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
  assetCount?: number;
  completedCount?: number;
  failedCount?: number;
}

interface Asset {
  id: string;
  shortId: string;
  assetType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  storageUrl?: string;
  apiCostUsd?: number;
  meta?: Record<string, any>;
  error?: string;
  createdAt: string;
}

interface GenerationJob {
  id: string;
  assetId: string;
  provider: 'minimax' | 'hailuo';
  status: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
}

interface StatusResponse {
  ok: boolean;
  shorts: Short[];
  assets: Asset[];
  jobs: GenerationJob[];
  count: {
    shorts: number;
    assets: number;
    jobs: number;
  };
}

export default function GenerationPage() {
  const [templateId, setTemplateId] = useState('');
  const [provider, setProvider] = useState<'minimax' | 'hailuo'>('minimax');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch generation status
  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch('/api/generation/status?limit=100');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setStatusData(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Auto-refresh every 3 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchStatus, 3000);
    fetchStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleCreateShort = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!templateId.trim()) {
      setError('Template ID is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generation/shorts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: templateId.trim(),
          provider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create short');
      }

      setSuccess(`Short created: ${data.shortId} with ${data.enqueued} assets enqueued`);
      setTemplateId('');

      // Refresh status immediately
      setTimeout(fetchStatus, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Generation & Asset Creation</h2>
      <p>Create shorts from templates and generate video assets using MiniMax or Hailuo.</p>

      {/* Form Section */}
      <section style={{ marginTop: '2rem', maxWidth: '600px', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h3>Create New Short</h3>
        <form onSubmit={handleCreateShort} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="templateId">
              <strong>Template ID</strong>
            </label>
            <input
              type="text"
              id="templateId"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="e.g., template-001"
              disabled={loading}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
            <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
              The ID of the template to base the short on
            </small>
          </div>

          <div>
            <label htmlFor="provider">
              <strong>Provider</strong>
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'minimax' | 'hailuo')}
              disabled={loading}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            >
              <option value="minimax">MiniMax</option>
              <option value="hailuo">Hailuo</option>
            </select>
            <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
              Video generation provider to use
            </small>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {loading ? 'Creating...' : 'Create Short'}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
            {success}
          </div>
        )}
      </section>

      {/* Status Section */}
      <section style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Generation Status</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (3s)
            </label>
            <button
              onClick={fetchStatus}
              disabled={loadingStatus}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loadingStatus ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingStatus ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {statusData && (
          <>
            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>
                  {statusData.count.shorts}
                </div>
                <div style={{ color: '#666' }}>Shorts</div>
              </div>
              <div style={{ padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                  {statusData.count.assets}
                </div>
                <div style={{ color: '#666' }}>Assets</div>
              </div>
              <div style={{ padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>
                  {statusData.count.jobs}
                </div>
                <div style={{ color: '#666' }}>Jobs</div>
              </div>
            </div>

            {/* Shorts Table */}
            <div style={{ marginBottom: '2rem' }}>
              <h4>Shorts</h4>
              {statusData.shorts.length === 0 ? (
                <p style={{ color: '#666' }}>No shorts yet</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>ID</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Template</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Assets</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusData.shorts.map((short) => (
                        <tr key={short.id} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {short.id.substring(0, 8)}...
                          </td>
                          <td style={{ padding: '0.75rem' }}>{short.templateId}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '3px',
                              backgroundColor: short.status === 'completed' ? '#d4edda' :
                                             short.status === 'failed' ? '#f8d7da' :
                                             short.status === 'processing' ? '#d1ecf1' : '#e2e3e5',
                              color: short.status === 'completed' ? '#155724' :
                                    short.status === 'failed' ? '#721c24' :
                                    short.status === 'processing' ? '#0c5460' : '#383d41',
                              fontSize: '0.85rem',
                            }}>
                              {short.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {short.completedCount}/{short.assetCount}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                            {new Date(short.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Assets Table */}
            <div style={{ marginBottom: '2rem' }}>
              <h4>Assets ({statusData.count.assets})</h4>
              {statusData.assets.length === 0 ? (
                <p style={{ color: '#666' }}>No assets yet</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Short ID</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Type</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Storage URL</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusData.assets.map((asset) => (
                        <tr key={asset.id} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {asset.shortId.substring(0, 8)}...
                          </td>
                          <td style={{ padding: '0.75rem' }}>{asset.assetType}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '3px',
                              backgroundColor: asset.status === 'completed' ? '#d4edda' :
                                             asset.status === 'failed' ? '#f8d7da' :
                                             asset.status === 'processing' ? '#d1ecf1' : '#e2e3e5',
                              color: asset.status === 'completed' ? '#155724' :
                                    asset.status === 'failed' ? '#721c24' :
                                    asset.status === 'processing' ? '#0c5460' : '#383d41',
                              fontSize: '0.85rem',
                            }}>
                              {asset.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                            {asset.storageUrl ? (
                              <a href={asset.storageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>
                                View
                              </a>
                            ) : (
                              <span style={{ color: '#666' }}>Pending...</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                            {asset.apiCostUsd ? `$${asset.apiCostUsd.toFixed(4)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
