const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('[Dialyzer Test] Preparing Elixir Dialyzer test...');

// Check if mix is installed
const mixCheck = spawnSync('mix', ['--version'], { shell: true });
if (mixCheck.error || mixCheck.status !== 0) {
    console.log('[Dialyzer Test] "mix" command not found. Skipping Dialyzer test.');
    process.exit(0);
}

const testDir = path.join(__dirname, '../dist-test/elixir');
if (!fs.existsSync(testDir)) {
    console.error('[Dialyzer Test] dist-test/elixir not found. Run matrix test first.');
    process.exit(1);
}

const mixExsContent = `
defmodule DialyzerTest.MixProject do
  use Mix.Project

  def project do
    [
      app: :dialyzer_test,
      version: "0.1.0",
      elixir: "~> 1.10",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      dialyzer: [
        flags: [:error_handling, :race_conditions, :underspecs]
      ]
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp deps do
    [
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false},
      {:jason, "~> 1.4"}
    ]
  end
end
`;

fs.writeFileSync(path.join(testDir, 'mix.exs'), mixExsContent.trim());

console.log('[Dialyzer Test] Fetching dependencies...');
spawnSync('mix', ['deps.get'], { cwd: testDir, stdio: 'inherit', shell: true });

console.log('[Dialyzer Test] Running Dialyzer (This may take a few minutes the first time to build PLTs)...');
const dialyzerRes = spawnSync('mix', ['dialyzer'], { cwd: testDir, stdio: 'inherit', shell: true });

if (dialyzerRes.status !== 0) {
    console.error('[Dialyzer Test] FAILED: Dialyzer detected type specification errors.');
    process.exit(1);
}

console.log('[Dialyzer Test] SUCCESS: No typespec errors found by Dialyzer!');
process.exit(0);
