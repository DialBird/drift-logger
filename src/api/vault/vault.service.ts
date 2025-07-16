import { getPreferenceValues } from "@raycast/api";
import { readFile } from "fs/promises";
import { homedir } from "os";
import path from "path";
import { GlobalPreferences } from "../../utils/preferences";
import { ObsidianJSON, Vault } from "./vault.types";

function getVaultNameFromPath(vaultPath: string): string {
  const name = path.basename(vaultPath);
  if (name) {
    return name;
  } else {
    return "Default Vault Name (check your path preferences)";
  }
}

export function parseVaults(): Vault[] {
  const { vaultPath } = getPreferenceValues<GlobalPreferences>();
  if (vaultPath) {
    return vaultPath.split(",").map((path) => {
      const trimmedPath = path.trim();
      return {
        name: getVaultNameFromPath(trimmedPath),
        key: getVaultNameFromPath(trimmedPath),
        path: trimmedPath,
      };
    });
  } else {
    return [];
  }
}

export async function loadObsidianJson(): Promise<Vault[]> {
  const obsidianJSONpath = path.join(homedir(), "Library", "Application Support", "obsidian", "obsidian.json");
  try {
    const buffer = await readFile(obsidianJSONpath);
    const obsidianJSON = JSON.parse(buffer.toString()) as ObsidianJSON;
    return Object.keys(obsidianJSON.vaults).map((key) => {
      const vaultPath = obsidianJSON.vaults[key].path;
      let vaultName: string;
      try {
        vaultName = getVaultNameFromPath(vaultPath);
      } catch (error) {
        vaultName = `Vault (${vaultPath})`;
      }

      return {
        name: vaultName,
        key: key,
        path: vaultPath,
      };
    });
  } catch (error) {
    return [];
  }
}
