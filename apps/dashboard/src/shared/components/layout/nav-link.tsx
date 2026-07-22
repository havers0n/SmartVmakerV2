"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
export function NavLink({href,children}:{href:string;children:ReactNode}){const pathname=usePathname();const active=pathname===href||pathname.startsWith(`${href}/`);return <Link href={href}><Button variant="ghost" className={`w-full justify-start gap-3 ${active?"bg-secondary text-foreground":"text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>{children}</Button></Link>}
