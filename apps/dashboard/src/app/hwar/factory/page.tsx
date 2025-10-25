"use client";

import { Card } from "@/src/components/ui/card";
import { Download, FlaskConical, List, Users, BarChart3 } from "lucide-react";
import Link from "next/link";

const quickStats = [
  { label: "Active Harvests", value: "3", icon: Download, color: "text-blue-600" },
  { label: "Analysis Queue", value: "142", icon: FlaskConical, color: "text-purple-600" },
  { label: "Pending Jobs", value: "89", icon: List, color: "text-orange-600" },
  { label: "Active Workers", value: "6", icon: Users, color: "text-green-600" },
];

export default function FactoryIndex() {
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Factory Dashboard</h1>
        <p className="text-sm text-muted-foreground">Production pipeline orchestration and analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-3xl font-bold tabular-nums leading-none mb-2">{stat.value}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</div>
                </div>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/hwar/factory/harvests" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Harvests</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Search YouTube videos, analyze structure, and extract trend insights
                </p>
                <div className="text-xs text-muted-foreground">3 active batches • 247 videos analyzed</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/hwar/factory/analysis" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Analysis Queue</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Gemini-powered video analysis generating framebreak, analytics, and reports
                </p>
                <div className="text-xs text-muted-foreground">142 pending • 3 processing</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/hwar/factory/workers" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Workers</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Manage concurrency, rate limits, and budgets for all providers
                </p>
                <div className="text-xs text-muted-foreground">6 workers online • $66.93 spent today</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/hwar/factory/analytics" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Analytics</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Cost/day graphs, success rates, and performance metrics
                </p>
                <div className="text-xs text-muted-foreground">94.2% success rate • avg 12s per video</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}