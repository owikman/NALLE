'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DataPoint {
  name: string
  value: number
}

interface Props {
  data: DataPoint[]
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f87171', '#6b7280']

export default function ExpensePieChart({ data }: Props) {
  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [formatEUR(Number(value))]}
          contentStyle={{ border: '1px solid #f3f4f6', borderRadius: '12px', fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
