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
  "configFileName": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `driftLoggerCommand` command */
  export type DriftLoggerCommand = ExtensionPreferences & {
  /** Path of the note (format with date-fns) - Path of note(format with date-fns) */
  "notePath": string,
  /** Name of Obsidian vault where note is - Name of Obsidian vault where note is */
  "vaultName"?: string,
  /** Name of heading in note in which to append - If no heading is not set, text will be appended to the end of the note */
  "heading"?: string,
  /** Silent Mode - Don't open note when appending. */
  "silent": boolean
}
}

declare namespace Arguments {
  /** Arguments passed to the `driftLoggerCommand` command */
  export type DriftLoggerCommand = {
  /** Your task */
  "text": string,
  /** min */
  "minutes": string,
  /** HHmm */
  "startTime": string
}
}

