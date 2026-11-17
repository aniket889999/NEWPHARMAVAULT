const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
function inspect(file = path.resolve(__dirname, '../.env.benchmark.local')) {
  if (!fs.existsSync(file)) return { filePresent: false, externalRequests: 0 };
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('Benchmark configuration must be a regular private file (chmod 600).');
  execFileSync('git', ['check-ignore', '--quiet', file], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' });
  const parsed = dotenv.parse(fs.readFileSync(file));
  const value = key => process.env[key] || parsed[key] || '';
  const result = { filePresent: true, ignoredByGit: true, privatePermissions: true, externalRequests: 0, liveCallsEnabled: false,
    openai: { credentialPresent: Boolean(value('OPENAI_API_KEY').trim()), modelConfigured: /^gpt-[a-z0-9.-]+$/.test(value('OPENAI_BENCHMARK_MODEL')), accountAccessVerified: false },
    anthropic: { credentialPresent: Boolean(value('ANTHROPIC_API_KEY').trim()), modelConfigured: /^claude-[a-z0-9.-]+$/.test(value('ANTHROPIC_BENCHMARK_MODEL')), accountAccessVerified: false } };
  return result;
}
if (require.main === module) { try { console.log(JSON.stringify(inspect(), null, 2)); } catch { console.error('Benchmark setup is not ready. Check private file permissions and Git ignore policy. No credential value was printed and no request was made.'); process.exitCode = 1; } }
module.exports = { inspect };
