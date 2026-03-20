import { Config } from "@remotion/cli/config";

// Tutorials app root as public dir so staticFile("output/screenshots/..."), staticFile("output/audio/...") resolve
Config.setPublicDir(".");

// M1 Pro memory safety default
Config.setConcurrency(2);

Config.setCodec("h264");

// Visually lossless for text-heavy UI screenshots
Config.setCrf(18);
