export default function Home() {
  return (
    <div>
      <h2>Welcome to Scrimspec Dashboard</h2>
      <p>
        A system for analyzing and generating short videos based on emotional architecture (AES).
      </p>

      <section style={{ marginTop: '2rem' }}>
        <h3>Quick Start</h3>
        <ol>
          <li>
            <strong><a href="/ingest">Ingest Videos</a></strong> - Search YouTube for videos matching your keywords
          </li>
          <li>
            <strong><a href="/analysis">Analyze Videos</a></strong> - Run analysis on ingested videos
          </li>
        </ol>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h3>System Overview</h3>
        <ul>
          <li>YouTube API integration for video discovery and metadata</li>
          <li>Emotional architecture analysis with Gemini AI</li>
          <li>Video generation with MiniMax/Hailuo API</li>
          <li>Asynchronous job processing with persistent queues</li>
        </ul>
      </section>
    </div>
  );
}
