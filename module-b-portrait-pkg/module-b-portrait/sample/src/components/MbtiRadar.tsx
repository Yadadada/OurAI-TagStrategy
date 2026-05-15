/**
 * MbtiRadar
 *
 * 4-axis radar chart over the four MBTI dichotomies:
 *   ei (E ↔ I), sn (S ↔ N), tf (T ↔ F), jp (J ↔ P)
 *
 * Each axis is 0..100. 0 = the first letter, 100 = the second letter.
 * The radar shows how far the user leans toward each "second letter" pole,
 * which gives a quick glanceable shape per MBTI type.
 *
 * Source: shared-fixtures `PortraitMbti` (mbti_ei / mbti_sn / mbti_tf / mbti_jp).
 */

import ReactECharts from 'echarts-for-react';
import type { PortraitMbti } from '@coursework/shared-fixtures';

interface Props {
  mbti: PortraitMbti;
  height?: number;
}

export function MbtiRadar({ mbti, height = 320 }: Props) {
  const option = {
    tooltip: {},
    radar: {
      indicator: [
        { name: `E ↔ I (${mbti.mbti_ei >= 50 ? 'I' : 'E'})`, max: 100 },
        { name: `S ↔ N (${mbti.mbti_sn >= 50 ? 'N' : 'S'})`, max: 100 },
        { name: `T ↔ F (${mbti.mbti_tf >= 50 ? 'F' : 'T'})`, max: 100 },
        { name: `J ↔ P (${mbti.mbti_jp >= 50 ? 'P' : 'J'})`, max: 100 },
      ],
      radius: '65%',
      splitNumber: 4,
      axisName: {
        color: '#52333f',
        fontSize: 12,
      },
      axisLine: { lineStyle: { color: 'rgba(239,194,205,0.32)' } },
      splitLine: { lineStyle: { color: 'rgba(239,194,205,0.28)' } },
      splitArea: {
        areaStyle: {
          color: ['rgba(247,221,227,0.18)', 'rgba(247,221,227,0.32)'],
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [mbti.mbti_ei, mbti.mbti_sn, mbti.mbti_tf, mbti.mbti_jp],
            name: `${mbti.mbti_type} · ${mbti.archetype}`,
            areaStyle: { color: 'rgba(239,194,205,0.42)' },
            lineStyle: { color: '#c98094', width: 2 },
            itemStyle: { color: '#c98094' },
          },
        ],
      },
    ],
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#a36b7a]">MBTI</p>
          <h3 className="mt-1 text-[16px] font-medium text-[#52333f]">你的 MBTI 四维分布</h3>
        </div>
        <span className="text-[12px] text-[#8d6e7a]">置信度：{mbti.mbti_confidence}</span>
      </div>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
      <p className="mt-2 text-[13px] leading-6 text-[#7d5f6b]">
        类型 <span className="font-medium text-[#52333f]">{mbti.mbti_type}</span> · {mbti.archetype} —— {mbti.one_liner}
      </p>
    </div>
  );
}
