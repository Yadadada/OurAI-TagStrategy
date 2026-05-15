/**
 * TraitsRadar
 *
 * 11-axis radar over the PortraitTraits dimensions defined in shared-fixtures.
 *
 *   extroversion / openness / conscientiousness / agreeableness /
 *   emotional_stability / logic_score / creativity_score / eq_score /
 *   execution_score / curiosity_score / social_score
 *
 * Each value is 0..100. The vendored backend has its own 6-dim "consolidated
 * scores" derived from the questionnaire (see personaCard.ts:buildConsolidatedScores);
 * this component visualises the broader 11-dim trait vector that the portrait
 * pipeline produces independently.
 */

import ReactECharts from 'echarts-for-react';
import type { PortraitTraits } from '@coursework/shared-fixtures';

const TRAIT_LABELS: Record<keyof PortraitTraits, string> = {
  extroversion: '外向性',
  openness: '开放性',
  conscientiousness: '尽责性',
  agreeableness: '宜人性',
  emotional_stability: '情绪稳定',
  logic_score: '逻辑',
  creativity_score: '创造力',
  eq_score: '情商',
  execution_score: '执行力',
  curiosity_score: '好奇心',
  social_score: '社交活力',
};

interface Props {
  traits: PortraitTraits;
  height?: number;
}

export function TraitsRadar({ traits, height = 360 }: Props) {
  const keys = Object.keys(TRAIT_LABELS) as Array<keyof PortraitTraits>;
  const indicator = keys.map((k) => ({ name: TRAIT_LABELS[k], max: 100 }));
  const value = keys.map((k) => traits[k]);

  const option = {
    tooltip: {},
    radar: {
      indicator,
      radius: '68%',
      splitNumber: 4,
      axisName: {
        color: '#52333f',
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: 'rgba(179,205,185,0.36)' } },
      splitLine: { lineStyle: { color: 'rgba(179,205,185,0.32)' } },
      splitArea: {
        areaStyle: {
          color: ['rgba(219,231,218,0.18)', 'rgba(219,231,218,0.32)'],
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value,
            name: '画像特征',
            areaStyle: { color: 'rgba(179,205,185,0.42)' },
            lineStyle: { color: '#7e9d85', width: 2 },
            itemStyle: { color: '#7e9d85' },
          },
        ],
      },
    ],
  };

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#a36b7a]">特质</p>
      <h3 className="mt-1 mb-3 text-[16px] font-medium text-[#52333f]">11 维人格特质</h3>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
    </div>
  );
}
