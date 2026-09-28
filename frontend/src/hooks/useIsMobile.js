import {useSyncExternalStore} from 'react';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

function subscribe(callback){
  const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT);

  mediaQuery.addEventListener('change', callback);

  return() => mediaQuery.removeEventListener('change', callback);
}

function getSnapshot(){
  return window.matchMedia(MOBILE_BREAKPOINT).matches;
}

function getServerSnapshot(){
  return false;
}

export function useIsMobile(){
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}