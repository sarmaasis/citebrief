import { Button } from "@/components/ui/button";

export default function AppHomePage() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Home</h1>
        <Button type="button">Add a brand</Button>
      </div>
      <div className="rounded-cb-card border border-cb-line bg-cb-surface px-6 py-16 text-center">
        <p className="text-sm text-cb-text">Add a brand to start the first Friday report.</p>
        <div className="mt-4">
          <Button type="button">Add a brand</Button>
        </div>
      </div>
    </div>
  );
}
