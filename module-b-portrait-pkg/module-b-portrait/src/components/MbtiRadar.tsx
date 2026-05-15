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
      splitArea: {
        areaStyle: {
          color: ['rgba(232,160,184,0.05)', 'rgba(232,160,184,0.1)'],
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
            areaStyle: { color: 'rgba(212,119,158,0.35)' },
            lineStyle: { color: '#c06888', width: 2 },
            itemStyle: { color: '#c06888' },
          },
        ],
      },
    ],
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold text-[#2d3a2d]">MBTI 四维分布</h3>
        <span className="text-[12px] text-[#8a948a]">置信度：{mbti.mbti_confidence}</span>
      </div>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
      <p className="mt-1 text-[12px] leading-5 text-[#647264]">
        类型 <strong>{mbti.mbti_type}</strong> · {mbti.archetype} —— {mbti.one_liner}
      </p>
    </div>
  );
}
