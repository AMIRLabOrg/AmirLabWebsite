interface ChartSeries {
  color: string;
  label: string;
  values: number[];
}

export function LineChart({ ariaLabel, labels, series }: { ariaLabel: string; labels: string[]; series: ChartSeries[] }) {
  const width = 720;
  const height = 230;
  const plot = { bottom: 188, left: 34, right: 700, top: 18 };
  const maximum = Math.max(1, ...series.flatMap(({ values }) => values));
  const x = (index: number) => plot.left + (labels.length === 1 ? 0 : (index / (labels.length - 1)) * (plot.right - plot.left));
  const y = (value: number) => plot.bottom - (value / maximum) * (plot.bottom - plot.top);

  return (
    <div className="grid gap-3 px-6 pb-6 pt-5 max-[560px]:px-3">
      <svg aria-label={ariaLabel} className="block h-auto w-full overflow-visible" role="img" viewBox={`0 0 ${width} ${height}`}>
        <title>{ariaLabel}</title>
        {[0, 0.5, 1].map((ratio) => {
          const value = Math.round(maximum * ratio);
          const position = y(value);
          return (
            <g key={ratio}>
              <line className="stroke-line stroke-1" x1={plot.left} x2={plot.right} y1={position} y2={position} />
              <text className="fill-ink-muted font-mono text-[10px]" textAnchor="end" x={plot.left - 10} y={position + 4}>{value}</text>
            </g>
          );
        })}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
          return (
            <g key={item.label}>
              <polyline fill="none" points={points} stroke={item.color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              {item.values.map((value, index) => <circle cx={x(index)} cy={y(value)} fill="var(--surface)" key={index} r="4" stroke={item.color} strokeWidth="2" />)}
            </g>
          );
        })}
        {labels.map((label, index) => <text className="fill-ink-muted font-mono text-[10px]" key={label} textAnchor="middle" x={x(index)} y="218">{label}</text>)}
      </svg>
      <ChartLegend series={series.map(({ color, label }) => ({ color, label }))} />
    </div>
  );
}

export function DonutChart({ ariaLabel, segments }: { ariaLabel: string; segments: Array<{ color: string; label: string; value: number }> }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const circumference = 2 * Math.PI * 48;
  const arcs = segments.map((segment, index) => ({
    ...segment,
    length: total ? (segment.value / total) * circumference : 0,
    offset: segments.slice(0, index).reduce((sum, previous) => sum + (total ? (previous.value / total) * circumference : 0), 0),
  }));
  return (
    <div className="grid grid-cols-[minmax(150px,.8fr)_minmax(150px,1fr)] items-center gap-6 p-6 max-[560px]:grid-cols-1">
      <div className="relative mx-auto w-full max-w-[190px]">
        <svg aria-label={ariaLabel} className="block w-full -rotate-90" role="img" viewBox="0 0 120 120">
          <title>{ariaLabel}</title>
          <circle className="stroke-surface-subtle" cx="60" cy="60" fill="none" r="48" strokeWidth="14" />
          {arcs.map((segment) => <circle cx="60" cy="60" fill="none" key={segment.label} r="48" stroke={segment.color} strokeDasharray={`${segment.length} ${circumference - segment.length}`} strokeDashoffset={-segment.offset} strokeLinecap="butt" strokeWidth="14" />)}
        </svg>
        <span className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 text-center"><strong className="font-mono text-[1.45rem] font-medium">{total}</strong><small className="text-[.66rem] text-ink-muted">Total tasks</small></span>
      </div>
      <ChartLegend stacked series={segments.map(({ color, label, value }) => ({ color, label, value }))} />
    </div>
  );
}

function ChartLegend({ series, stacked = false }: { series: Array<{ color: string; label: string; value?: number }>; stacked?: boolean }) {
  return (
    <div className={stacked ? "grid justify-stretch" : "flex flex-wrap justify-center gap-x-5 gap-y-3"}>
      {series.map(({ color, label, value }) => (
        <span className={`inline-flex items-center gap-2 text-[.7rem] text-ink-muted ${stacked ? "border-b border-line pb-2" : ""}`} key={label}>
          <svg aria-hidden="true" height="7" viewBox="0 0 7 7" width="7"><circle cx="3.5" cy="3.5" fill={color} r="3.5" /></svg>
          {label}
          {value === undefined ? null : <strong className="ml-auto font-mono font-medium text-ink">{value}</strong>}
        </span>
      ))}
    </div>
  );
}
