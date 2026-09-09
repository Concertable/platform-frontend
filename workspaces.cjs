module.exports = {
  workspaces: [
    ["packages/shared", "packages/shared/tsconfig.build.json"],
    ["packages/web", "packages/web/tsconfig.build.json"],
    ["packages/mobile", "packages/mobile/tsconfig.build.json"],
  ],
};
