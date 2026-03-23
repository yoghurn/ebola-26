'use client';

export default function TosPage() {
  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 20px',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-color)',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ marginTop: 0 }}>Terms of Service</h1>
      <div id="termsContent" style={{
        lineHeight: '1.6',
        fontSize: '14px'
      }}>
        {/* Paste your terms of service content here */}
      </div>
      <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: `1px solid var(--link-color)` }}>
        <a href="/arcade/" style={{
          color: 'var(--text-color)',
          textDecoration: 'underline',
          cursor: 'pointer'
        }}>
          ← Back to arcade
        </a>
      </div>
    </div>
  );
}
