import { homedir } from "node:os";
import path from "node:path";

export const supportedVersion = "4.0.539";
export const runtimeDependencies = {
  remotion: supportedVersion,
  "@remotion/bundler": supportedVersion,
  "@remotion/renderer": supportedVersion,
  "@remotion/cli": supportedVersion,
  "@remotion/player": supportedVersion,
  "@remotion/media": supportedVersion,
  react: "19.3.1",
  "react-dom": "19.3.1",
  "@types/react": "19.3.0",
  "@types/react-dom": "19.3.0",
  typescript: "5.9.3",
};

export const defaultRuntimeRoot = () => path.join(homedir(), ".promptlings", "runtimes", `remotion-${supportedVersion}`);
