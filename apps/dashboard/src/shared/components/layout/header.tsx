'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from '@/shared/components/ui/navigation-menu';

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Ingest', href: '/ingest' },
    { name: 'Analyze', href: '/analysis' },
    { name: 'Generate', href: '/generation' },
    { name: 'HWAR', href: '/hwar' },
    { name: 'Projects', href: '/projects' },
  ];

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center px-4">
        <NavigationMenu>
          <NavigationMenuList>
            {navItems.map((item) => (
              <NavigationMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    active={pathname === item.href || (item.href === '/projects' && pathname.startsWith('/projects'))}
                  >
                    {item.name}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}