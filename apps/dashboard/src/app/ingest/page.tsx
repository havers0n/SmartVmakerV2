'use client';

import { FormEvent, useState } from 'react';

interface IngestFormData {
  query: string;
  publishedAfter?: string;
  duration: 'short' | 'medium' | 'long';
}

export default function IngestPage() {
  const [formData, setFormData] = useState<IngestFormData>({
    query: '',
    duration: 'short',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/ingest/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ingest job');
      }

      setResult(data);
      setFormData({
        query: '',
        duration: 'short',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Ingest Videos from YouTube</h2>
      <p>Search for YouTube videos and ingest them into the system.</p>

      <section style={{ marginTop: '2rem', maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search Query */}
          <div>
            <label htmlFor="query">
              <strong>Search Query</strong>
            </label>
            <input
              type="text"
              id="query"
              name="query"
              value={formData.query}
              onChange={handleInputChange}
              placeholder="e.g., emotional architecture, storytelling"
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                marginTop: '0.5rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Duration Filter */}
          <div>
            <label htmlFor="duration">
              <strong>Video Duration</strong>
            </label>
            <select
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                marginTop: '0.5rem',
                boxSizing: 'border-box',
              }}
            >
              <option value="short">Short (&lt; 4 minutes)</option>
              <option value="medium">Medium (4-20 minutes)</option>
              <option value="long">Long (&gt; 20 minutes)</option>
            </select>
          </div>

          {/* Published After */}
          <div>
            <label htmlFor="publishedAfter">
              <strong>Published After (Optional)</strong>
            </label>
            <input
              type="datetime-local"
              id="publishedAfter"
              name="publishedAfter"
              value={formData.publishedAfter || ''}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                marginTop: '0.5rem',
                boxSizing: 'border-box',
              }}
            />
            <small style={{ color: '#666' }}>
              Only get videos published after this date
            </small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !formData.query.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '1rem',
            }}
          >
            {loading ? 'Creating job...' : 'Create Ingest Job'}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Success Message */}
        {result && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#d4edda',
              color: '#155724',
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
            }}
          >
            <strong>Success!</strong>
            <p>Ingest job created with ID: <code>{result.jobId}</code></p>
            <p>Status: <strong>{result.status}</strong></p>
            <p>{result.message}</p>

            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
              <p>💡 The worker will now search YouTube and fetch video metadata.</p>
              <p>Check the Analysis page to see new videos.</p>
            </div>
          </div>
        )}
      </section>

      {/* Information Section */}
      <section style={{ marginTop: '3rem', backgroundColor: '#f0f8ff', padding: '1.5rem', borderRadius: '4px' }}>
        <h3>How it works</h3>
        <ol>
          <li>Enter a search query (e.g., &quot;emotional architecture&quot;)</li>
          <li>Optionally filter by duration and publication date</li>
          <li>Click &quot;Create Ingest Job&quot;</li>
          <li>The ingest worker will search YouTube API</li>
          <li>Videos will be stored in the database</li>
          <li>You can then analyze them on the Analysis page</li>
        </ol>

        <h3 style={{ marginTop: '1.5rem' }}>About Duration</h3>
        <ul>
          <li><strong>Short:</strong> Less than 4 minutes - Great for clips</li>
          <li><strong>Medium:</strong> 4 to 20 minutes - Typical videos</li>
          <li><strong>Long:</strong> More than 20 minutes - Deep dive content</li>
        </ul>

        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
          <strong>Note:</strong> YouTube API has daily quotas. Each search uses ~100 quota units.
        </p>
      </section>
    </div>
  );
}
