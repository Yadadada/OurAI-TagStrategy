/**
 * AttachmentBars
 *
 * Renders the 3-axis attachment-style score (anxious / avoidant /
 * secure) as a horizontal ECharts bar chart. The category label and
 * one-liner from `scoreAttachmentStyle` are shown above the chart.
 *
 * See `src/portrait-extension/attachment-style.ts` for theoretical
 * justification (Bowlby/Ainsworth + ECR-S short-form derivation).
 */

import ReactECharts from 'echarts-for-react';
import { ATTACHMENT_STYLE_LABELS, attachmentBarSeries, type AttachmentScore } from '../portrait-extension/attachment-style.js';

interface Props {
  attachment: AttachmentScore;
  height?: number;
}

const CONFIDENCE_LABEL: Record<AttachmentScore['confidence'], string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export function AttachmentBars({ attachment, height = 220 }: Props) {
  const series = attachmentBarSeries(attachment);

  const option = {
    grid: { left: 96, right: 36, top: 20, bottom: 30 },
    tooltip: {
      formatter: (p: { name?: string; value?: number; data?: { color?: string } }) =>
        `<div style="font-weight:600;color:#52333f">${p.name}</div>` +
        `<div style="font-size:11px;color:#7d5f6b">分数：${p.value} / 100</div>`,
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: '#8d6e7a', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(239,194,205,0.28)' } },
    },
    yAxis: {
      type: 'category',
      data: series.map((s) => s.axis),
      axisLabel: { color: '#52333f', fontSize: 12, fontWeight: 500 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(239,194,205,0.42)' } },
    },
    series: [
      {
        type: 'bar',
        data: series.map((s) => ({
          value: s.value,
          itemStyle: { color: s.color, borderRadius: [0, 8, 8, 0] },
        })),
        barWidth: 18,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}',
          color: '#52333f',
          fontSize: 11,
          fontWeight: 500,
        },
        // 50/50 reference line — the median-split classification boundary.
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#c98094', type: 'dashed', width: 1 },
          data: [{ xAxis: 50, label: { show: true, formatter: '中位 50', color: '#a36b7a', fontSize: 10 } }],
        },
      },
    ],
  };

  const styleLabel = ATTACHMENT_STYLE_LABELS[attachment.style];

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#a36b7a]">依恋类型小测</p>
          <h3 className="mt-1 text-[16px] font-medium text-[#52333f]">看看你的依恋类型 · {styleLabel}</h3>
        </div>
        <span className="text-[12px] text-[#8d6e7a]">
          置信度：{CONFIDENCE_LABEL[attachment.confidence]}
        </span>
      </div>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
      <p className="mt-2 text-[13px] leading-6 text-[#7d5f6b]">{attachment.oneLiner}</p>
    </div>
  );
}
