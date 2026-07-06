/**
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 *
 * Catches any uncaught JS error in the React tree and shows a friendly
 * fallback instead of a blank/frozen screen. Logs the error to console
 * so we can see what happened in DevTools.
 */
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('mab_userInfo');
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);

    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Cairo, Arial, sans-serif',
          background: '#F4F8FF',
          padding: '2rem',
        }}
      >
        <div
          style={{
            maxWidth: 500,
            width: '100%',
            background: '#fff',
            padding: '2rem',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            border: '1px solid #D0DCFF',
          }}
        >
          <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: 12 }}>⚠️</div>
          <h1 style={{ color: '#EF4444', fontSize: '1.4rem', textAlign: 'center', margin: '0 0 12px' }}>
            حدث خطأ غير متوقع
          </h1>
          <p style={{ color: '#4B5E8A', textAlign: 'center', margin: '0 0 16px', lineHeight: 1.7 }}>
            نعتذر، حدث خلل أثناء تحميل الصفحة. اضغط الزر أدناه لإعادة المحاولة.
          </p>
          <details style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#64748B' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>تفاصيل تقنية</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8 }}>{message}</pre>
          </details>
          <button
            onClick={this.handleReset}
            style={{
              width: '100%',
              padding: '14px',
              background: '#0A66FF',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }
}
