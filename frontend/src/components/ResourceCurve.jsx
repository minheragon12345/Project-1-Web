import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { getResourceCurve } from '../services/projectService';
import './ResourceCurve.css';

const UNIT_LABEL = { hour: 'h', day: 'd', week: 'w', month: 'mo' };

/**
 * Renders a resource-loading curve (cumulative peopleRequired over time)
 * with a horizontal reference line at the project's headcount cap.
 *
 * Props:
 *   projectId — string
 *   refreshKey — optional value; when it changes, refetch (e.g. on task save)
 */
export default function ResourceCurve({ projectId, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getResourceCurve(projectId)
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load resource curve');
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const unitShort = UNIT_LABEL[data?.timeUnit] || 'd';

  // Split each point into safe (under reference) and over (overshoot)
  // segments so we can stack two areas: gray under, red over.
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data.points)) return [];
    const ref = Number(data.reference) || 0;
    return data.points.map((p) => ({
      t: p.t,
      demand: p.demand,
      safe: Math.min(p.demand, ref),
      over: Math.max(0, p.demand - ref),
    }));
  }, [data]);

  if (!projectId) return null;
  if (loading && !data) {
    return <div className="resource-curve-empty">Loading resource curve…</div>;
  }
  if (error) {
    return <div className="resource-curve-empty error">Resource curve: {error}</div>;
  }
  if (!data || chartData.length === 0) {
    return <div className="resource-curve-empty">No resource data yet.</div>;
  }

  const peak = Number(data.peak) || 0;
  const reference = Number(data.reference) || 0;
  const overPeak = peak > reference;

  return (
    <div className="resource-curve-wrapper">
      <div className="resource-curve-header">
        <div className="rc-stat">
          <span className="rc-label">Peak demand</span>
          <span className={`rc-value ${overPeak ? 'rc-over' : ''}`}>
            {peak} {peak === 1 ? 'person' : 'people'}
          </span>
        </div>
        <div className="rc-stat">
          <span className="rc-label">Cap</span>
          <span className="rc-value">{reference}</span>
        </div>
        <div className="rc-stat">
          <span className="rc-label">Span</span>
          <span className="rc-value">
            {data.projectDuration}
            {unitShort}
          </span>
        </div>
        {overPeak ? (
          <div className="rc-alert">
            Peak demand exceeds cap by {peak - reference}.
          </div>
        ) : null}
      </div>

      <div className="resource-curve-chart">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 20, left: 0, bottom: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary, #e5e7eb)" />
            <XAxis
              dataKey="t"
              stroke="var(--text-secondary, #4b5563)"
              tick={{ fontSize: 12 }}
              label={{
                value: `time (${unitShort})`,
                position: 'insideBottom',
                offset: -8,
                style: { fill: 'var(--text-tertiary, #9ca3af)', fontSize: 11 },
              }}
            />
            <YAxis
              stroke="var(--text-secondary, #4b5563)"
              tick={{ fontSize: 12 }}
              allowDecimals={false}
              label={{
                value: 'people',
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'var(--text-tertiary, #9ca3af)', fontSize: 11 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-primary, #fff)',
                border: '1px solid var(--border-primary, #e5e7eb)',
                fontSize: 12,
              }}
              formatter={(value, name) => {
                if (name === 'safe') return [value, 'within cap'];
                if (name === 'over') return [value, 'over cap'];
                return [value, name];
              }}
              labelFormatter={(t) => `t = ${t}${unitShort}`}
            />
            <ReferenceLine
              y={reference}
              stroke="#6366f1"
              strokeDasharray="4 4"
              label={{
                value: `cap ${reference}`,
                position: 'right',
                fill: '#6366f1',
                fontSize: 11,
              }}
            />
            <Area
              type="step"
              dataKey="safe"
              stackId="1"
              stroke="#4b5563"
              fill="#9ca3af"
              fillOpacity={0.4}
              isAnimationActive={false}
            />
            <Area
              type="step"
              dataKey="over"
              stackId="1"
              stroke="#b91c1c"
              fill="#fca5a5"
              fillOpacity={0.7}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
