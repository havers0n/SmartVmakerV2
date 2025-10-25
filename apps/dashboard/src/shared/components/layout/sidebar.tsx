'use client';

import { Sheet, SheetContent, SheetTrigger } from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Menu } from 'lucide-react';

export function Sidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-4">
            <span className="font-semibold">Navigation</span>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {/* Sidebar content will go here */}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}