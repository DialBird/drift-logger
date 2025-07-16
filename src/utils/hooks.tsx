import { getPreferenceValues } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { ObsidianVaultsState } from "../api/vault/vault.types";
import { loadObsidianJson, parseVaults } from "../api/vault/vault.service";
import { Logger } from "../api/logger/logger.service";

const logger = new Logger("Hooks");

export function useObsidianVaults(): ObsidianVaultsState {
  const pref = useMemo(() => getPreferenceValues(), []);
  const [state, setState] = useState<ObsidianVaultsState>(
    pref.vaultPath
      ? {
          ready: true,
          vaults: parseVaults(),
        }
      : { ready: false, vaults: [] }
  );

  logger.info("useObsidianVaults hook called");

  useEffect(() => {
    if (!state.ready) {
      loadObsidianJson()
        .then((vaults) => {
          setState({ vaults, ready: true });
        })
        .catch(() => setState({ vaults: parseVaults(), ready: true }));
    }
  }, []);

  return state;
}
