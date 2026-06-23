import { Navbar } from "@/components/navbar";

export default function CreatePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <h1 className="font-display text-3xl text-parchment">
          The video builder is on its way.
        </h1>
        <p className="mt-4 text-parchment-muted">
          We&rsquo;re still putting this part together. Check back soon.
        </p>
      </div>
    </main>
  );
}
