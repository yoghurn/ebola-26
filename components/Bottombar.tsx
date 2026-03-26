'use client';

export default function Bottombar() {
  return (
    <div className="bottombar">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <span>&copy; 2026 ebola | version 1.8.9</span>
        <span>
          By using this website, you agree to our{' '}
          <a href="/tos" style={{ textDecoration: 'underline', color: 'var(--text-color)' }}>
            terms
          </a>
          .
        </span>
      </div>
    </div>
  );
}
