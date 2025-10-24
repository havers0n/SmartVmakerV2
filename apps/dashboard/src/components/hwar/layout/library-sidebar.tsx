import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BookMarked, 
  Users2, 
  FolderOpen, 
  Layout
} from "lucide-react";

const navigation = [
  { name: "Presets", href: "/library/presets", icon: BookMarked },
  { name: "Characters", href: "/library/characters", icon: Users2 },
  { name: "Datasets", href: "/library/datasets", icon: FolderOpen },
  { name: "Templates", href: "/library/templates", icon: Layout },
];

export function LibrarySidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 border-r bg-sidebar h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={item.href} href={item.href} data-testid={`link-${item.name.toLowerCase()}`}>
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
    </aside>
  );
}
