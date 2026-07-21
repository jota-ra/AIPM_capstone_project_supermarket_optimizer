import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-forest">404</h1>
        <h2 className="mt-4 font-serif text-xl text-forest">Page not found</h2>
        <p className="mt-2 text-sm text-forest/60">
          That page wandered off. Let's get you back on the path.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-cream"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-xl text-forest">This page didn't load</h1>
        <p className="mt-2 text-sm text-forest/60">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-cream"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-forest/15 bg-card px-5 py-2.5 text-sm font-medium text-forest"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NutriWise — Nutrition that learns from your basket" },
      { name: "description", content: "Upload grocery receipts. See your real nutrition gaps. Get recipes that close them. The more you upload, the smarter it gets." },
      { name: "author", content: "NutriWise" },
      { property: "og:title", content: "NutriWise — Nutrition that learns from your basket" },
      { property: "og:description", content: "Upload grocery receipts. See your real nutrition gaps. Get recipes that close them. The more you upload, the smarter it gets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NutriWise — Nutrition that learns from your basket" },
      { name: "twitter:description", content: "Upload grocery receipts. See your real nutrition gaps. Get recipes that close them. The more you upload, the smarter it gets." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/da4f090f-6765-488f-a870-e59b6a75c40e/id-preview-aad68311--2eb8b647-5483-475e-b04b-17b31cd8ec80.lovable.app-1782819665409.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/da4f090f-6765-488f-a870-e59b6a75c40e/id-preview-aad68311--2eb8b647-5483-475e-b04b-17b31cd8ec80.lovable.app-1782819665409.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
