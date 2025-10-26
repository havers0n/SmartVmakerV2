"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { 
  List, 
  Users, 
  Package, 
  BarChart3, 
  Download, 
  FlaskConical,
  Settings
} from "lucide-react";

const navigation = [
  {
    section: "Harvests",
    items: [
      { name: "Harvests", href: "/hwar/factory/harvests", icon: Download },
      { name: "Analysis Queue", href: "/hwar/factory/analysis", icon: FlaskConical },
    ],
  },
  {
    section: "Pipeline",
    items: [
      { name: "Queues", href: "/hwar/factory/queues", icon: List },
      { name: "Workers", href: "/hwar/factory/workers", icon: Users },
      { name: "Batches", href: "/hwar/factory/batches", icon: Package },
    ],
  },
  {
    section: "Insights",
    items: [
      { name: "Analytics", href: "/hwar/factory/analytics", icon: BarChart3 },
      { name: "Settings", href: "/hwar/factory/settings", icon: Settings },
    ],
  },
];

export function FactorySidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-sidebar h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4">
        {navigation.map((group, idx) => (
          <div key={idx} className={cn(idx > 0 && "mt-6")}>
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
              {group.section}
            </div>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link key={item.href} href={item.href} data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}