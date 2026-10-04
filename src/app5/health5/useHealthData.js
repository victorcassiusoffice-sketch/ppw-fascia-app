// useHealthData — load the vetted data the first time a health surface renders.
//
// The three files are ~0.85 MB. Nobody opening the app to tick a walk should
// pay for that, so this hook is the only place that pulls them, and only the
// screens that need numbers call it.
//
// It also hands the loaded index to the store, because slot syncing has to be
// able to ask "is this one `avoid`?" without every caller passing data in.

import React from 'react';
import { loadHealthData, peekHealthData } from './data.js';
import { setHealthEngineData, healthEngineData } from '../store5.js';

export default function useHealthData() {
  const [data, setData] = React.useState(() => peekHealthData());

  React.useEffect(() => {
    if (data) {
      // Cached from an earlier mount, but the store may not have it yet — and
      // a cabinet loaded before the data cannot have been checked for `avoid`.
      if (!healthEngineData()) setHealthEngineData(data);
      return undefined;
    }
    let alive = true;
    loadHealthData()
      .then((d) => { if (alive) { setHealthEngineData(d); setData(d); } })
      .catch(() => { /* offline: the UI says so rather than showing wrong numbers */ });
    return () => { alive = false; };
  }, [data]);

  return data;
}
