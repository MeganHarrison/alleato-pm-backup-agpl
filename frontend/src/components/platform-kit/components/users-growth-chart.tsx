'use client'

import * as React from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ErrorState } from '@/components/ds'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetUserCountsByDay } from '@/components/platform-kit/hooks/use-user-counts'

const chartConfig = {
  users: {
    label: 'New Users',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function UsersGrowthChart({
  projectRef,
  timeRange,
}: {
  projectRef: string
  timeRange: number
}) {
  const {
    data: chartData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetUserCountsByDay(projectRef, timeRange)

  return (
    <div>
      {isLoading && <Skeleton className="h-[250px] w-full" />}
      {isError && (
        <ErrorState
          title="Couldn't load chart data"
          error={error as Error}
          onRetry={() => void refetch()}
        />
      )}
      {chartData && !isLoading && (
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: -24,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={5}
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Bar dataKey="users" fill="var(--color-users)" />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  )
}
