import { Sidebar } from "@/components/Sidebar";

// Every signed-in page: sidebar + content. The (dashboard) folder name is not part of the URL.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="md:pl-60">
        <main id="main" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8 md:py-12 lg:px-12">
          {children}
        </main>
      </div>
    </>
  );
}
