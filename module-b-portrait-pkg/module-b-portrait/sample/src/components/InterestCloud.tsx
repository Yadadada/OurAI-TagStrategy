/**
 * InterestCloud (sample-b-best edition).
 *
 * Upgrade vs baseline:
 *   - Replaced the force-graph hack with a real word-cloud layout via the
 *     `echarts-wordcloud` plugin. Tags now lay out properly without
 *     overlap, sized by `weight`.
 *   - Added category-filter chips (lifestyle / art / media / tech /
 *     entertainment / social) — clicking a chip filters the cloud to that
 *     category; "全部" resets.
 *   - Hover tooltip shows tag name, weight, mention count, and category.
 *
 * Data shape: PortraitInterest[] from shared-fixtures.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { TooltipComponent } from 'echarts/components';
import 'echarts-wordcloud';
import type { PortraitInterest } from '@coursework/shared-fixtures';

echarts.use([CanvasRenderer, TooltipComponent]);

const CATEGORY_COLORS: Record<string, string> = {
  lifestyle: '#efc2cd',     // rose pink
  art: '#c98094',           // deep rose
  media: '#a36b7a',         // dusty plum
  entertainment: '#f4dfbc', // champagne
  tech: '#b3cdb9',          // sage
  social: '#7e9d85',        // deep sage
  default: '#8d6e7a',       // muted plum
};

const CATEGORY_LABELS: Record<string, string> = {
  lifestyle: '生活',
  art: '艺术',
  media: '媒体',
  entertainment: '娱乐',
  tech: '科技',
  social: '社交',
};

interface Props {
  interests: PortraitInterest[];
  height?: number;
}

export function InterestCloud({ interests, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');

  // The categories actually present in this user's tags.
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const i of interests) set.add(i.category);
    return Array.from(set);
  }, [interests]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return interests;
    return interests.filter((i) => i.category === activeCategory);
  }, [interests, activeCategory]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }
    const chart = chartRef.current;

    if (filtered.length === 0) {
      chart.setOption(
        {
          tooltip: { show: false },
          series: [],
          graphic: [
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: { text: '这个分类下还没有标签', fill: '#8a948a', fontSize: 13 },
            },
          ],
        },
        { notMerge: true },
      );
      return;
    }

    const data = filtered.map((i) => ({
      name: i.tag_name,
      value: i.weight,
      mentionCount: i.mention_count,
      category: i.category,
      textStyle: {
        color: CATEGORY_COLORS[i.category] ?? CATEGORY_COLORS.default,
      },
    }));

    chart.setOption(
      {
        tooltip: {
          show: true,
          formatter: (p: { data?: { name?: string; value?: number; category?: string; mentionCount?: number } }) => {
            if (!p.data) return '';
            const cat = p.data.category ?? 'default';
            const catLabel = CATEGORY_LABELS[cat] ?? cat;
            return `<div style="font-weight:600">${p.data.name}</div>` +
              `<div style="font-size:11px;color:#647264">权重 ${p.data.value} · 提及 ${p.data.mentionCount} 次</div>` +
              `<div style="font-size:11px;color:${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default}">分类：${catLabel}</div>`;
          },
        },
        series: [
          {
            type: 'wordCloud',
            shape: 'circle',
            left: 'center',
            top: 'center',
            width: '92%',
            height: '88%',
            sizeRange: [12, 42],
            rotationRange: [0, 0],          // keep horizontal — Chinese reads left-to-right
            rotationStep: 0,
            gridSize: 6,
            drawOutOfBound: false,
            shrinkToFit: true,
            data,
          },
        ],
        graphic: [],
      },
      { notMerge: true },
    );

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [filtered]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  if (interests.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-[24px] bg-white/90 text-[13px] text-[#8d6e7a] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
        style={{ height }}
      >
        还没有兴趣标签
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#a36b7a]">兴趣</p>
          <h3 className="mt-1 text-[16px] font-medium text-[#52333f]">你的兴趣词云</h3>
        </div>
        <span className="text-[12px] text-[#8d6e7a]">
          {filtered.length}/{interests.length} 个标签
          {activeCategory !== 'all' && ` · ${CATEGORY_LABELS[activeCategory] ?? activeCategory}`}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <CategoryChip
          label="全部"
          active={activeCategory === 'all'}
          color="#8d6e7a"
          onClick={() => setActiveCategory('all')}
        />
        {presentCategories.map((cat) => (
          <CategoryChip
            key={cat}
            label={CATEGORY_LABELS[cat] ?? cat}
            active={activeCategory === cat}
            color={CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
      </div>

      <div ref={containerRef} style={{ height, width: '100%' }} />

      <p className="mt-2 text-[11px] leading-5 text-[#a36b7a]">
        点分类切换，悬停看权重和提及次数。
      </p>
    </div>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}

function CategoryChip({ label, active, color, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-medium transition shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] ${
        active ? 'text-[#51343f]' : 'text-[#755965] hover:bg-white/96'
      }`}
      style={{
        backgroundColor: active ? color : 'rgba(255,255,255,0.9)',
      }}
    >
      {label}
    </button>
  );
}
