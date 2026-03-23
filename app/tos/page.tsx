'use client';
export default function TosPage() {
  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 20px',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-color)',
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      <h1 style={{ marginTop: 0 }}>Terms of Service</h1>
      <iframe
        src="/TOS.pdf"
        style={{
          width: '100%',
          height: '70vh',
          border: `2px solid var(--link-color)`,
          borderRadius: '8px',
          marginBottom: '20px'
        }}
        title="Terms of Service PDF"
      />
      <div style={{ paddingTop: '20px', borderTop: `1px solid var(--link-color)` }}>
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
