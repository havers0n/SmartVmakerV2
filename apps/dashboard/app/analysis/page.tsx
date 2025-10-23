'use client';

import { useEffect, useState } from 'react';

interface Video {
  id: string;
  title: string;
  url: string;
  channel_title?: string;
  duration_seconds?: number;
  view_count?: number;
  published_at?: string;
}

interface AnalysisResult {
  success: boolean;
  jobIds: string[];
  count: number;
  analyzer: string;
}

export default function AnalysisPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [analyzer, setAnalyzer] = useState('gemini');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  // Fetch ingested videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call to /api/videos or similar
        // For now, fetch from youtube_videos table via backend
        const response = await fetch('/api/videos');

        if (!response.ok) {
          throw new Error('Failed to load videos');
        }

        const data = await response.json();
        setVideos(data.videos || []);
      } catch (err) {
        // For now, show placeholder if API doesn't exist yet
        console.log('Videos API not yet implemented. Showing placeholder.');
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const handleVideoToggle = (videoId: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(v => v.id)));
    }
  };

  const handleSubmitAnalysis = async () => {
    if (selectedVideos.size === 0) {
      setError('Please select at least one video');
      return;
    }

    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analysis/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoIds: Array.from(selectedVideos),
          analyzer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create analysis job');
      }

      setResult(data);
      setSelectedVideos(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Analyze Videos</h2>
      <p>Select ingested videos and run analysis with different analyzers.</p>

      {/* Analyzer Selection */}
      <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <label htmlFor="analyzer">
          <strong>Analyzer:</strong>
        </label>
        <select
          id="analyzer"
          value={analyzer}
          onChange={e => setAnalyzer(e.target.value)}
          style={{
            marginLeft: '1rem',
            padding: '0.5rem',
            fontSize: '1rem',
          }}
        >
          <option value="gemini">Gemini AI</option>
          <option value="nanobanana">Nanobanana</option>
        </select>
      </div>

      {/* Videos Loading State */}
      {loading && <p>Loading videos...</p>}

      {/* Empty State */}
      {!loading && videos.length === 0 && (
        <div
          style={{
            marginTop: '2rem',
            padding: '2rem',
            backgroundColor: '#e7f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          <p>
            <strong>No videos yet</strong>
          </p>
          <p>
            Go to the <a href="/ingest">Ingest page</a> to search YouTube for videos.
          </p>
        </div>
      )}

      {/* Videos List */}
      {!loading && videos.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          {/* Select All Checkbox */}
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input
                type="checkbox"
                checked={selectedVideos.size === videos.length && videos.length > 0}
                onChange={handleSelectAll}
                style={{ marginRight: '0.5rem' }}
              />
              <strong>Select All ({selectedVideos.size}/{videos.length})</strong>
            </label>
          </div>

          {/* Videos */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {videos.map(video => (
              <div
                key={video.id}
                style={{
                  border: selectedVideos.has(video.id) ? '2px solid #007bff' : '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '1rem',
                  backgroundColor: selectedVideos.has(video.id) ? '#f0f8ff' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => handleVideoToggle(video.id)}
              >
                <div style={{ marginBottom: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(video.id)}
                    onChange={() => {}}
                    onClick={e => e.stopPropagation()}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#007bff', textDecoration: 'none' }}
                  >
                    <strong>{video.title}</strong>
                  </a>
                </div>

                <p style={{ margin: '0.5rem 0 0 1.5rem', color: '#666', fontSize: '0.9rem' }}>
                  {video.channel_title && <>Channel: {video.channel_title}<br /></>}
                  {video.duration_seconds && (
                    <>Duration: {formatSeconds(video.duration_seconds)}<br /></>
                  )}
                  {video.view_count && <>Views: {formatNumber(video.view_count)}<br /></>}
                  {video.published_at && (
                    <>Published: {new Date(video.published_at).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {!loading && videos.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={handleSubmitAnalysis}
            disabled={submitting || selectedVideos.size === 0}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor:
                submitting || selectedVideos.size === 0 ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor:
                submitting || selectedVideos.size === 0
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {submitting
              ? 'Creating jobs...'
              : `Analyze ${selectedVideos.size} video${selectedVideos.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

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
          <p>
            Created {result.count} analysis job{result.count !== 1 ? 's' : ''} with {result.analyzer}
          </p>
          <p>Job IDs: {result.jobIds.join(', ')}</p>
          <p>The analysis worker will process these videos in the background.</p>
        </div>
      )}

      {/* Information Section */}
      <section style={{ marginTop: '3rem', backgroundColor: '#f0f8ff', padding: '1.5rem', borderRadius: '4px' }}>
        <h3>How to use</h3>
        <ol>
          <li>Videos from ingested searches appear above</li>
          <li>Select one or more videos using checkboxes</li>
          <li>Choose an analyzer (Gemini, etc.)</li>
          <li>Click &quot;Analyze&quot; to create analysis jobs</li>
          <li>The analysis worker will process them and store results</li>
          <li>Results will be available soon with emotional architecture data</li>
        </ol>

        <h3 style={{ marginTop: '1.5rem' }}>About Analyzers</h3>
        <ul>
          <li><strong>Gemini AI:</strong> Advanced emotional architecture analysis using Google Gemini</li>
          <li><strong>Nanobanana:</strong> Lightweight analysis engine</li>
        </ul>
      </section>
    </div>
  );
}

// Utility functions
function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatNumber(num: number): string {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toString();
}
