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
      splitArea: {
        areaStyle: {
          color: ['rgba(123,178,150,0.05)', 'rgba(123,178,150,0.1)'],
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
            areaStyle: { color: 'rgba(107,170,117,0.32)' },
            lineStyle: { color: '#3f7a47', width: 2 },
            itemStyle: { color: '#3f7a47' },
          },
        ],
      },
    ],
  };

  return (
    <div>
      <h3 className="mb-2 text-[15px] font-bold text-[#2d3a2d]">11 维特征雷达</h3>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
    </div>
  );
}
