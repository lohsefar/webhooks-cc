import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LiveDemo } from "@/components/landing/live-demo";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl">
            webhooks.cc
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-muted-foreground hover:text-foreground">
              Docs
            </Link>
            <Link href="/installation" className="text-muted-foreground hover:text-foreground">
              Installation
            </Link>
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Inspect webhooks instantly
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Get a unique URL in one click. See incoming requests in real-time.
          Forward to localhost for development. No signup required.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <a href="#demo">Try it live</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/docs">Read the docs</Link>
          </Button>
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="container mx-auto px-4 py-16">
        <LiveDemo />
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything you need to debug webhooks
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-lg border">
            <h3 className="font-semibold text-lg mb-2">Real-time inspection</h3>
            <p className="text-muted-foreground">
              See requests as they arrive. Headers, body, query params - all formatted and searchable.
            </p>
          </div>
          <div className="p-6 rounded-lg border">
            <h3 className="font-semibold text-lg mb-2">Mock responses</h3>
            <p className="text-muted-foreground">
              Configure what your endpoint returns. Set status codes, headers, and body content.
            </p>
          </div>
          <div className="p-6 rounded-lg border">
            <h3 className="font-semibold text-lg mb-2">Local forwarding</h3>
            <p className="text-muted-foreground">
              Forward webhooks to localhost with our CLI. Test integrations without deploying.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">Simple pricing</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="p-8 rounded-lg border">
            <h3 className="font-semibold text-xl mb-2">Free</h3>
            <p className="text-4xl font-bold mb-4">$0</p>
            <ul className="space-y-2 text-muted-foreground mb-6">
              <li>500 requests/day</li>
              <li>24-hour data retention</li>
              <li>Unlimited endpoints</li>
              <li>CLI & SDK access</li>
            </ul>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/login">Get started</Link>
            </Button>
          </div>
          <div className="p-8 rounded-lg border border-primary">
            <h3 className="font-semibold text-xl mb-2">Pro</h3>
            <p className="text-4xl font-bold mb-4">
              $15<span className="text-lg font-normal">/mo</span>
            </p>
            <ul className="space-y-2 text-muted-foreground mb-6">
              <li>500,000 requests/month</li>
              <li>30-day data retention</li>
              <li>Custom subdomains</li>
              <li>Priority support</li>
            </ul>
            <Button className="w-full" asChild>
              <Link href="/login">Upgrade to Pro</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>webhooks.cc</p>
        </div>
      </footer>
    </main>
  );
}
