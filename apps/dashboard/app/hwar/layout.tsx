export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      <aside className="w-64 shrink-0 border-r p-4 space-y-2">
        <a className="block hover:underline" href="/hwar">Overview</a>
        <a className="block hover:underline" href="/hwar/create">Create</a>
        <a className="block hover:underline" href="/hwar/factory">Factory</a>
        <a className="block hover:underline" href="/hwar/library">Library</a>
        <hr className="my-2" />
        <a className="block hover:underline text-blue-600" href="/hwar/dev">Dev Smoke Test</a>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
