import React from 'react';

/**
 * Catches render-time errors in lazy-loaded children and shows the message
 * inline instead of blanking the whole React tree. Plain class component —
 * React only supports error boundaries through `componentDidCatch` /
 * `getDerivedStateFromError`, not hooks.
 *
 * Props:
 *   fallback?: (err, info) => ReactNode  — render override
 *   children: ReactNode
 *   label?:    string                    — title shown above the message
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label || '(unlabeled)', error, info);
    this.setState({ info });
  }

  reset = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    if (typeof this.props.fallback === 'function') {
      return this.props.fallback(error, info, this.reset);
    }

    return (
      <div
        style={{
          padding: '16px 20px',
          border: '1px solid #fca5a5',
          background: '#fef2f2',
          color: '#7f1d1d',
          borderRadius: 8,
          fontSize: '0.85rem',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          {this.props.label || 'Something broke here'}
        </div>
        <div style={{ marginBottom: 8 }}>
          {error?.message || String(error)}
        </div>
        {info?.componentStack ? (
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer' }}>Component stack</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, margin: '6px 0 0' }}>
              {info.componentStack}
            </pre>
          </details>
        ) : null}
        <button
          type="button"
          onClick={this.reset}
          style={{
            background: '#fff',
            color: '#7f1d1d',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
