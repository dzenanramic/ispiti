import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Navigacioni indikator: pošto je `teacher/layout` dinamički (sesija iz
 * kolačićâ), link nema šta unaprijed preuzeti, pa klik izgleda kao da „ništa
 * se ne dešava" dok server ne vrati stranicu. Linija odmah pokazuje da je
 * zahtjev u toku.
 */
const NavContext = createContext<{ pending: boolean; start: () => void }>({
  pending: false,
  start: () => {},
});

export const NAV_START_EVENT = "ispiti:nav-start";
export const NAV_END_EVENT = "ispiti:nav-end";

// Globalna zastavica preživljava promjenu stranice (novi pathname montira novi
// `<NavigationDone />`, ali ne i novi root layout).
const pendingKey = Symbol.for("ispiti.navPending");

declare global {
  interface Window {
    [pendingKey]?: boolean;
  }
}

export function isNavPending(): boolean {
  return typeof window !== "undefined" && Boolean(window[pendingKey]);
}

export function useNavPending() {
  return useContext(NavContext).pending;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [transitionPending] = useTransition();
  const [eventPending, setEventPending] = useState(false);

  useEffect(() => {
    const onStart = () => setEventPending(true);
    const onEnd = () => setEventPending(false);
    window.addEventListener(NAV_START_EVENT, onStart);
    window.addEventListener(NAV_END_EVENT, onEnd);
    return () => {
      window.removeEventListener(NAV_START_EVENT, onStart);
      window.removeEventListener(NAV_END_EVENT, onEnd);
    };
  }, []);

  // Čim Nova stranica stigne, linija nestaje — bez čekanja na događaj umjesto
  // kojeg ponekad ne stigne ništa (prekinut navigacija, error boundary).
  useEffect(() => {
    window[pendingKey] = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nova stranica je stigla
    setEventPending(false);
  }, [pathname]);

  // Interni linkovi presreću klik u capture fazi; mijenja se samo ruter, pa
  // modifikatori (novi tab) i destruktivne akcije (data-no-nav) rade normalno.
  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.(
        'a[data-nav-link="true"]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.dataset.noNav === "true") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      window[pendingKey] = true;
      window.dispatchEvent(new Event(NAV_START_EVENT));
      startTransition(() => {
        router.push(url.pathname + url.search + url.hash);
      });
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [router]);

  const pending = eventPending || transitionPending;

  return (
    <NavContext.Provider
      value={{
        pending,
        start: () => {
          window[pendingKey] = true;
          window.dispatchEvent(new Event(NAV_START_EVENT));
          window.setTimeout(() => {
            if (window[pendingKey]) {
              window[pendingKey] = false;
              window.dispatchEvent(new Event(NAV_END_EVENT));
            }
          }, 8000);
        },
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      >
        <div
          className={`h-full bg-brand ${pending ? "animate-nav-progress" : "opacity-0"}`}
        />
      </div>
      {children}
    </NavContext.Provider>
  );
}

export function NavigationDone() {
  useEffect(() => {
    window[pendingKey] = false;
    window.dispatchEvent(new Event(NAV_END_EVENT));
  }, []);
  return null;
}
