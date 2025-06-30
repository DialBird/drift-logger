/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Path to Vault - Specify the path or multiple paths (comma separated) to your vault/vaults */
  "vaultPath"?: string,
  /** Config filename - Override the vault config filename (default: .obsidian) */
  "configFileName": string,
  /** Exclude following folders - Specify which folders to exclude (comma separated) */
  "excludedFolders"?: string,
  /** Remove content - Hide YAML frontmatter for copying and viewing notes */
  "removeYAML"?: boolean,
  /** undefined - Hide LaTeX (surrounded by $$ or $) for copying and viewing notes */
  "removeLatex"?: boolean,
  /** undefined - Hide links for copying and viewing notes */
  "removeLinks"?: boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `appendTaskCommand` command */
  export type AppendTaskCommand = ExtensionPreferences & {
  /** Path of the note you wish to append the task to - Path of note */
  "notePath": string,
  /** Tag to append to the beginning of the task. - Defaults to #task for compatibility with Obsidian Tasks. */
  "noteTag": string,
  /** Creation Date - ➕ YYYY-MM-DD (Current date) */
  "creationDate": boolean,
  /** Name of Obsidian vault where note is - Name of Obsidian vault where note is */
  "vaultName"?: string,
  /** Name of heading in note in which to append - If no heading is not set, text will be appended to the end of the note */
  "heading"?: string,
  /** Silent Mode - Don't open note when appending. */
  "silent": boolean
}
}

declare namespace Arguments {
  /** Arguments passed to the `appendTaskCommand` command */
  export type AppendTaskCommand = {
  /** Your task */
  "text": string,
  /** YYYY-MM-DD */
  "dueDate": string
}
}

