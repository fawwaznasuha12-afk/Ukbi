"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: { label: string; percentage: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis domain={[0, 100]} unit="%" fontSize={12} />
          <Tooltip formatter={(v) => [`${v}%`, "Nilai Latihan"]} />
          <Line type="monotone" dataKey="percentage" stroke="#1d5a52" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: { category: string; percentage: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} />
          <YAxis type="category" dataKey="category" width={140} fontSize={12} />
          <Tooltip formatter={(v) => [`${v}%`, "Ketepatan"]} />
          <Bar dataKey="percentage" fill="#8c877b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
