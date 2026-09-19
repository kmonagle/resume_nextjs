// Why this file exists: the home route (/). It only hosts the create-link form.
import { CreateLinkForm } from "@/components/create-link-form";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <CreateLinkForm />
    </main>
  );
}
