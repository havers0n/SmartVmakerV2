import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Settings, DollarSign } from "lucide-react";

export function AppHeader() {
  return (
    <header className="h-16 border-b bg-background">
      <div className="h-full px-6 flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-8">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">V</span>
              </div>
              <span className="font-semibold text-lg">VideoFactory</span>
            </div>
          </Link>
          
          <nav className="flex items-center gap-8">
            <Link href="/create" data-testid="link-create">
              <span className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors cursor-pointer">
                Create
              </span>
            </Link>
            <Link href="/factory" data-testid="link-factory">
              <span className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors cursor-pointer">
                Factory
              </span>
            </Link>
            <Link href="/library" data-testid="link-library">
              <span className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors cursor-pointer">
                Library
              </span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-8 px-3 rounded-full border border-border bg-card flex items-center gap-2" data-testid="cost-meter">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-mono font-semibold">$0.00</span>
            <span className="text-xs text-muted-foreground">/ $100</span>
          </div>
          
          <Button variant="ghost" size="icon" data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
