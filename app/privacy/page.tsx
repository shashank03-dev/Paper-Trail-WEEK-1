import Link from "next/link";
import { isHosted, llmConfig, serverConfig } from "@/lib/config";
import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy",
  description: "What Paper Trail does with your location, your photo and your handwriting.",
};
// Reads the live server configuration, so it always names the provider actually in use.
export const dynamic = "force-dynamic";

const POLICY: Record<string, { name: string; url: string }> = {
  gemini: { name: "Google (Gemini API)", url: "https://ai.google.dev/gemini-api/terms" },
  "ollama-cloud": { name: "Ollama (Ollama Cloud)", url: "https://ollama.com/privacy" },
};

export default function Privacy() {
  const cfg = llmConfig();
  const hosted = isHosted(cfg);
  const providers = cfg.providers.filter((p) => p.hosted && POLICY[p.id]).map((p) => POLICY[p.id]!);
  const demo = serverConfig().demoMode;
  return (
    <LegalPage
      label="Privacy"
      title={
        <>
          Your street is <em className="text-riso">nobody&rsquo;s business.</em>
        </>
      }
      updated="10 October 2026"
    >
      <p>
        Paper Trail has no accounts, no analytics, no advertising and no tracking cookies. It keeps
        nothing about you on its server. This page explains exactly where your information goes when
        you use it.
      </p>

      <h2>What stays in your browser</h2>
      <p>
        Your trails, the reports from your photos, your Trail Book and your settings are stored in
        this browser (IndexedDB and local storage). They never leave it unless you send them
        somewhere yourself. Clearing your browser&rsquo;s site data deletes them, and nobody,
        including us, can recover them.
      </p>

      <h2>What passes through the server, and where it goes</h2>
      <ul>
        <li>
          <strong>Where you start a walk.</strong> The coordinates you pick are sent to{" "}
          <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy">OpenStreetMap</a> services
          (Overpass for nearby places, Nominatim if you search an address) and to{" "}
          <a href="https://open-meteo.com/en/terms">Open-Meteo</a> for the weather. Results are
          cached on the server for up to a day, keyed by rounded coordinates, so that repeat lookups
          don&rsquo;t hit those services again.
        </li>
        <li>
          <strong>What you type in the search box.</strong> As you type (from the third letter), the
          text is sent through the server to <a href="https://photon.komoot.io">Photon</a>,
          komoot&rsquo;s OpenStreetMap search, for suggestions. Only the words you typed are passed
          on, not your IP address.
        </li>
        <li>
          <strong>Writing your zine.</strong> A list of the nearby places, the weather, the walk
          length, who&rsquo;s coming and the name for the cover (if you give one) are sent to the AI
          model that writes the pages.
        </li>
        <li>
          <strong>Reading your sheet.</strong> Your browser crops your photo into four page images
          on your device; only those four crops are sent to the AI model that reads them. The full
          photo is never uploaded.
        </li>
        <li>
          <strong>The map picker.</strong> If you open the optional map, its tiles load directly
          from openstreetmap.org.
        </li>
      </ul>

      <h2>Which AI model, and who runs it</h2>
      {demo ? (
        <p>
          This site is running in demo mode: it uses saved example places and recorded answers, and
          may not call an AI model at all.
        </p>
      ) : hosted ? (
        <>
          <p>
            Paper Trail always uses Gemma, an open model. On this site it is served by a hosted
            provider, so the requests above go to:
          </p>
          <ul>
            {providers.map((p) => (
              <li key={p.name}>
                <a href={p.url}>{p.name}</a>
              </li>
            ))}
          </ul>
          <p>
            Those requests are handled under the provider&rsquo;s own terms, which may allow it to
            keep them for a time or use them to improve its services, depending on the plan in use.
            If you would rather nothing leave your computer, you can{" "}
            <a href="https://github.com/shashank03-dev/Paper-Trail-WEEK-1#quick-start">
              run Paper Trail yourself
            </a>{" "}
            with Gemma on your own machine.
          </p>
        </>
      ) : (
        <p>
          On this installation Gemma runs on the same machine as Paper Trail, so the requests to the
          model never leave it.
        </p>
      )}

      <h2>Logs</h2>
      <p>
        For each request the server writes one technical log line: which page or API was used,
        whether it worked, how long it took and a random request number. These lines never contain
        your location, places, photos, handwriting or report. If a page crashes in your browser, it
        reports the error message and the page address (without any query string) so we can fix it.
        The hosting provider (Render) also keeps standard access logs, which include IP addresses,
        for a limited time; we use the IP address only in memory to stop any one visitor from
        overloading the service.
      </p>

      <h2>Children</h2>
      <p>
        Paper Trail is made for families to use together. It has no accounts and collects no
        personal information. If a child uses it, a grown-up should choose the starting point.
      </p>

      <h2>Questions</h2>
      <p>
        Ask anything on the{" "}
        <a href="https://github.com/shashank03-dev/Paper-Trail-WEEK-1/issues">
          project&rsquo;s issue tracker
        </a>
        , or read the code: everything described here is in the{" "}
        <a href="https://github.com/shashank03-dev/Paper-Trail-WEEK-1">public repository</a>. See
        also the <Link href="/terms">terms</Link>.
      </p>
    </LegalPage>
  );
}
