'use client';

export default function Bottombar() {
  return (
    <div className="bottombar">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <span>ebola &copy; 2026 | version 1.9.5</span>
        <span>
          by using this website, you agree to our{' '}
          <a href="/tos" style={{ textDecoration: 'underline', color: 'var(--text-color)' }}>
            terms
          </a>
          .
        </span>
      </div>
    </div>
  );
}
