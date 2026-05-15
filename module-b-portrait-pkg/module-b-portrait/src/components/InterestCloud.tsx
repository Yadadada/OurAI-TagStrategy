/**
 * InterestCloud
 *
 * Wordcloud-ish layout over PortraitInterest[]. We avoid a heavy wordcloud
 * library and instead use ECharts' graph layout in 'force' mode with one node
 * per interest tag — the result reads as a tag cloud where heavier tags
 * (higher `weight`) appear larger.
 *
 * Categories are color-coded so students can spot category dominance
 * (lifestyle / art / tech / etc.) at a glance.
 */

import ReactECharts from 'echarts-for-react';
import type { PortraitInterest } from '@coursework/shared-fixtures';

const CATEGORY_COLORS: Record<string, string> = {
  lifestyle: '#e8a0b8',
  art: '#a77bd8',
  media: '#5b9dbe',
  entertainment: '#ff9f1c',
  tech: '#36a2d8',
  social: '#82b85c',
  default: '#8a948a',
};

interface Props {
  interests: PortraitInterest[];
  height?: number;
}

export function InterestCloud({ interests, height = 300 }: Props) {
  if (interests.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-white/60 text-[13px] text-[#8a948a]"
        style={{ height }}
      >
        该用户尚无兴趣标签
      </div>
    );
  }

  const data = interests.map((i, idx) => ({
    name: i.tag_name,
    value: i.weight,
    symbolSize: Math.max(28, Math.round(i.weight * 0.6)),
    itemStyle: {
      color: CATEGORY_COLORS[i.category] ?? CATEGORY_COLORS.default,
    },
    label: {
      show: true,
      formatter: i.tag_name,
      fontSize: Math.max(11, Math.round(i.weight * 0.18)),
      color: '#2d3a2d',
    },
    // Spread initial positions evenly so the force layout converges quickly.
    x: Math.cos((idx / interests.length) * Math.PI * 2) * 100,
    y: Math.sin((idx / interests.length) * Math.PI * 2) * 100,
  }));

  const option = {
    tooltip: {
      formatter: (p: { data: { name: string; value: number } }) =>
        `${p.data.name}<br/>权重 ${p.data.value}`,
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: false,
        force: {
          repulsion: 220,
          edgeLength: 50,
          gravity: 0.12,
        },
        data,
        edges: [],
      },
    ],
  };

  return (
    <div>
      <h3 className="mb-2 text-[15px] font-bold text-[#2d3a2d]">兴趣词云</h3>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
    </div>
  );
}
