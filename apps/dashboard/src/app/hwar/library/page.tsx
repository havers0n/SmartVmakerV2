"use client";

import { Card } from "@/shared/components/ui/card";
import { BookMarked, Users2, FolderOpen, Layout } from "lucide-react";
import Link from "next/link";

export default function LibraryIndex() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Library</h1>
        <p className="text-sm text-muted-foreground">Manage reusable assets and templates</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/hwar/library/presets" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <BookMarked className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Presets</h3>
                <p className="text-sm text-muted-foreground">
                  Story templates with themes, emotions, and narrative structures
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/hwar/library/characters" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Users2 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Characters</h3>
                <p className="text-sm text-muted-foreground">
                  Character profiles with reference images and style rules
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/hwar/library/datasets" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Datasets</h3>
                <p className="text-sm text-muted-foreground">
                  Browse harvest data, analysis documents, and signal patterns
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/hwar/library/templates" className="block">
          <Card className="p-6 hover-elevate cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <Layout className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Pipeline templates for automated batch production
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}