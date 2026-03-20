import type { Metadata } from "next";
import Link from "next/link";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog — webhooks.cc",
  description:
    "See what's new in webhooks.cc. Full version history of features, improvements, and fixes.",
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-12">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
          >
            &larr; Back to home
          </Link>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Changelog</h1>
          <p className="text-muted-foreground">
            Current version:{" "}
            <span className="font-mono font-bold text-foreground">{APP_VERSION}</span>
          </p>
        </div>

        <div className="space-y-12">
          {CHANGELOG.map((entry) => (
            <article
              key={entry.version}
              id={`v${entry.version}`}
              className="border-2 border-foreground p-6"
            >
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 className="text-xl font-bold">
                  <span className="font-mono">v{entry.version}</span>
                  <span className="text-muted-foreground font-normal"> &mdash; </span>
                  {entry.title}
                </h2>
                <time
                  dateTime={entry.date}
                  className="text-sm text-muted-foreground whitespace-nowrap"
                >
                  {entry.date}
                </time>
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-foreground shrink-0">&bull;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
